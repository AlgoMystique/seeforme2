import Foundation

public enum VoicePreferences {
    public static let voices = [
        ["id": ElevenLabsClient.defaultVoiceId, "name": "George"],
        ["id": "21m00Tcm4TlvDq8ikWAM", "name": "Rachel"],
        ["id": "EXAVITQu4vr4xnSDxMaL", "name": "Sarah"]
    ]
    public static func validVoice(_ id: String) -> Bool { voices.contains { $0["id"] == id } }
}
