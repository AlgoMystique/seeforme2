import Foundation

/// Decides when the extension has finished a turn and what SeeForMe should say.
///
/// One user answer produces several replies: a FORM_SNAPSHOT refresh, the USER_UTTERANCE reply
/// with actions, then the FILL_RESULT reply with the next question. Only the last one is spoken.
public enum VoiceTurn {
    public struct Speech: Equatable, Sendable {
        public var text: String
        public var question: String?

        public init(text: String, question: String?) {
            self.text = text
            self.question = question
        }
    }

    /// - Parameters:
    ///   - awaitingReply: a voice answer was sent and its turn hasn't finished yet.
    ///   - lastQuestion: the question most recently spoken, so a snapshot refresh doesn't repeat it.
    public static func speech(for reply: HostReplyBroadcast.Summary, awaitingReply: Bool, lastQuestion: String?) -> Speech? {
        if reply.status == .error {
            return Speech(text: "Sorry, that didn't work. Please try again.", question: lastQuestion)
        }
        // Submission confirmed: speak once the extension reports SUBMIT_RESULT.
        if reply.status == .submit { return nil }
        switch reply.requestType {
        case "FORM_SNAPSHOT":
            // Inspecting a form asks the first question; refreshes during a turn stay silent.
            guard !awaitingReply, let question = reply.question, question != lastQuestion else { return nil }
            return Speech(text: question, question: question)
        case "USER_UTTERANCE":
            // With actions, a FILL_RESULT reply follows and carries the next step.
            guard reply.filledCount == 0 else { return nil }
        case "FILL_RESULT", "FORM_STATUS", "SUBMIT_RESULT":
            break
        default:
            return nil
        }
        let text = [reply.message, reply.question].compactMap { $0 }.joined(separator: " ")
        return text.isEmpty ? nil : Speech(text: text, question: reply.question)
    }
}
