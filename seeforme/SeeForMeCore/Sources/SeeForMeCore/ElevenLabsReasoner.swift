import Foundation

/// Uses the existing ElevenLabs credential natively. No document uploads or client-side key.
public struct ElevenLabsReasoner: ConversationReasoner {
    public init() {}
    private static let transport = URLSession(configuration: .ephemeral)
    static let agentID = "agent_6401m5rd50ckedma82cz9qzg7asa"
    private func complete(_ payload: [String: Any]) async throws -> Data {
        guard let key = KeychainStore.load() else { throw ElevenLabsClient.Failure.invalidKey }
        var request = URLRequest(url: URL(string: "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=" + Self.agentID)!, timeoutInterval: 15)
        request.setValue(key, forHTTPHeaderField: "xi-api-key")
        let (data, response) = try await Self.transport.data(for: request)
        try ElevenLabsClient.check(response)
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let signed = object["signed_url"] as? String, let url = URL(string: signed),
              url.scheme == "wss", url.host == "api.elevenlabs.io" else { throw ElevenLabsClient.Failure.badResponse }
        let socket = Self.transport.webSocketTask(with: url)
        socket.maximumMessageSize = 100_000
        socket.resume()
        defer { socket.cancel(with: .normalClosure, reason: nil) }
        let input = String(decoding: try JSONSerialization.data(withJSONObject: payload), as: UTF8.self)
        let reply = try await withThrowingTaskGroup(of: Data.self) { group in
            group.addTask {
                try await socket.send(.string("{\"type\":\"conversation_initiation_client_data\"}"))
                var sent = false
                for _ in 0..<100 {
                    let message = try await socket.receive()
                    let bytes: Data
                    switch message { case .string(let value): bytes = Data(value.utf8); case .data(let value): bytes = value; @unknown default: throw ElevenLabsClient.Failure.badResponse }
                    guard let event = try JSONSerialization.jsonObject(with: bytes) as? [String: Any], let type = event["type"] as? String else { continue }
                    if type == "conversation_initiation_metadata", !sent {
                        let user = try JSONSerialization.data(withJSONObject: ["type": "user_message", "text": input])
                        try await socket.send(.string(String(decoding: user, as: UTF8.self))); sent = true
                    } else if type == "ping", let ping = event["ping_event"] as? [String: Any], let id = ping["event_id"] {
                        let pong = try JSONSerialization.data(withJSONObject: ["type": "pong", "event_id": id])
                        try await socket.send(.string(String(decoding: pong, as: UTF8.self)))
                    } else if type == "agent_response", sent,
                              let reply = event["agent_response_event"] as? [String: Any], let text = reply["agent_response"] as? String,
                              let start = text.firstIndex(of: "{"), let end = text.lastIndex(of: "}"), start <= end {
                        return Data(text[start...end].utf8)
                    } else if type == "error" { throw ElevenLabsClient.Failure.badResponse }
                }
                throw ElevenLabsClient.Failure.badResponse
            }
            group.addTask { try await Task.sleep(for: .seconds(30)); socket.cancel(with: .goingAway, reason: nil); throw URLError(.timedOut) }
            defer { group.cancelAll() }
            return try await group.next()!
        }
        Diagnostics.record("reasoning.eleven", ["ok": "true", "task": payload["task"] as? String ?? "unknown"])
        return reply
    }
    private struct TextReply: Decodable { let text: String }
    public func translate(_ text: String, language: String) async throws -> String {
        if text.isEmpty { return "" }
        let data = try await complete(["task": "translate", "target": language, "text": String(text.prefix(1500))])
        let result = try JSONDecoder().decode(TextReply.self, from: data).text
        guard !result.isEmpty, result.count <= 1800 else { throw ConversationError.unsupported }
        return result
    }
    public func explainPage(text: String, page: String, language: String) async throws -> String {
        let data = try await complete(["task": "explain", "conversationLanguage": language, "utterance": String(text.prefix(1000)), "page": String(page.prefix(3500))])
        return String(try JSONDecoder().decode(TextReply.self, from: data).text.prefix(1500))
    }
    private struct Decision: Decodable {
        struct Value: Decodable { let fieldId: String?; let source: String?; let value: String? }
        let intent: String; let explanation: String; let language: String?; let usedContext: Bool; let values: [Value]
    }
    public func decide(text: String, fields: [FormField], question: Question?, language: String, formLanguage: String?) async throws -> ConversationDecision {
        try await decide(text: text, fields: fields, question: question, language: language, formLanguage: formLanguage, context: "")
    }
    public func decide(text: String, fields: [FormField], question: Question?, language: String, formLanguage: String?, context: String) async throws -> ConversationDecision {
        try await decide(text: text, fields: fields, question: question, language: language, formLanguage: formLanguage, context: context, contextAuthorized: false)
    }
    public func decide(text: String, fields: [FormField], question: Question?, language: String, formLanguage: String?, context: String, contextAuthorized: Bool) async throws -> ConversationDecision {
        let eligible = Array(fields.filter { $0.isFillable && !$0.currentValuePresent }.prefix(20))
        let encoded = try JSONSerialization.jsonObject(with: JSONEncoder().encode(eligible))
        let data = try await complete(["task": "decide", "contextAvailable": !context.isEmpty, "contextAuthorized": contextAuthorized, "conversationLanguage": language, "formLanguage": formLanguage ?? "infer from labels", "utterance": String(text.prefix(1000)), "question": question?.text ?? "", "fields": encoded, "context": String(context.prefix(2000))])
        let parsed = try JSONDecoder().decode(Decision.self, from: data)
        guard let intent = ConversationDecision.Intent(rawValue: parsed.intent) else { throw ConversationError.unsupported }
        let evidence = text + (parsed.usedContext ? "\n" + context : "")
        var values: [ConversationValue] = []
        for item in parsed.values.prefix(20) {
            guard intent == .answer, let fieldId = item.fieldId, let source = item.source, let proposed = item.value,
                  let field = eligible.first(where: { $0.id == fieldId }),
                  !source.isEmpty, evidence.localizedCaseInsensitiveContains(source), proposed.count <= 1500,
                  field.kind != .checkbox || text.localizedCaseInsensitiveContains(source) else { continue }
            var value = proposed
            if [.text, .textarea].contains(field.kind), !FieldRules.isIdentity(field),
               let target = field.language ?? formLanguage, !target.isEmpty,
               !ConversationLanguage.same(ConversationLanguage.detect(value) ?? "", target) {
                value = try await translate(value, language: target)
                guard ConversationLanguage.same(ConversationLanguage.detect(value) ?? "", target) else { continue }
            }
            values.append(ConversationValue(fieldId: fieldId, source: source, value: value))
        }
        var result = ConversationDecision(intent: intent, explanation: String(parsed.explanation.prefix(1000)), language: parsed.language, values: values)
        result.usedContext = parsed.usedContext && !context.isEmpty
        return result
    }
}

/// Preserve Apple's existing route for supported non-Bengali sessions.
public struct SeeForMeConversationReasoner: ConversationReasoner {
    public init() {}
    private func provider(_ language: String) -> any ConversationReasoner {
        ConversationLanguage.same(language, "bn") ? ElevenLabsReasoner() : LocalConversationReasoner()
    }
    public func translate(_ text: String, language: String) async throws -> String { try await provider(language).translate(text, language: language) }
    public func explainPage(text: String, page: String, language: String) async throws -> String { try await provider(language).explainPage(text: text, page: page, language: language) }
    public func streamPage(text: String, page: String, language: String, onSentence: @Sendable (String, Int, Bool) -> Void) async throws -> String { try await provider(language).streamPage(text: text, page: page, language: language, onSentence: onSentence) }
    public func decide(text: String, fields: [FormField], question: Question?, language: String, formLanguage: String?) async throws -> ConversationDecision { try await decide(text: text, fields: fields, question: question, language: language, formLanguage: formLanguage, context: "") }
    public func decide(text: String, fields: [FormField], question: Question?, language: String, formLanguage: String?, context: String) async throws -> ConversationDecision { try await provider(language).decide(text: text, fields: fields, question: question, language: language, formLanguage: formLanguage, context: context) }
    public func decide(text: String, fields: [FormField], question: Question?, language: String, formLanguage: String?, context: String, contextAuthorized: Bool) async throws -> ConversationDecision { try await provider(language).decide(text: text, fields: fields, question: question, language: language, formLanguage: formLanguage, context: context, contextAuthorized: contextAuthorized) }

}
