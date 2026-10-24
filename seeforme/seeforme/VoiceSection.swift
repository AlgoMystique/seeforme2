import SeeForMeCore
import SwiftUI

struct VoiceSection: View {
    let voice: VoiceModel
    let currentQuestion: String?
    @State private var keyInput = ""

    var body: some View {
        Section("Voice (ElevenLabs)") {
            if voice.hasKey {
                LabeledContent("API key") {
                    HStack {
                        Label("Saved in Keychain", systemImage: "key.fill").foregroundStyle(.green)
                        Button("Remove") { voice.removeKey() }
                    }
                }
            } else {
                HStack {
                    SecureField("ElevenLabs API key", text: $keyInput)
                    Button("Save to Keychain") {
                        voice.saveKey(keyInput)
                        keyInput = ""
                    }
                    .disabled(keyInput.isEmpty)
                }
            }
            TextField("Voice ID", text: Bindable(voice).voiceId)
                .disabled(voice.isOn)

            HStack {
                Button(voice.isOn ? "Stop voice" : "Start voice") {
                    if voice.isOn {
                        voice.stop()
                    } else {
                        Task { await voice.start(currentQuestion: currentQuestion) }
                    }
                }
                .disabled(!voice.hasKey)
                Label(voice.state.label, systemImage: icon)
                    .foregroundStyle(color)
                    .contentTransition(.symbolEffect(.replace))
            }
            LabeledContent("ElevenLabs usage") {
                VStack(alignment: .trailing) {
                    Text("This session: \(voice.usage.summary)")
                    Text("All sessions: \(voice.totalUsage.summary)")
                }
                .font(.caption).foregroundStyle(.secondary)
            }
            if let heard = voice.lastHeard {
                Text("Heard: \u{201C}\(heard)\u{201D}").font(.callout).foregroundStyle(.secondary)
            }
        }
    }

    private var icon: String {
        switch voice.state {
        case .off: "mic.slash"
        case .listening: "mic"
        case .hearing: "waveform"
        case .transcribing: "icloud.and.arrow.up"
        case .thinking: "cpu"
        case .preparingSpeech: "icloud.and.arrow.down"
        case .speaking: "speaker.wave.2"
        case .error: "exclamationmark.triangle"
        }
    }

    private var color: Color {
        switch voice.state {
        case .off: .secondary
        case .error: .orange
        case .listening, .hearing: .red
        default: .accentColor
        }
    }
}
