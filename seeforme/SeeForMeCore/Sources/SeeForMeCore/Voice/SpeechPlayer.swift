import AVFoundation
import Foundation

/// Plays one clip at a time and returns when playback ends.
@MainActor
public final class SpeechPlayer: NSObject, AVAudioPlayerDelegate {
    private var player: AVAudioPlayer?
    private var engine: AVAudioEngine?
    private var streamNode: AVAudioPlayerNode?
    private var generation = UUID()
    private var queuedBuffers = 0
    private var finished: CheckedContinuation<Void, Never>?
    private var metering: Task<Void, Never>?
    /// Playback loudness, 0…1, about 30 times a second while audio plays.
    public var onLevel: ((Float) -> Void)?

    public override init() {}

    public func play(_ audio: Data) async throws {
        stop()
        let player = try AVAudioPlayer(data: audio)
        player.delegate = self
        player.isMeteringEnabled = true
        self.player = player
        await withCheckedContinuation { continuation in
            finished = continuation
            if player.play() {
                startMetering()
            } else {
                finish()
            }
        }
    }

    /// Raw signed little-endian PCM from the native ElevenLabs streaming endpoint.
    public func playStream(_ chunks: AsyncThrowingStream<Data, Error>, onStart: () -> Void) async throws {
        stop()
        let token = generation
        let engine = AVAudioEngine(), node = AVAudioPlayerNode()
        let format = AVAudioFormat(standardFormatWithSampleRate: 24000, channels: 1)!
        engine.attach(node); engine.connect(node, to: engine.mainMixerNode, format: format)
        self.engine = engine; streamNode = node
        engine.mainMixerNode.installTap(onBus: 0, bufferSize: 1024, format: nil) { @Sendable [weak self] buffer, _ in
            guard let samples = buffer.floatChannelData?[0], buffer.frameLength > 0 else { return }
            var sum: Float = 0
            for i in 0..<Int(buffer.frameLength) { sum += samples[i] * samples[i] }
            let level = min(1, sqrt(sum / Float(buffer.frameLength)) * 4)
            Task { @MainActor in
                guard let self, self.generation == token else { return }
                self.onLevel?(level)
            }
        }
        if !engine.isRunning { try engine.start() }
        var began = false
        defer { if token == generation { stop() } }
        for try await data in chunks {
            guard token == generation else { return }
            let bufferWait = ContinuousClock.now
            while queuedBuffers >= 10 {
                if bufferWait.duration(to: .now) > .seconds(5) { throw ElevenLabsClient.Failure.badResponse }
                try await Task.sleep(for: .milliseconds(20))
                guard token == generation else { return }
            }
            guard data.count % 2 == 0, let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(data.count / 2)) else { throw ElevenLabsClient.Failure.badResponse }
            buffer.frameLength = buffer.frameCapacity
            for index in 0..<Int(buffer.frameLength) {
                let raw = UInt16(data[index*2]) | UInt16(data[index*2+1]) << 8
                let sample = Float(Int16(bitPattern: raw)) / 32768
                buffer.floatChannelData![0][index] = sample
            }
            queuedBuffers += 1
            node.scheduleBuffer(buffer, completionCallbackType: .dataPlayedBack) { @Sendable [weak self] _ in
                Task { @MainActor in
                    guard let self, self.generation == token else { return }
                    self.queuedBuffers -= 1
                }
            }
            if !began { began = true; node.play(); onStart() }
        }
        let drainStart = ContinuousClock.now
        while token == generation && queuedBuffers > 0 {
            if drainStart.duration(to: .now) > .seconds(5) { throw ElevenLabsClient.Failure.badResponse }
            try await Task.sleep(for: .milliseconds(20))
        }
    }

    public func stop() {
        generation = UUID(); queuedBuffers = 0
        streamNode?.stop()
        if let engine {
            engine.mainMixerNode.removeTap(onBus: 0)
            if let streamNode { engine.detach(streamNode) }
            engine.stop()
        }
        streamNode = nil; engine = nil
        onLevel?(0)
        player?.stop()
        finish()
    }

    private func startMetering() {
        metering = Task { [weak self] in
            while !Task.isCancelled {
                guard let self, let player = self.player else { return }
                player.updateMeters()
                self.onLevel?(AudioLevel.normalized(decibels: player.averagePower(forChannel: 0)))
                try? await Task.sleep(for: .milliseconds(33))
            }
        }
    }

    private func finish() {
        metering?.cancel()
        metering = nil
        if player != nil { onLevel?(0) }
        player = nil
        finished?.resume()
        finished = nil
    }

    public nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in self.finish() }
    }

    public nonisolated func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        Task { @MainActor in self.finish() }
    }
}
