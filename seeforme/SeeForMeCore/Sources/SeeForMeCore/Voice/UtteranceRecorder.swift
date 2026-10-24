import AVFoundation
import Foundation

/// Splits a stream of 16 kHz mono samples into utterances using a simple energy detector,
/// so only speech (not silence) is sent for transcription.
struct UtteranceSegmenter {
    static let sampleRate = 16_000.0
    var minThreshold: Float = 0.012
    var silenceToEnd = 0.8
    var minSpeech = 0.3
    var maxUtterance = 15.0
    var preRoll = 0.3

    private var noiseFloor: Float = 0.005
    private var speech: [Int16] = []
    private var history: [Int16] = []
    private var voicedSamples = 0
    private var silentSamples = 0
    private(set) var inSpeech = false
    var confirmedSpeech: Bool { inSpeech && voicedSamples >= Int(0.12 * Self.sampleRate) }

    /// Feeds one chunk. Returns a finished utterance as PCM data when one ends.
    mutating func append(_ samples: [Int16]) -> Data? {
        guard !samples.isEmpty else { return nil }
        let rms = Self.rms(samples)
        let threshold = max(minThreshold, noiseFloor * 3)
        let voiced = rms > threshold

        if !inSpeech {
            noiseFloor = voiced ? noiseFloor : noiseFloor * 0.95 + rms * 0.05
            history.append(contentsOf: samples)
            let keep = Int(preRoll * Self.sampleRate)
            if history.count > keep { history.removeFirst(history.count - keep) }
            guard voiced else { return nil }
            inSpeech = true
            speech = history
            history = []
            voicedSamples = samples.count
            silentSamples = 0
            return nil
        }

        speech.append(contentsOf: samples)
        if voiced {
            voicedSamples += samples.count
            silentSamples = 0
        } else {
            silentSamples += samples.count
        }
        let ended = Double(silentSamples) / Self.sampleRate >= silenceToEnd
        let tooLong = Double(speech.count) / Self.sampleRate >= maxUtterance
        guard ended || tooLong else { return nil }

        let enoughSpeech = Double(voicedSamples) / Self.sampleRate >= minSpeech
        let result = enoughSpeech ? speech.withUnsafeBufferPointer { Data(buffer: $0) } : nil
        reset()
        return result
    }

    mutating func reset() {
        speech = []
        history = []
        voicedSamples = 0
        silentSamples = 0
        inSpeech = false
    }

    static func rms(_ samples: [Int16]) -> Float {
        guard !samples.isEmpty else { return 0 }
        let sum = samples.reduce(Float(0)) { $0 + Float($1) * Float($1) }
        return (sum / Float(samples.count)).squareRoot() / Float(Int16.max)
    }
}

/// Captures the microphone and reports each finished utterance. Audio stays in memory only.
public final class UtteranceRecorder: @unchecked Sendable {
    private let engine = AVAudioEngine()
    private let lock = NSLock()
    private var segmenter = UtteranceSegmenter()
    private var paused = false
    private let voiceProcessing: Bool
    private var speechAnnounced = false
    private let onSpeechStart: @Sendable () -> Void
    private let onUtterance: @Sendable (Data) -> Void
    private let onLevel: @Sendable (Float) -> Void

    /// `onLevel` reports microphone loudness, 0…1, for every captured buffer.
    public init(onSpeechStart: @escaping @Sendable () -> Void, onUtterance: @escaping @Sendable (Data) -> Void,
                onLevel: @escaping @Sendable (Float) -> Void = { _ in }, voiceProcessing: Bool = true) {
        self.voiceProcessing = voiceProcessing
        self.onSpeechStart = onSpeechStart
        self.onUtterance = onUtterance
        self.onLevel = onLevel
    }

    public func start() throws {
        let input = engine.inputNode
        if voiceProcessing { try input.setVoiceProcessingEnabled(true) }
        let inFormat = input.outputFormat(forBus: 0)
        guard let outFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: UtteranceSegmenter.sampleRate, channels: 1, interleaved: true),
              let converter = AVAudioConverter(from: inFormat, to: outFormat) else {
            throw NSError(domain: "SeeForMe", code: 1, userInfo: [NSLocalizedDescriptionKey: "Microphone format not supported."])
        }
        converter.channelMap = [0]
        Diagnostics.record("voice.inputFormat", ["channels": "\(inFormat.channelCount)", "sampleRate": "\(inFormat.sampleRate)", "processed": "\(voiceProcessing)"])
        input.installTap(onBus: 0, bufferSize: 2048, format: inFormat) { [weak self] buffer, _ in
            guard let self, let samples = Self.convert(buffer, with: converter, to: outFormat) else { return }
            self.process(samples)
        }
        engine.prepare()
        try engine.start()
    }

    public func stop() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        lock.withLock { segmenter.reset() }
    }

    /// Ignores audio while paused, while transcribing or reasoning. Voice processing handles playback echo.
    public func setPaused(_ value: Bool) {
        lock.withLock {
            paused = value
            speechAnnounced = false
            segmenter.reset()
        }
    }

    private func process(_ samples: [Int16]) {
        onLevel(AudioLevel.normalized(rms: UtteranceSegmenter.rms(samples)))
        var started = false
        var finished: Data?
        lock.withLock {
            guard !paused else { return }
            finished = segmenter.append(samples)
            started = !speechAnnounced && segmenter.confirmedSpeech
            if started { speechAnnounced = true }
            if !segmenter.inSpeech { speechAnnounced = false }
        }
        if started { onSpeechStart() }
        if let finished { onUtterance(finished) }
    }

    private static func convert(_ buffer: AVAudioPCMBuffer, with converter: AVAudioConverter, to format: AVAudioFormat) -> [Int16]? {
        let ratio = format.sampleRate / buffer.format.sampleRate
        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 32
        guard let output = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: capacity) else { return nil }
        nonisolated(unsafe) var supplied = false
        nonisolated(unsafe) let source = buffer
        var error: NSError?
        converter.convert(to: output, error: &error) { _, status in
            if supplied {
                status.pointee = .noDataNow
                return nil
            }
            supplied = true
            status.pointee = .haveData
            return source
        }
        guard error == nil, let channel = output.int16ChannelData?[0] else { return nil }
        return Array(UnsafeBufferPointer(start: channel, count: Int(output.frameLength)))
    }
}
