import Foundation

/// Native app → extension push describing what the voice pipeline is actually doing (PROTOCOL.md section 11).
/// Carries no transcript, spoken text, or form content.
public struct VoiceStatePush: Codable, Sendable, Equatable {
    public enum Activity: String, Codable, Sendable {
        /// Voice is off.
        case idle
        /// Microphone is live and waiting for, or hearing, speech.
        case listening
        /// A finished utterance is being transcribed by ElevenLabs.
        case transcribing
        /// The answer is being processed (on-device reasoning, form filling) or the reply's audio is being prepared.
        case thinking
        /// Reply audio is playing right now.
        case speaking
        /// The last voice step failed; `message` says why.
        case error
    }

    public static let ttlMs = 15_000
    public static let heartbeat: Duration = .seconds(5)
    /// Minimum spacing of level updates while listening or speaking (about 10 per second).
    public static let levelInterval: Duration = .milliseconds(100)

    public var v = protocolVersion
    public var type = "VOICE_STATE"
    public var state: Activity
    /// Only with `listening`: speech is currently being detected.
    public var speechDetected: Bool?
    /// Only with `error`: short, content-free description.
    public var message: String?
    /// Identifies this app launch; `seq` restarts when it changes.
    public var instanceId: String
    /// Increases with every push from this instance, including heartbeats.
    public var seq: Int
    /// Show this state for at most this long unless another VOICE_STATE arrives.
    public var ttlMs = VoiceStatePush.ttlMs
    /// Only with `listening` (microphone) or `speaking` (playback): real loudness 0…1 (revision 1.4).
    public var level: Double?
    /// Spoken replies are muted (revision 1.4).
    public var muted: Bool

    public init(state: Activity, speechDetected: Bool? = nil, message: String? = nil, instanceId: String, seq: Int,
                level: Double? = nil, muted: Bool = false) {
        self.state = state
        self.speechDetected = speechDetected
        self.message = message
        self.instanceId = instanceId
        self.seq = seq
        self.level = level
        self.muted = muted
    }

    public func jsonObject() -> [String: Any] {
        guard let data = try? JSONEncoder().encode(self),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
        return dict
    }
}

/// Numbers VOICE_STATE pushes for one app launch.
public struct VoiceStateSequencer: Sendable {
    public let instanceId = UUID().uuidString
    private var seq = 0
    public private(set) var current: VoiceStatePush.Activity = .idle
    private var speechDetected: Bool?
    private var message: String?
    public private(set) var muted = false

    public init() {}

    /// Records a new state and returns the push for it.
    public mutating func push(_ state: VoiceStatePush.Activity, speechDetected: Bool? = nil, message: String? = nil) -> VoiceStatePush {
        current = state
        self.speechDetected = state == .listening ? speechDetected : nil
        self.message = state == .error ? message : nil
        return repeatCurrent()
    }

    /// The current state again with a new sequence number, for heartbeats.
    public mutating func repeatCurrent() -> VoiceStatePush {
        seq += 1
        return VoiceStatePush(state: current, speechDetected: speechDetected, message: message, instanceId: instanceId, seq: seq, muted: muted)
    }

    /// The current state with a live audio level; nil unless listening or speaking.
    public mutating func level(_ value: Float) -> VoiceStatePush? {
        guard current == .listening || current == .speaking else { return nil }
        var push = repeatCurrent()
        push.level = (Double(min(1, max(0, value))) * 100).rounded() / 100
        return push
    }

    /// Records a mute change and returns the push announcing it.
    public mutating func setMuted(_ value: Bool) -> VoiceStatePush {
        muted = value
        return repeatCurrent()
    }
}
