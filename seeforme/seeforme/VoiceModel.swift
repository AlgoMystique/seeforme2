import AVFoundation
import Foundation
import Observation
import SeeForMeCore

/// Two-way voice: microphone → ElevenLabs speech-to-text → extension (on-device reasoning) → ElevenLabs speech.
/// Echo-cancelled microphone capture permits interruption during spoken replies.
@Observable
final class VoiceModel {
    enum State: Equatable {
        case off, listening, hearing, transcribing, thinking, preparingSpeech, speaking
        case error(String)

        var label: String {
            switch self {
            case .off: "Voice off"
            case .listening: "Listening…"
            case .hearing: "Hearing you…"
            case .transcribing: "Transcribing (ElevenLabs)…"
            case .thinking: "Thinking on-device…"
            case .preparingSpeech: "Preparing speech (ElevenLabs)…"
            case .speaking: "Speaking…"
            case .error(let message): message
            }
        }

        /// Content-free name for diagnostics.
        var code: String {
            switch self {
            case .off: "off"
            case .listening: "listening"
            case .hearing: "hearing"
            case .transcribing: "transcribing"
            case .thinking: "thinking"
            case .preparingSpeech: "preparingSpeech"
            case .speaking: "speaking"
            case .error: "error"
            }
        }
    }

    static let voiceIdKey = "elevenLabsVoiceId"
    static let replyTimeout: Duration = .seconds(90)

    private(set) var state: State = .off {
        didSet {
            guard state != oldValue else { return }
            Diagnostics.record("voice.state", ["from": oldValue.code, "to": state.code, "ms": Diagnostics.ms(since: stateSince)])
            stateSince = .now
            if !hasAudio { levels = Self.silence }
            onStateChange?(state)
        }
    }
    /// Recent loudness (0…1, oldest first) of the microphone while listening or of playback while speaking.
    /// Drives the call bar waveform; all zeros when no audio is flowing.
    private(set) var levels = VoiceModel.silence
    /// Spoken replies are skipped (not generated) while muted; questions still appear in Safari.
    private(set) var muted = false

    static let silence = [Float](repeating: 0, count: 6)

    /// Whether `levels` currently reflects live audio.
    var hasAudio: Bool { [.listening, .hearing, .speaking].contains(state) }
    /// ElevenLabs usage since the app launched, and the running total kept across launches (numbers only).
    private(set) var usage = VoiceUsage()
    private(set) var totalUsage = VoiceModel.loadTotal()
    private(set) var hasKey = KeychainStore.exists()
    /// Last transcript, shown on screen only. Kept in memory, never logged or stored.
    private(set) var lastHeard: String?
    var voiceId = UserDefaults.standard.string(forKey: voiceIdKey) ?? ElevenLabsClient.defaultVoiceId {
        didSet { UserDefaults.standard.set(voiceId, forKey: Self.voiceIdKey) }
    }

    /// Sends a transcript to the extension; the callback reports whether it was delivered.
    @ObservationIgnored var sendUtterance: ((String, String, @escaping (Bool) -> Void) -> Void)?
    /// Called on every real state change, to mirror it to the Safari panel (VOICE_STATE).
    @ObservationIgnored var onStateChange: ((State) -> Void)?
    /// Called with each live audio level (microphone while listening, playback while speaking).
    @ObservationIgnored var onLevel: ((Float) -> Void)?
    /// Called when mute changes.
    @ObservationIgnored var onMuteChange: ((Bool) -> Void)?

    var conversationLanguage = ConversationLanguage.system

    static let greeting = "Hi, I'm SeeForMe."

    @ObservationIgnored private var recorder: UtteranceRecorder?
    @ObservationIgnored private let player = SpeechPlayer()
    @ObservationIgnored private var client: ElevenLabsClient?
    @ObservationIgnored private var lastQuestion: String?
    @ObservationIgnored private var awaitingReply = false
    @ObservationIgnored private var saying = false
    /// A question that became ready while SeeForMe was still talking (e.g. during the greeting).
    @ObservationIgnored private var pendingSpeech: VoiceTurn.Speech?
    @ObservationIgnored private var streamedSpeech: [VoiceTurn.Speech] = []
    @ObservationIgnored private var voiceEpoch = UUID()
    @ObservationIgnored private var utteranceId: String?
    @ObservationIgnored private var streamedSequence = -1
    @ObservationIgnored private var streamComplete = false
    @ObservationIgnored private var timeout: Task<Void, Never>?
    @ObservationIgnored private var stateSince = ContinuousClock.now

    var isOn: Bool { state != .off }

    // MARK: Key

    func saveKey(_ key: String) {
        let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        do {
            try KeychainStore.save(trimmed)
            hasKey = true
        } catch {
            state = .error("Couldn't save the key to the Keychain.")
        }
    }

    func removeKey() {
        stop()
        KeychainStore.delete()
        hasKey = false
    }

    // MARK: Session

    func start(currentQuestion: String?) async {
        let key = KeychainStore.load()
        Diagnostics.record("voice.start", ["keyFound": "\(key != nil)", "hasQuestion": "\(currentQuestion != nil)"])
        guard let key else {
            state = .error("Add your ElevenLabs API key first.")
            return resumeAfterError()
        }
        let micGranted = await AVCaptureDevice.requestAccess(for: .audio)
        Diagnostics.record("voice.mic", ["granted": "\(micGranted)"])
        guard micGranted else {
            state = .error("Microphone access is off. Allow it in System Settings › Privacy & Security › Microphone.")
            return resumeAfterError()
        }
        client = ElevenLabsClient(apiKey: key, voiceId: voiceId)
        let recorder = UtteranceRecorder(
            onSpeechStart: { Task { @MainActor [weak self] in self?.speechStarted() } },
            onUtterance: { audio in Task { @MainActor [weak self] in await self?.heard(audio) } },
            onLevel: { level in Task { @MainActor [weak self] in self?.micLevel(level) } })
        player.onLevel = { [weak self] level in
            guard let self, self.state == .speaking else { return }
            self.push(level)
        }
        do {
            try recorder.start()
        } catch {
            Diagnostics.record("voice.recorder", ["started": "false"])
            state = .error("Couldn't start the microphone.")
            return resumeAfterError()
        }
        self.recorder = recorder
        // Activate the session before say(), which deliberately rejects stopped sessions.
        state = .preparingSpeech
        lastQuestion = nil
        pendingSpeech = nil
        var greeting = Self.greeting
        if !ConversationLanguage.same(conversationLanguage, "en") {
            do { greeting = try await LocalConversationReasoner().translate(Self.greeting, language: conversationLanguage) }
            catch { state = .error("This language is unavailable. Choose a supported language in Safari."); return resumeAfterError() }
        }
        let text = [greeting, currentQuestion].compactMap { $0 }.joined(separator: " ")
        await say(VoiceTurn.Speech(text: text, question: currentQuestion))
    }

    func stop() {
        timeout?.cancel()
        voiceEpoch = UUID(); saying = false
        utteranceId = nil; streamedSpeech = []; streamedSequence = -1; streamComplete = false
        player.stop()
        recorder?.stop()
        recorder = nil
        client = nil
        awaitingReply = false
        pendingSpeech = nil
        setMuted(false)
        state = .off
    }

    func toggleMute() {
        setMuted(!muted)
    }

    func setMuted(_ value: Bool) {
        guard value != muted else { return }
        muted = value
        Diagnostics.record("voice.mute", ["muted": "\(muted)", "state": state.code])
        onMuteChange?(muted)
        // Cut off the current reply immediately; the conversation continues by listening.
        if muted, state == .speaking || state == .preparingSpeech { player.stop() }
    }

    private func micLevel(_ level: Float) {
        guard state == .listening || state == .hearing else { return }
        push(level)
    }

    private func push(_ level: Float) {
        levels.removeFirst()
        levels.append(level)
        onLevel?(level)
    }

    /// Called for every reply the extension process broadcasts.
    func hostReplied(_ reply: HostReplyBroadcast.Summary) {
        func note(_ decision: String) {
            Diagnostics.record("voice.reply", ["type": reply.requestType ?? "-", "status": reply.status.rawValue, "filled": "\(reply.filledCount)",
                                               "hasQuestion": "\(reply.question != nil)", "awaiting": "\(awaitingReply)", "decision": decision])
        }
        guard isOn else { return note("skip:voiceOff") }
        if reply.requestType == "USER_UTTERANCE", let id = reply.utteranceId, id != utteranceId { return note("skip:staleTurn") }
        if reply.requestType == "SPEECH_CHUNK" {
            guard reply.utteranceId == utteranceId, utteranceId != nil,
                  let seq = reply.streamSequence, seq == streamedSequence + 1, !streamComplete,
                  let text = reply.message, text.count <= 1000 else { return }
            streamedSequence = seq
            streamComplete = reply.streamFinal == true
            if !text.isEmpty && !muted { streamedSpeech.append(.init(text: text, question: nil)) }
            if streamComplete { awaitingReply = false; timeout?.cancel() }
            if !saying, !streamedSpeech.isEmpty {
                let next = streamedSpeech.removeFirst()
                // Mark synchronously so a second chunk cannot start overlapping playback.
                saying = true
                Task { await say(next) }
            } else if streamComplete, !saying { listen() }
            return
        }
        if reply.requestType == "USER_UTTERANCE", reply.utteranceId == utteranceId, streamedSequence >= 0 {
            if streamComplete {
                lastQuestion = reply.question
                return note("skip:alreadyStreamed")
            }
            // Generation failed after a partial sentence. Stop that stream and speak the final recovery reply.
            streamComplete = true; streamedSpeech = []
        }
        if reply.requestType == "SESSION_RESET" {
            lastQuestion = nil; utteranceId = nil; streamedSpeech = []; streamedSequence = -1; streamComplete = true
            voiceEpoch = UUID(); saying = false; pendingSpeech = nil; awaitingReply = false; timeout?.cancel(); player.stop()
            listen()
            return
        }
        guard let speech = VoiceTurn.speech(for: reply, awaitingReply: awaitingReply, lastQuestion: lastQuestion) else {
            return note("skip:turnNotFinished")
        }
        if saying, !awaitingReply {
            // Still talking (e.g. the greeting): say this next instead of dropping it.
            pendingSpeech = speech
            return note("queued")
        }
        note("speak")
        awaitingReply = false
        timeout?.cancel()
        Task { await say(speech) }
    }

    // MARK: Turn steps

    private func listen() {
        guard recorder != nil else { return }
        recorder?.setPaused(false)
        state = .listening
    }

    private func speechStarted() {
        if state == .speaking || state == .preparingSpeech || (state == .thinking && streamedSequence >= 0) {
            // Retain the recorder's pre-roll and current utterance; do not reset it.
            voiceEpoch = UUID(); saying = false; utteranceId = nil
            streamedSpeech = []; pendingSpeech = nil; streamedSequence = -1; streamComplete = true
            awaitingReply = false; timeout?.cancel(); player.stop()
            state = .hearing
            Diagnostics.record("voice.interrupted")
        } else if state == .listening { state = .hearing }
    }

    private func heard(_ audio: Data) async {
        guard state == .listening || state == .hearing, let client else { return }
        recorder?.setPaused(true)
        state = .transcribing
        let text: String
        record { $0.addTranscription(pcmBytes: audio.count) }
        let sttStart = ContinuousClock.now
        do {
            text = try await client.transcribe(pcm: audio)
        } catch {
            Diagnostics.record("voice.stt", ["ok": "false", "error": Self.code(error), "ms": Diagnostics.ms(since: sttStart)])
            fail(error)
            return
        }
        Diagnostics.record("voice.stt", ["ok": "true", "empty": "\(text.isEmpty)", "audioMs": "\(audio.count / 32)", "ms": Diagnostics.ms(since: sttStart)])
        guard isOn else { return }
        guard !text.isEmpty else { return listen() }
        lastHeard = text
        state = .thinking
        awaitingReply = true
        let turnId = UUID().uuidString
        utteranceId = turnId; streamedSequence = -1; streamComplete = false; streamedSpeech = []
        sendUtterance?(text, turnId) { [weak self] delivered in
            Diagnostics.record("voice.userInput", ["delivered": "\(delivered)"])
            guard let self, !delivered, self.awaitingReply else { return }
            self.awaitingReply = false
            self.state = .error("Couldn't reach the form. Click Inspect form in Safari, then try again.")
            self.resumeAfterError()
        }
        timeout?.cancel()
        timeout = Task { [weak self] in
            try? await Task.sleep(for: Self.replyTimeout)
            guard !Task.isCancelled, let self, self.awaitingReply else { return }
            Diagnostics.record("voice.replyTimeout", ["seconds": "90"])
            self.awaitingReply = false
            self.state = .error("No reply from Safari. Check the SeeForMe panel.")
            self.resumeAfterError()
        }
    }

    private func say(_ speech: VoiceTurn.Speech) async {
        guard let client, isOn, state != .hearing, state != .transcribing else { return }
        let epoch = voiceEpoch
        saying = true
        defer { if voiceEpoch == epoch { saying = false } }
        recorder?.setPaused(false)
        // Fetching audio is still preparation; "speaking" starts only when playback starts.
        state = .preparingSpeech
        lastQuestion = speech.question ?? lastQuestion
        guard !muted else {
            Diagnostics.record("voice.tts", ["skipped": "muted"])
            if streamedSequence >= 0 && !streamComplete { state = .thinking; return }
            return listen()
        }
        record { $0.addSpeech(speech.text) }
        let ttsStart = ContinuousClock.now
        do {
            try await player.playStream(client.speechStream(speech.text)) { [weak self] in
                guard let self, self.voiceEpoch == epoch, self.isOn, !self.muted else { return }
                self.state = .speaking
                Diagnostics.record("voice.firstAudio", ["ms": Diagnostics.ms(since: ttsStart)])
            }
            Diagnostics.record("voice.playback", ["ok": "true", "streamed": "true", "ms": Diagnostics.ms(since: ttsStart)])
        } catch {
            Diagnostics.record("voice.tts", ["ok": "false", "error": Self.code(error), "ms": Diagnostics.ms(since: ttsStart)])
            guard isOn, voiceEpoch == epoch else { return }
            fail(error)
            return
        }
        guard isOn, voiceEpoch == epoch else { return }
        if !streamedSpeech.isEmpty {
            let next = streamedSpeech.removeFirst()
            saying = false
            return await say(next)
        }
        if streamedSequence >= 0 && !streamComplete { state = .thinking; return }
        if let next = pendingSpeech {
            pendingSpeech = nil
            saying = false
            return await say(next)
        }
        listen()
    }

    // MARK: Usage

    private static let totalKey = "elevenLabsUsageTotal"

    func record(_ change: (inout VoiceUsage) -> Void) {
        change(&usage)
        change(&totalUsage)
        UserDefaults.standard.set([totalUsage.ttsCharacters, totalUsage.ttsRequests, totalUsage.sttRequests, Int(totalUsage.sttSeconds * 1000)],
                                  forKey: Self.totalKey)
    }

    private static func loadTotal() -> VoiceUsage {
        var total = VoiceUsage()
        guard let saved = UserDefaults.standard.array(forKey: totalKey) as? [Int], saved.count == 4 else { return total }
        total.ttsCharacters = saved[0]
        total.ttsRequests = saved[1]
        total.sttRequests = saved[2]
        total.sttSeconds = Double(saved[3]) / 1000
        return total
    }

    /// Content-free error code for diagnostics.
    static func code(_ error: Error) -> String {
        if let failure = error as? ElevenLabsClient.Failure {
            return switch failure {
            case .invalidKey: "invalidKey"
            case .quotaOrRateLimit: "quotaOrRateLimit"
            case .http(let status): "http\(status)"
            case .badResponse: "badResponse"
            }
        }
        let ns = error as NSError
        return "\(ns.domain)#\(ns.code)"
    }

    private func fail(_ error: Error) {
        utteranceId = nil; streamedSpeech = []; streamComplete = true; awaitingReply = false; timeout?.cancel()
        state = .error((error as? LocalizedError)?.errorDescription ?? "Voice request failed.")
        resumeAfterError()
    }

    /// Shows the error briefly, then goes back to listening (or off, if voice never started).
    private func resumeAfterError() {
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(3))
            guard let self, case .error = self.state else { return }
            if self.recorder == nil {
                self.state = .off
            } else {
                self.listen()
            }
        }
    }
}
