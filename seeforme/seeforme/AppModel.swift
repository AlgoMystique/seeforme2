import AppKit
import AVFoundation
import Foundation
import Observation
import SafariServices
import SeeForMeCore
import SwiftUI

/// The background voice host. Lives for the whole app run, independent of any window:
/// Safari starts, stops and mutes voice through VoiceCommand; the settings window is only for setup.
@Observable
final class AppModel {
    static let extensionIdentifier = "com.seeforme.app.extension"
    static let shared = AppModel()
    /// Debug fallback only: the native floating call bar. The user-facing call bar is in Safari.
    static let nativeCallBarKey = "nativeCallBar"

    var modelProblem: String? = FoundationModelExtractor.unavailableReason
    var extensionEnabled: Bool?
    var latest: HostReplyBroadcast.Summary?
    var sendError: String?
    var selfTestResult: String?
    let voice: VoiceModel

    @ObservationIgnored private var observer: NSObjectProtocol?
    @ObservationIgnored private var commandObserver: NSObjectProtocol?
    @ObservationIgnored private let callBar: CallBarController
    @ObservationIgnored private var voiceStates = VoiceStateSequencer()
    @ObservationIgnored private var heartbeat: Task<Void, Never>?
    @ObservationIgnored private var lastLevelSent = ContinuousClock.now
    @ObservationIgnored private var window: NSWindow?

    private init() {
        let voice = VoiceModel()
        self.voice = voice
        callBar = CallBarController(voice: voice)
        observer = DistributedNotificationCenter.default().addObserver(
            forName: HostReplyBroadcast.name, object: nil, queue: .main
        ) { [weak self] notification in
            guard let summary = HostReplyBroadcast.decode(notification) else {
                return Diagnostics.record("app.broadcast", ["decoded": "false"])
            }
            MainActor.assumeIsolated {
                self?.latest = summary
                if let language = summary.conversationLanguage { self?.voice.conversationLanguage = language }
                self?.voice.hostReplied(summary)
            }
        }
        voice.sendUtterance = { [weak self] text, utteranceId, delivered in
            self?.send(text, source: "voice", utteranceId: utteranceId, delivered: delivered)
        }
        voice.onStateChange = { [weak self] state in self?.publishVoiceState(state) }
        voice.onLevel = { [weak self] level in self?.publishLevel(level) }
        voice.onMuteChange = { [weak self] muted in
            guard let self else { return }
            self.dispatch(self.voiceStates.setMuted(muted))
        }
        commandObserver = DistributedNotificationCenter.default().addObserver(
            forName: VoiceCommand.notificationName, object: nil, queue: .main
        ) { [weak self] notification in
            guard let object = notification.object as? String else { return }
            let config = (try? JSONSerialization.jsonObject(with: Data(object.utf8))) as? [String: String]
            guard let command = VoiceCommand(rawValue: config?["command"] ?? object) else { return }
            if let language = config?["language"], ConversationLanguage.supported(language) {
                self?.voice.conversationLanguage = language
            }
            if let id = config?["voiceId"], VoicePreferences.validVoice(id) { self?.voice.voiceId = id }
            Diagnostics.record("app.command", ["command": command.rawValue])
            MainActor.assumeIsolated { self?.handle(command) }
        }
    }

    // MARK: VOICE_START / VOICE_STOP from Safari (PROTOCOL.md section 12)

    func handle(_ command: VoiceCommand) {
        switch command {
        case .start:
            guard !voice.isOn else { return Diagnostics.record("app.command.ignored", ["reason": "alreadyOn"]) }
            Task {
                await voice.start(currentQuestion: latest?.question)
                // Setup problems (no key, microphone off) need the settings window to fix.
                if case .error = voice.state { showWindow() }
            }
        case .stop:
            voice.stop()
        case .mute:
            voice.setMuted(true)
        case .unmute:
            voice.setMuted(false)
        }
    }

    // MARK: Settings window (setup and debugging only)

    func showWindow() {
        if window == nil {
            let window = NSWindow(contentViewController: NSHostingController(rootView: ContentView(model: self)))
            window.title = "SeeForMe Settings"
            window.isReleasedWhenClosed = false
            self.window = window
        }
        NSApp.activate()
        window?.makeKeyAndOrderFront(nil)
    }

    // MARK: VOICE_STATE (PROTOCOL.md section 11)

    /// Mirrors the voice pipeline's real state to the Safari panel. Re-sent every few seconds while active,
    /// so the panel falls back to idle by itself if the app stops sending.
    private func publishVoiceState(_ state: VoiceModel.State) {
        let push = switch state {
        case .off: voiceStates.push(.idle)
        case .listening: voiceStates.push(.listening, speechDetected: false)
        case .hearing: voiceStates.push(.listening, speechDetected: true)
        case .transcribing: voiceStates.push(.transcribing)
        case .thinking, .preparingSpeech: voiceStates.push(.thinking)
        case .speaking: voiceStates.push(.speaking)
        case .error(let message): voiceStates.push(.error, message: message)
        }
        dispatch(push)
        callBar.setVisible(state != .off && UserDefaults.standard.bool(forKey: Self.nativeCallBarKey))
        heartbeat?.cancel()
        guard push.state != .idle else { return }
        heartbeat = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: VoiceStatePush.heartbeat)
                guard !Task.isCancelled, let self else { return }
                self.dispatch(self.voiceStates.repeatCurrent())
            }
        }
    }

    /// Live audio level for the Safari call bar waveform, about 10 times a second (PROTOCOL.md 13.4).
    private func publishLevel(_ level: Float) {
        guard lastLevelSent.duration(to: .now) >= VoiceStatePush.levelInterval,
              let push = voiceStates.level(level) else { return }
        lastLevelSent = .now
        dispatch(push, quiet: true)
    }

    /// - Parameter quiet: level updates record diagnostics only on failure, to keep the file small.
    private func dispatch(_ push: VoiceStatePush, quiet: Bool = false) {
        // Best effort: if the extension isn't listening, the panel simply shows no voice state.
        let state = push.state.rawValue, seq = push.seq
        SFSafariApplication.dispatchMessage(withName: "seeforme", toExtensionWithIdentifier: Self.extensionIdentifier,
                                            userInfo: push.jsonObject()) { error in
            guard !quiet || error != nil else { return }
            Diagnostics.record("app.dispatch.voiceState", ["state": state, "seq": "\(seq)", "ok": "\(error == nil)",
                                                           "error": error.map { "\(($0 as NSError).domain)#\(($0 as NSError).code)" } ?? "-"])
        }
    }

    /// Tells the panel voice is off before the app quits.
    func applicationWillTerminate() {
        heartbeat?.cancel()
        dispatch(voiceStates.push(.idle))
    }

    func refreshExtensionState() {
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: Self.extensionIdentifier) { state, _ in
            self.extensionEnabled = state?.isEnabled
        }
    }

    func openSafariSettings() {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: Self.extensionIdentifier) { _ in }
    }

    /// Sends typed (or, later, spoken) input to the extension as a USER_INPUT push (PROTOCOL.md section 5).
    func send(_ text: String, source: String = "app", utteranceId: String? = nil, delivered: ((Bool) -> Void)? = nil) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        var push = UserInputPush(text: String(trimmed.prefix(ProtocolLimits.maxUtteranceChars)), source: source)
        push.utteranceId = utteranceId
        guard let data = try? JSONEncoder().encode(push),
              let userInfo = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        SFSafariApplication.dispatchMessage(withName: "seeforme", toExtensionWithIdentifier: Self.extensionIdentifier,
                                            userInfo: userInfo) { error in
            Diagnostics.record("app.dispatch.userInput", ["source": source, "ok": "\(error == nil)",
                                                          "error": error.map { "\(($0 as NSError).domain)#\(($0 as NSError).code)" } ?? "-"])
            Task { @MainActor in
                self.sendError = error == nil ? nil : "Couldn't reach the Safari extension. Is it enabled and is a form tab open?"
                delivered?(error == nil)
            }
        }
    }

    /// Live end-to-end voice check with synthetic data and no microphone or Safari:
    /// ElevenLabs speaks a sample answer → ElevenLabs transcribes it → on-device model fills a sample form
    /// → the next question is synthesised as MP3 and decoded. Returns a report with usage and cost.
    /// Exercises the actual microphone and playback graphs, not just downloaded bytes.
    func runMicrophoneSelfTest() async -> String {
        final class Meter: @unchecked Sendable {
            let lock = NSLock()
            var peak: Float = 0
            var buffers = 0
            var utterances = 0
            func level(_ value: Float) { lock.withLock { peak = max(peak, value); buffers += 1 } }
            func heard() { lock.withLock { utterances += 1 } }
            func result() -> String { lock.withLock { "buffers=\(buffers) peak=\(peak) utterances=\(utterances)" } }
        }
        var results: [String] = []
        for processed in [true, false] {
            let meter = Meter()
            let recorder = UtteranceRecorder(onSpeechStart: {}, onUtterance: { _ in meter.heard() }, onLevel: { meter.level($0) }, voiceProcessing: processed)
            do {
                try recorder.start()
                try await Task.sleep(for: .seconds(8))
                recorder.stop()
                results.append("voiceProcessing=\(processed) " + meter.result())
            } catch { results.append("voiceProcessing=\(processed) error=\((error as NSError).code)") }
        }
        return results.joined(separator: "\n")
    }

    func runAudioSelfTest() async -> String {
        let recorder = UtteranceRecorder(onSpeechStart: {}, onUtterance: { _ in })
        let player = SpeechPlayer()
        defer { player.stop(); recorder.stop() }
        do {
            try recorder.start()
            // One second of quiet synthetic PCM exercises tap + playback-completion callbacks.
            let data = Data(repeating: 0, count: 48000)
            var started = false
            try await player.playStream(AsyncThrowingStream { continuation in
                for offset in stride(from: 0, to: data.count, by: 4800) {
                    continuation.yield(data.subdata(in: offset..<offset+4800))
                }
                continuation.finish()
            }) { started = true }
            return started ? "PASS: microphone and playback completed without a callback crash" : "FAIL: playback never started"
        } catch { return "FAIL: audio graph \((error as NSError).domain)#\((error as NSError).code)" }
    }

    func runVoiceSelfTest() async -> String {
        guard let key = KeychainStore.load() else { return "FAIL: no ElevenLabs key in Keychain. Save it in the app first." }
        let client = ElevenLabsClient(apiKey: key, voiceId: voice.voiceId)
        var usage = VoiceUsage()
        var lines: [String] = []
        defer { voice.record { $0.ttsCharacters += usage.ttsCharacters; $0.ttsRequests += usage.ttsRequests
                               $0.sttSeconds += usage.sttSeconds; $0.sttRequests += usage.sttRequests } }
        let before = try? await client.subscriptionUsage()

        let fields = [
            FormField(id: "f0", label: "First name", kind: .text, required: true, autocomplete: "given-name"),
            FormField(id: "f1", label: "Last name", kind: .text, required: true, autocomplete: "family-name"),
            FormField(id: "f2", label: "Email", kind: .email, required: true, autocomplete: "email"),
            FormField(id: "f3", label: "T-shirt size", kind: .select, required: true, options: [
                FieldOption(value: "s", label: "Small"), FieldOption(value: "m", label: "Medium"), FieldOption(value: "l", label: "Large")]),
            FormField(id: "f4", label: "I agree to the code of conduct", kind: .checkbox, required: true),
        ]
        let answer = "My name is Alex Demo, my email is alex.demo@example.com, and I'd like a medium shirt."
        do {
            var clock = ContinuousClock.now
            usage.addSpeech(answer)
            let pcm = try await client.speak(answer, outputFormat: "pcm_16000")
            lines.append("TTS (pcm) \(pcm.count / 32) ms of audio in \(clock.duration(to: .now))")

            clock = .now
            usage.addTranscription(pcmBytes: pcm.count)
            let transcript = try await client.transcribe(pcm: pcm)
            lines.append("STT in \(clock.duration(to: .now)): \"\(transcript)\"")

            let engine = FormEngine()
            let session = UUID().uuidString
            _ = await engine.handle(InboundMessage(type: "FORM_SNAPSHOT", sessionId: session, requestId: "1",
                                                   pageOrigin: "http://localhost", fields: fields))
            clock = .now
            var reply = await engine.handle(InboundMessage(type: "USER_UTTERANCE", sessionId: session, requestId: "2",
                                                           text: transcript, source: "voice"))
            if reply.actions.isEmpty, reply.question?.fieldIds == [] {
                reply = await engine.handle(InboundMessage(type: "USER_UTTERANCE", sessionId: session, requestId: "confirm", text: "yes", source: "voice"))
            }
            let filled = Dictionary(uniqueKeysWithValues: reply.actions.map { ($0.fieldId, $0.value) })
            let expected = ["f0": "Alex", "f1": "Demo", "f2": "alex.demo@example.com", "f3": "m"]
            let pass = expected.allSatisfy { filled[$0.key] == $0.value } && filled["f4"] == nil
            lines.append("\(pass ? "PASS" : "FAIL") on-device mapping in \(clock.duration(to: .now)) (model \(reply.modelAvailable ? "on" : "off")): \(filled.sorted { $0.key < $1.key })")

            do {
                let recoveryEngine = FormEngine()
                _ = await recoveryEngine.handle(InboundMessage(type: "FORM_SNAPSHOT", sessionId: session, requestId: "email-only", pageOrigin: "http://localhost", fields: [fields[2]]))
                let spelledEmail = "alex dot demo at example dot com"
                usage.addSpeech(spelledEmail)
                let spellingAudio = try await client.speak(spelledEmail, outputFormat: "pcm_16000")
                usage.addTranscription(pcmBytes: spellingAudio.count)
                let spelling = try await client.transcribe(pcm: spellingAudio)
                let preview = await recoveryEngine.handle(InboundMessage(type: "USER_UTTERANCE", sessionId: session, requestId: "spelling", text: spelling, source: "voice"))
                let recovered = preview.actions.contains { $0.fieldId == "f2" && $0.value == "alex.demo@example.com" }
                lines.append("\(recovered ? "PASS" : "FAIL") spoken email punctuation direct fill")
            }

            let spoken = [reply.message, reply.question?.text].compactMap { $0 }.joined(separator: " ")
            clock = .now
            usage.addSpeech(spoken)
            let mp3 = try await client.speak(spoken)
            let duration = try AVAudioPlayer(data: mp3).duration
            lines.append("TTS (mp3) \"\(spoken)\" → \(String(format: "%.1f", duration)) s audio in \(clock.duration(to: .now))")
            let sample = "Streaming voice is ready."
            usage.addSpeech(sample)
            let streamStart = ContinuousClock.now
            var firstAudioMs: Int?, chunks = 0, bytes = 0
            for try await chunk in client.speechStream(sample) {
                if firstAudioMs == nil { firstAudioMs = Int(Diagnostics.ms(since: streamStart)) }
                chunks += 1; bytes += chunk.count
            }
            lines.append("\(chunks > 1 && bytes % 2 == 0 ? "PASS" : "FAIL") streaming PCM: \(chunks) chunks, first audio \(firstAudioMs ?? -1) ms, \(bytes) bytes")
        } catch {
            lines.append("FAIL: \((error as? LocalizedError)?.errorDescription ?? String(describing: error))")
        }
        lines.append("Usage: \(usage.summary)")
        if let before, let after = try? await client.subscriptionUsage(),
           let used = after["character_count"].flatMap({ a in before["character_count"].map { a - $0 } }) {
            lines.append("Account character_count delta: \(used)")
        }
        return lines.joined(separator: "\n")
    }

    /// Runs the on-device model inside the app on a built-in synthetic form, to prove the local reasoning path.
    func runSelfTest() async {
        selfTestResult = "Running…"
        let engine = FormEngine()
        let fields = [
            FormField(id: "f0", label: "First name", kind: .text, required: true, autocomplete: "given-name"),
            FormField(id: "f1", label: "Last name", kind: .text, required: true, autocomplete: "family-name"),
            FormField(id: "f2", label: "Email", kind: .email, required: true, autocomplete: "email"),
        ]
        let session = UUID().uuidString
        _ = await engine.handle(InboundMessage(type: "FORM_SNAPSHOT", sessionId: session, requestId: "1",
                                               pageOrigin: "http://localhost", fields: fields))
        let start = Date()
        let reply = await engine.handle(InboundMessage(type: "USER_UTTERANCE", sessionId: session, requestId: "2",
                                                       text: "I'm Sam Lee and my email is sam.lee@example.org", source: "app"))
        let seconds = Date().timeIntervalSince(start).formatted(.number.precision(.fractionLength(1)))
        let filled = reply.actions.map { action in "\(fields.first { $0.id == action.fieldId }?.label ?? action.fieldId) = \(action.value)" }
        selfTestResult = "\(reply.modelAvailable ? "On-device model" : "Fallback matcher") filled \(filled.count)/3 in \(seconds)s: "
            + filled.joined(separator: ", ")
    }
}
