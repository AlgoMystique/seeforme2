import Foundation

/// Running ElevenLabs usage for this app session, priced at the published API rates.
public struct VoiceUsage: Sendable, Equatable {
    /// USD per 1,000 characters, Flash v2.5 text-to-speech.
    public static let ttsPerThousandChars = 0.04
    /// USD per audio hour, Scribe v2 batch speech-to-text.
    public static let sttPerHour = 0.22

    public var ttsCharacters = 0
    public var sttSeconds = 0.0
    public var ttsRequests = 0
    public var sttRequests = 0

    public init() {}

    public mutating func addSpeech(_ text: String) {
        ttsCharacters += text.count
        ttsRequests += 1
    }

    /// `pcmBytes` of 16 kHz mono 16-bit audio.
    public mutating func addTranscription(pcmBytes: Int) {
        sttSeconds += Double(pcmBytes) / 32_000
        sttRequests += 1
    }

    public var estimatedCost: Double {
        Double(ttsCharacters) / 1000 * Self.ttsPerThousandChars + sttSeconds / 3600 * Self.sttPerHour
    }

    public var summary: String {
        "\(ttsCharacters) chars spoken (\(ttsRequests) requests), \(String(format: "%.1f", sttSeconds)) s transcribed (\(sttRequests) requests) ≈ $\(String(format: "%.4f", estimatedCost))"
    }
}
