import SeeForMeCore
import SwiftUI

struct ContentView: View {
    let model: AppModel
    @State private var input = ""

    var body: some View {
        Form {
            Section("Setup") {
                LabeledContent("On-device model") {
                    if let problem = model.modelProblem {
                        Label(problem, systemImage: "exclamationmark.triangle").foregroundStyle(.orange)
                    } else {
                        Label("Available", systemImage: "checkmark.circle").foregroundStyle(.green)
                    }
                }
                LabeledContent("Safari extension") {
                    HStack {
                        switch model.extensionEnabled {
                        case true?: Label("Enabled", systemImage: "checkmark.circle").foregroundStyle(.green)
                        case false?: Label("Turned off", systemImage: "xmark.circle").foregroundStyle(.orange)
                        case nil: Text("Unknown").foregroundStyle(.secondary)
                        }
                        Button("Open Safari Settings…") { model.openSafariSettings() }
                    }
                }
                HStack {
                    Button("Test on-device reasoning") { Task { await model.runSelfTest() } }
                    if let result = model.selfTestResult {
                        Text(result).font(.callout).foregroundStyle(.secondary).textSelection(.enabled)
                    }
                }
            }

            Section("Conversation") {
                if let latest = model.latest {
                    if let question = latest.question {
                        Text(question).font(.title3)
                    }
                    if let message = latest.message {
                        Text(message).foregroundStyle(.secondary)
                    }
                    if latest.status == .readyForReview {
                        Label("Ready for your review in Safari. SeeForMe submits only after you say yes.", systemImage: "checkmark.seal")
                            .foregroundStyle(.green)
                    }
                } else {
                    Text("Open a page with a form in Safari and start SeeForMe from the toolbar.")
                        .foregroundStyle(.secondary)
                }
                HStack {
                    TextField("Type your answer", text: $input)
                        .onSubmit(sendInput)
                    Button("Send", action: sendInput).disabled(input.isEmpty)
                }
                if let error = model.sendError {
                    Text(error).foregroundStyle(.red).font(.callout)
                }
            }

            VoiceSection(voice: model.voice, currentQuestion: model.latest?.question)

            Section {
                Text("Form reasoning runs on this Mac with Apple Foundation Models. Typed answers and form details are not sent to any server. With voice on, your speech audio and SeeForMe's spoken questions are processed by ElevenLabs in the cloud; form values are never sent to ElevenLabs.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
        .frame(minWidth: 520, minHeight: 420)
        .task { model.refreshExtensionState() }
    }

    private func sendInput() {
        model.send(input)
        input = ""
    }
}

#Preview {
    ContentView(model: .shared)
}
