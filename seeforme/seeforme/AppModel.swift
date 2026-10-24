import Foundation
import Observation
import SafariServices
import SeeForMeCore

/// State for the host window: model status, extension status, and the live conversation
/// mirrored from the Safari extension process.
@Observable
final class AppModel {
    static let extensionIdentifier = "com.seeforme.app.extension"

    var modelProblem: String? = FoundationModelExtractor.unavailableReason
    var extensionEnabled: Bool?
    var latest: HostReplyBroadcast.Summary?
    var sendError: String?
    var selfTestResult: String?

    @ObservationIgnored private var observer: NSObjectProtocol?

    init() {
        observer = DistributedNotificationCenter.default().addObserver(
            forName: HostReplyBroadcast.name, object: nil, queue: .main
        ) { [weak self] notification in
            let summary = HostReplyBroadcast.decode(notification)
            MainActor.assumeIsolated { self?.latest = summary }
        }
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
    func send(_ text: String, source: String = "app") {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let push = UserInputPush(text: String(trimmed.prefix(ProtocolLimits.maxUtteranceChars)), source: source)
        guard let data = try? JSONEncoder().encode(push),
              let userInfo = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        SFSafariApplication.dispatchMessage(withName: "seeforme", toExtensionWithIdentifier: Self.extensionIdentifier,
                                            userInfo: userInfo) { error in
            Task { @MainActor in self.sendError = error == nil ? nil : "Couldn't reach the Safari extension. Is it enabled and is a form tab open?" }
        }
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
