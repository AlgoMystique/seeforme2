import Foundation

/// Lets the native app follow the conversation that the Safari extension process is running,
/// so it can show and speak the current question.
///
/// Sandboxed processes may only send a string object with distributed notifications, and any
/// local process can observe them, so this carries the status and question text only — never
/// field values or user answers.
public enum HostReplyBroadcast {
    public static let name = Notification.Name("com.seeforme.app.hostReply")

    public struct Summary: Codable, Sendable, Equatable {
        /// The extension message type this reply answers, e.g. `USER_UTTERANCE`.
        public var utteranceId: String? = nil
        public var streamSequence: Int? = nil
        public var streamFinal: Bool? = nil
        public var conversationLanguage: String? = nil
        public var requestType: String?
        public var status: ReplyStatus
        public var question: String?
        public var message: String?
        public var modelAvailable: Bool
        public var filledCount: Int
    }

    public static func summary(of reply: HostReply, requestType: String?) -> Summary {
        Summary(conversationLanguage: reply.conversationLanguage, requestType: requestType, status: reply.status, question: reply.question?.text, message: reply.message,
                modelAvailable: reply.modelAvailable, filledCount: reply.actions.count)
    }

    public static func post(_ reply: HostReply, requestType: String?, utteranceId: String? = nil) {
        var value = summary(of: reply, requestType: requestType)
        value.utteranceId = utteranceId
        postSummary(value)
    }

    public static func postSentence(_ text: String, utteranceId: String, sequence: Int, final: Bool) {
        var value = Summary(requestType: "SPEECH_CHUNK", status: .needsInput, question: nil, message: text, modelAvailable: true, filledCount: 0)
        value.utteranceId = utteranceId; value.streamSequence = sequence; value.streamFinal = final
        postSummary(value)
    }

    private static func postSummary(_ value: Summary) {
        guard let data = try? JSONEncoder().encode(value),
              let json = String(data: data, encoding: .utf8) else { return }
        DistributedNotificationCenter.default().postNotificationName(name, object: json, userInfo: nil, deliverImmediately: true)
    }

    public static func decode(_ notification: Notification) -> Summary? {
        guard let json = notification.object as? String else { return nil }
        return try? JSONDecoder().decode(Summary.self, from: Data(json.utf8))
    }
}
