import Foundation

/// Safari → native app voice control (PROTOCOL.md section 12). The extension process relays these
/// to the app as a distributed notification whose object is the raw value. Carries no content.
public enum VoiceCommand: String, Sendable {
    case start = "VOICE_START"
    case stop = "VOICE_STOP"
    case mute = "VOICE_MUTE"
    case unmute = "VOICE_UNMUTE"

    public static let notificationName = Notification.Name("com.seeforme.app.voiceCommand")

    public func post(language: String? = nil, voiceId: String? = nil) {
        var object = rawValue
        if language != nil || voiceId != nil {
            var payload = ["command": rawValue]
            payload["language"] = language; payload["voiceId"] = voiceId
            if let data = try? JSONSerialization.data(withJSONObject: payload),
               let json = String(data: data, encoding: .utf8) { object = json }
        }
        DistributedNotificationCenter.default().postNotificationName(Self.notificationName, object: object,
                                                                     userInfo: nil, deliverImmediately: true)
    }
}
