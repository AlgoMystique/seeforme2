import AppKit
import SeeForMeCore
import SwiftUI

/// SeeForMe's native voice host. It runs in the background (no Dock icon, no window) and is
/// started and controlled from Safari. The menu bar item only opens setup (API key, permissions).
@main struct MyApp: App {
    init() {
        if CommandLine.arguments.contains("--microphone-self-test") {
            Task {
                print(await AppModel.shared.runMicrophoneSelfTest())
                NSApplication.shared.terminate(nil)
            }
        }
        if CommandLine.arguments.contains("--audio-self-test") {
            Task {
                print(await AppModel.shared.runAudioSelfTest())
                NSApplication.shared.terminate(nil)
            }
        }
        // `seeforme --self-test` runs the built-in synthetic-form check inside the sandboxed app and exits.
        if CommandLine.arguments.contains("--self-test") {
            Task {
                let model = AppModel.shared
                await model.runSelfTest()
                print(model.selfTestResult ?? "no result")
                NSApplication.shared.terminate(nil)
            }
        }
        // `seeforme --voice-self-test` runs the live ElevenLabs + on-device pipeline on synthetic data and exits.
        if CommandLine.arguments.contains("--voice-self-test") {
            Task {
                print(await AppModel.shared.runVoiceSelfTest())
                NSApplication.shared.terminate(nil)
            }
        }
    }

    @NSApplicationDelegateAdaptor private var appDelegate: AppDelegate

    var body: some Scene {
        MenuBarExtra("SeeForMe", systemImage: "waveform.circle") {
            Button("SeeForMe Settings…") { AppModel.shared.showWindow() }
            Divider()
            Button("Quit SeeForMe") { NSApp.terminate(nil) }
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        let startVoice = CommandLine.arguments.contains("--start-voice")
        Diagnostics.record("app.launch", ["startVoice": "\(startVoice)"])
        let model = AppModel.shared // creates the voice host and its Safari command observers
        model.refreshExtensionState()
        // Launched by Safari (mic or toolbar button) while the host wasn't running.
        if startVoice {
            let args = CommandLine.arguments
            if let i = args.firstIndex(of: "--conversation-language"), i + 1 < args.count,
               ConversationLanguage.supported(args[i+1]) { model.voice.conversationLanguage = args[i+1] }
            if let i = args.firstIndex(of: "--voice-id"), i + 1 < args.count,
               VoicePreferences.validVoice(args[i+1]) { model.voice.voiceId = args[i+1] }
            model.handle(.start)
        }
        // First run: no ElevenLabs key yet, so open setup once.
        if !model.voice.hasKey { model.showWindow() }
    }

    func application(_ application: NSApplication, open urls: [URL]) {
        if let folder = urls.first { AppModel.shared.connectContextFolder(folder) }
    }

    func applicationWillTerminate(_ notification: Notification) {
        AppModel.shared.applicationWillTerminate()
    }
}
