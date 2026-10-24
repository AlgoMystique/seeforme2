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
        public var status: ReplyStatus
        public var question: String?
        public var message: String?
        public var modelAvailable: Bool
        public var filledCount: Int
    }

    public static func summary(of reply: HostReply) -> Summary {
        Summary(status: reply.status, question: reply.question?.text, message: reply.message,
                modelAvailable: reply.modelAvailable, filledCount: reply.actions.count)
    }

    public static func post(_ reply: HostReply) {
        guard let data = try? JSONEncoder().encode(summary(of: reply)),
              let json = String(data: data, encoding: .utf8) else { return }
        DistributedNotificationCenter.default().postNotificationName(name, object: json, userInfo: nil, deliverImmediately: true)
    }

    public static func decode(_ notification: Notification) -> Summary? {
        guard let json = notification.object as? String else { return nil }
        return try? JSONDecoder().decode(Summary.self, from: Data(json.utf8))
    }
}
