import Foundation

/// Handles extension messages for all sessions. Holds only field metadata, never field values:
/// values exist only inside the reply that carries them to the extension.
public actor FormEngine {
    struct Session {
        var origin: String
        var order: [String]
        var fields: [String: FormField]
        var filledByUs: Set<String> = []
        var question: Question?
        var issueFieldIds: [String] = []
        var lastUsed = Date()
    }

    private var sessions: [String: Session] = [:]
    private let primary: any FieldExtractor
    private let fallback: any FieldExtractor
    private let modelAvailable: @Sendable () -> Bool

    static let sessionLifetime: TimeInterval = 30 * 60
    static let maxSessions = 20

    public init(primary: any FieldExtractor = FoundationModelExtractor(),
                fallback: any FieldExtractor = HeuristicExtractor(),
                modelAvailable: @escaping @Sendable () -> Bool = { FoundationModelExtractor.isAvailable }) {
        self.primary = primary
        self.fallback = fallback
        self.modelAvailable = modelAvailable
    }

    // MARK: Entry points

    /// Handles a message as received from Safari (a JSON-compatible object).
    public func handle(jsonObject: sending Any) async -> HostReply {
        guard JSONSerialization.isValidJSONObject(jsonObject),
              let data = try? JSONSerialization.data(withJSONObject: jsonObject) else {
            return .error(.badSchema, sessionId: "", requestId: "", modelAvailable: modelAvailable())
        }
        return await handle(data: data)
    }

    public func handle(data: Data) async -> HostReply {
        let available = modelAvailable()
        guard data.count <= ProtocolLimits.maxMessageBytes else {
            return .error(.tooLarge, sessionId: "", requestId: "", modelAvailable: available)
        }
        guard let message = try? JSONDecoder().decode(InboundMessage.self, from: data) else {
            return .error(.badSchema, sessionId: "", requestId: "", modelAvailable: available)
        }
        return await handle(message)
    }

    public func handle(_ message: InboundMessage) async -> HostReply {
        let available = modelAvailable()
        let fail = { (code: HostErrorCode) in
            HostReply.error(code, sessionId: message.sessionId, requestId: message.requestId, modelAvailable: available)
        }
        guard message.v == protocolVersion else { return fail(.badVersion) }
        guard !message.sessionId.isEmpty, !message.requestId.isEmpty else { return fail(.badSchema) }
        expireSessions()

        switch message.type {
        case "FORM_SNAPSHOT":
            return snapshot(message, fail: fail)
        case "SESSION_RESET":
            sessions[message.sessionId] = nil
            return HostReply(sessionId: message.sessionId, requestId: message.requestId, status: .ended, modelAvailable: available)
        case "USER_UTTERANCE", "FILL_RESULT", "FORM_STATUS":
            guard var session = sessions[message.sessionId] else { return fail(.unknownSession) }
            session.lastUsed = Date()
            let reply: HostReply
            if message.type == "USER_UTTERANCE" {
                guard let text = message.text, !text.isEmpty, text.count <= ProtocolLimits.maxUtteranceChars else {
                    return fail(.badSchema)
                }
                reply = await utterance(text, session: &session, message: message)
            } else {
                reply = status(message, session: &session)
            }
            sessions[message.sessionId] = session
            return reply
        default:
            return fail(.badSchema)
        }
    }

    // MARK: Handlers

    private func snapshot(_ message: InboundMessage, fail: (HostErrorCode) -> HostReply) -> HostReply {
        guard let origin = message.pageOrigin, let fields = message.fields else { return fail(.badSchema) }
        guard Self.isAllowedOrigin(origin) else { return fail(.originNotAllowed) }
        guard fields.count <= ProtocolLimits.maxFields,
              Set(fields.map(\.id)).count == fields.count,
              !fields.contains(where: { $0.id.isEmpty }) else { return fail(.badSchema) }

        var session = sessions[message.sessionId] ?? Session(origin: origin, order: [], fields: [:])
        guard session.origin == origin else { return fail(.originMismatch) }
        if sessions[message.sessionId] == nil, sessions.count >= Self.maxSessions,
           let oldest = sessions.min(by: { $0.value.lastUsed < $1.value.lastUsed })?.key {
            sessions[oldest] = nil
        }

        session.order = fields.map(\.id)
        session.fields = Dictionary(uniqueKeysWithValues: fields.map { field in
            var field = field
            field.label = String(field.label.prefix(ProtocolLimits.maxLabelChars))
            return (field.id, field)
        })
        session.filledByUs.formIntersection(session.order)
        session.lastUsed = Date()

        let reply = nextStep(&session, message: message, actions: [], note: nil)
        sessions[message.sessionId] = session
        return reply
    }

    private func utterance(_ text: String, session: inout Session, message: InboundMessage) async -> HostReply {
        let candidates = session.order.compactMap { session.fields[$0] }.filter(\.isFillable)
        var proposals: [Proposal]
        do {
            proposals = modelAvailable()
                ? try await primary.extract(utterance: text, fields: candidates, question: session.question)
                : try await fallback.extract(utterance: text, fields: candidates, question: session.question)
        } catch {
            proposals = (try? await fallback.extract(utterance: text, fields: candidates, question: session.question)) ?? []
        }
        proposals = HeuristicExtractor.completeFamilyName(proposals, utterance: text, fields: candidates)

        let actions = validate(proposals, utterance: text, session: session)
        let labels = actions.compactMap { session.fields[$0.fieldId]?.label }
        let note: String
        if labels.isEmpty {
            note = "I didn't find a value for this form in that answer."
        } else {
            note = "Filled \(Self.list(labels))."
        }
        return nextStep(&session, message: message, actions: actions, note: note)
    }

    private func status(_ message: InboundMessage, session: inout Session) -> HostReply {
        var failedLabels: [String] = []
        for result in message.results ?? [] {
            guard var field = session.fields[result.fieldId] else { continue }
            if result.success {
                field.currentValuePresent = true
                session.filledByUs.insert(field.id)
            } else {
                failedLabels.append(field.label)
            }
            session.fields[field.id] = field
        }
        // The extension's read-back of the page is the truth for what is still empty.
        for id in message.missingRequiredFieldIds ?? [] {
            session.fields[id]?.currentValuePresent = false
            session.filledByUs.remove(id)
        }
        session.issueFieldIds = (message.validationIssues ?? []).map(\.fieldId).filter { session.fields[$0] != nil }

        let note = failedLabels.isEmpty ? nil : "I couldn't fill \(Self.list(failedLabels))."
        return nextStep(&session, message: message, actions: [], note: note)
    }

    // MARK: Validation

    /// Keeps only proposals that pass every deterministic check.
    func validate(_ proposals: [Proposal], utterance: String, session: Session) -> [FillAction] {
        var actions: [FillAction] = []
        var seen: Set<String> = []
        let targeted = Set(session.question?.fieldIds ?? [])
        for proposal in proposals {
            guard !seen.contains(proposal.fieldId),
                  let field = session.fields[proposal.fieldId], field.isFillable,
                  let value = FieldRules.normalize(proposal.value, for: field),
                  FieldRules.isGrounded(value, field: field, utterance: utterance, isTargeted: targeted.contains(field.id))
            else { continue }
            // Never overwrite something the page or the user put there; only correct our own fills.
            let ours = session.filledByUs.contains(field.id)
            if field.currentValuePresent && !ours { continue }
            seen.insert(field.id)
            actions.append(FillAction(fieldId: field.id, value: value, overwrite: ours ? true : nil))
        }
        return actions
    }

    // MARK: Conversation

    private func nextStep(_ session: inout Session, message: InboundMessage, actions: [FillAction], note: String?) -> HostReply {
        let pending = Set(actions.map(\.fieldId))
        let fields = session.order.compactMap { session.fields[$0] }.filter(\.isFillable)
        let missing = fields.filter { $0.required && !$0.currentValuePresent && !pending.contains($0.id) }
        let issues = session.issueFieldIds.compactMap { session.fields[$0] }.filter { !pending.contains($0.id) }

        var reply = HostReply(sessionId: message.sessionId, requestId: message.requestId, status: .needsInput,
                              actions: actions, modelAvailable: modelAvailable())
        if let issue = issues.first {
            reply.question = Question(text: "The form says \"\(issue.label)\" needs fixing. What should it be?", fieldIds: [issue.id])
        } else if let first = missing.first {
            reply.question = Self.question(for: first, among: missing)
        } else {
            reply.status = .readyForReview
            let optional = fields.filter { !$0.required && !$0.currentValuePresent && !pending.contains($0.id) }.prefix(3).map(\.label)
            var text = "All required fields are filled. Please review the form and submit it yourself."
            if !optional.isEmpty { text += " Optional fields you can still add: \(Self.list(optional))." }
            reply.message = [note, text].compactMap { $0 }.joined(separator: " ")
        }
        if reply.message == nil { reply.message = note }
        session.question = reply.question
        return reply
    }

    static func question(for field: FormField, among missing: [FormField]) -> Question {
        if field.autocomplete == "given-name",
           let family = missing.first(where: { $0.autocomplete == "family-name" }) {
            return Question(text: "What's your first and last name?", fieldIds: [field.id, family.id])
        }
        let label = field.label.trimmingCharacters(in: .whitespacesAndNewlines)
        switch field.kind {
        case .select, .radioGroup:
            let options = (field.options ?? []).filter { !$0.value.isEmpty }.prefix(6).map(\.label)
            return Question(text: "\(label.hasSuffix("?") ? label : "Which \(label)?") Options: \(list(Array(options), joiner: "or")).", fieldIds: [field.id])
        case .checkbox:
            return Question(text: "Should I tick \"\(label)\"? Say yes or no.", fieldIds: [field.id])
        default:
            if label.hasSuffix("?") { return Question(text: label, fieldIds: [field.id]) }
            let lowered = label.count > 1 && label.dropFirst().first?.isLowercase == true
                ? label.prefix(1).lowercased() + label.dropFirst() : label
            return Question(text: "What's your \(lowered)?", fieldIds: [field.id])
        }
    }

    // MARK: Helpers

    static func isAllowedOrigin(_ origin: String) -> Bool {
        guard let url = URL(string: origin), let host = url.host() else { return false }
        switch url.scheme {
        case "https": return true
        case "http": return host == "localhost" || host == "127.0.0.1"
        default: return false
        }
    }

    static func list(_ items: [String], joiner: String = "and") -> String {
        switch items.count {
        case 0: ""
        case 1: items[0]
        default: items.dropLast().joined(separator: ", ") + " \(joiner) " + items.last!
        }
    }

    private func expireSessions() {
        let cutoff = Date().addingTimeInterval(-Self.sessionLifetime)
        sessions = sessions.filter { $0.value.lastUsed > cutoff }
    }
}
