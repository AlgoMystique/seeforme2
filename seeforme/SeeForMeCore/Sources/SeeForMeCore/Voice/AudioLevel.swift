import Foundation

/// Maps audio loudness to 0…1 for the call bar waveform: -50 dBFS (silence) → 0, -10 dBFS (loud speech) → 1.
public enum AudioLevel {
    public static func normalized(decibels: Float) -> Float {
        guard decibels.isFinite else { return 0 }
        return min(1, max(0, (decibels + 50) / 40))
    }

    public static func normalized(rms: Float) -> Float {
        rms > 0 ? normalized(decibels: 20 * log10(rms)) : 0
    }
}
