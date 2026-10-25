import Foundation
import AppKit
import PDFKit
import Testing
@testable import SeeForMeCore

private final class ContextStateBox: @unchecked Sendable {
    private let lock = NSLock()
    private var state: LocalContextSnapshot
    init(_ state: LocalContextSnapshot) { self.state = state }
    func read() -> LocalContextSnapshot { lock.withLock { state } }
    func disconnect() { lock.withLock { state.disconnect() } }
}
private struct DisconnectingReasoner: ConversationReasoner {
    let state: ContextStateBox
    func decide(text: String, fields: [FormField], question: Question?, language: String, formLanguage: String?) async throws -> ConversationDecision {
        state.disconnect()
        var decision = ConversationDecision(intent: .answer, values: [.init(fieldId: "bio", source: "Synthetic engineer", value: "Synthetic engineer")])
        decision.usedContext = true
        return decision
    }
    func translate(_ text: String, language: String) async throws -> String { text }
}

private struct ContinuingContextReasoner: ConversationReasoner {
    func translate(_ text: String, language: String) async throws -> String { text }
    func decide(text: String, fields: [FormField], question: Question?, language: String, formLanguage: String?) async throws -> ConversationDecision { ConversationDecision(intent: .help) }
    func decide(text: String, fields: [FormField], question: Question?, language: String, formLanguage: String?, context: String, contextAuthorized: Bool) async throws -> ConversationDecision {
        guard contextAuthorized else { return ConversationDecision(intent: .help) }
        let namePresent = fields.first { $0.id == "name" }?.currentValuePresent == true
        var result = ConversationDecision(intent: .answer, values: [.init(fieldId: namePresent ? "email" : "name", source: namePresent ? "synthetic@example.test" : "Synthetic Person", value: namePresent ? "synthetic@example.test" : "Synthetic Person")])
        result.usedContext = true; return result
    }
}

@Suite(.serialized) struct LocalContextTests {
    func fixture() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("seeforme-context-test-" + UUID().uuidString)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }
    @Test func explicitLanguagePreferenceAndSpeechConsent() {
        var state = LocalContextSnapshot(); state.active = true; state.connected = true
        state.documents = [.init(text: "Preferred language: Bengali\nSynthetic profile")]
        #expect(state.preferredLanguage == "bn")
        state.documents = [.init(text: "PREFERED LANGUAGE - BENGALI")]
        #expect(state.preferredLanguage == "bn")
        state.documents = [.init(text: "- **Preferred communication language:** Bengali")]
        #expect(state.preferredLanguage == "bn")
        state.documents = [.init(text: "My preferred language is French")]
        #expect(state.preferredLanguage == "fr")
        state.documents.append(.init(text: "Preferred language: English"))
        #expect(state.preferredLanguage == nil)
        let reply = HostReply(sessionId: "s", requestId: "r", status: .needsInput, message: "Synthetic context reply", modelAvailable: true)
        #expect(state.voiceSafe(reply).message != reply.message)
        state.allowRemoteSpeech = true
        #expect(state.voiceSafe(reply).message == reply.message)
        state.allowRemoteSpeech = false
        #expect(state.voiceSafe(reply).message != reply.message)
        #expect(ShortReply("হ্যাঁ") == .yes)
        #expect(ShortReply("না") == .no)
        #expect(ShortReply("হ্যাঁ কিন্তু এখন নয়") == nil)
    }
    @Test func bengaliPreferenceIsNotOverriddenAndLanguageRequestNeverExplainsPage() async {
        var state = LocalContextSnapshot(); state.active = true; state.connected = true
        state.documents = [.init(text: "PREFERED LANGUAGE - BENGALI")]
        let cached = state
        let reasoner = StubConversation(decision: ConversationDecision(intent: .help, explanation: "Unrequested page explanation"))
        let engine = FormEngine(conversation: reasoner, contextProvider: { cached })
        var snapshot = InboundMessage(type: "FORM_SNAPSHOT", sessionId: "bengali", requestId: "1", pageOrigin: "http://localhost", fields: [])
        snapshot.conversationLanguage = "en"
        let initial = await engine.handle(snapshot)
        #expect(initial.conversationLanguage == "bn")
        #expect(initial.actions.isEmpty)
        let request = await engine.handle(InboundMessage(type: "USER_UTTERANCE", sessionId: "bengali", requestId: "2", text: "কথা বলো বাংলাতে। বাংলাই আমার preferred language", source: "voice"))
        #expect(request.conversationLanguage == "bn")
        #expect(request.status == .needsInput)
        #expect(request.question?.text.contains("Unrequested page explanation") != true)
        #expect(request.actions.isEmpty)
    }
    @Test func connectedContextAsksBeforeFillingAndYesNeverSubmits() async {
        var state = LocalContextSnapshot(); state.active = true; state.connected = true
        state.documents = [.init(text: "Preferred language: English\nSynthetic engineer")]
        let cached = state
        var decision = ConversationDecision(intent: .answer, values: [.init(fieldId: "bio", source: "Synthetic engineer", value: "Synthetic engineer")])
        decision.usedContext = true
        let engine = FormEngine(conversation: StubConversation(decision: decision), contextProvider: { cached })
        let first = await engine.handle(InboundMessage(type: "FORM_SNAPSHOT", sessionId: "offer", requestId: "1", pageOrigin: "http://localhost",
            fields: [FormField(id: "bio", label: "Description", kind: .textarea, required: true)]))
        #expect(first.actions.isEmpty)
        #expect(first.question?.text.contains("Would you like") == true)
        let approved = await engine.handle(InboundMessage(type: "USER_UTTERANCE", sessionId: "offer", requestId: "2", text: "yes", source: "voice"))
        #expect(approved.actions.first?.value == "Synthetic engineer")
        #expect(approved.status != .submit)
    }
    @Test func remainingFactsAreFilledBeforeAskingAgain() async {
        var state = LocalContextSnapshot(); state.active = true; state.connected = true
        state.documents = [.init(text: "Name: Synthetic Person\nEmail: synthetic@example.test")]
        let cached = state
        let engine = FormEngine(conversation: ContinuingContextReasoner(), modelAvailable: { true }, contextProvider: { cached })
        _ = await engine.handle(InboundMessage(type: "FORM_SNAPSHOT", sessionId: "continue", requestId: "1", pageOrigin: "http://localhost",
            fields: [FormField(id: "name", label: "Name", kind: .text, required: true), FormField(id: "email", label: "Email", kind: .email, required: true)]))
        let initial = await engine.handle(InboundMessage(type: "USER_UTTERANCE", sessionId: "continue", requestId: "2", text: "yes", source: "voice"))
        #expect(initial.actions.first?.fieldId == "name")
        var result = InboundMessage(type: "FILL_RESULT", sessionId: "continue", requestId: "3")
        result.results = [.init(fieldId: "name", success: true)]
        result.missingRequiredFieldIds = ["email"]
        let next = await engine.handle(result)
        #expect(next.actions.contains { $0.fieldId == "email" && $0.value == "synthetic@example.test" })
        #expect(next.status != .submit)
    }
    @Test func activationSurvivesProcessAndWebsiteChangesWithoutSourceReads() throws {
        let folder = try fixture()
        defer { try? FileManager.default.removeItem(at: folder) }
        let source = folder.appendingPathComponent("profile.txt")
        try "Synthetic initial context".write(to: source, atomically: true, encoding: .utf8)
        let store = LocalContextStore(directory: folder.appendingPathComponent("private-cache"))
        var state = LocalContextSnapshot(); state.connected = true
        var loads = 0
        let load: (inout LocalContextSnapshot) throws -> Void = {
            loads += 1; try LocalContextExtractor.load(folder: folder, into: &$0)
        }
        try state.activate(load: load)
        let activation = state.activationID
        try store.write(state)
        try "Changed source".write(to: source, atomically: true, encoding: .utf8)
        // A fresh store/snapshot instance represents an interrupted process resuming.
        var resumed = try LocalContextStore(directory: store.directory).read()
        for _ in 0..<4 { try resumed.activate(load: load) }
        #expect(loads == 1)
        #expect(resumed.activationID == activation)
        #expect(resumed.documents.first?.text == "Synthetic initial context")
        try resumed.refresh(load: load)
        #expect(loads == 2)
        #expect(resumed.activationID == activation)
        #expect(resumed.documents.first?.text == "Changed source")
        resumed.turnOff(); try store.write(resumed)
        #expect(try store.read().documents.isEmpty)
        #expect(resumed.explicitlyOff && !resumed.active)
        try resumed.activate(load: load)
        #expect(loads == 3 && resumed.activationID != activation)
        resumed.disconnect(); try store.write(resumed)
        #expect(try store.read().documents.isEmpty)
        #expect(!resumed.connected && resumed.active)
    }
    @Test func refreshWhileOffNeverReadsAndFailedRefreshKeepsSnapshot() throws {
        var state = LocalContextSnapshot(); state.connected = true
        var loads = 0
        try state.refresh { _ in loads += 1 }
        #expect(loads == 0)
        try state.activate { $0.documents = [.init(text: "Cached fact")] }
        let revision = state.revision
        do {
            try state.refresh { $0.documents = []; throw CocoaError(.fileReadNoPermission) }
            Issue.record("Refresh should fail")
        } catch {}
        #expect(state.documents.first?.text == "Cached fact" && state.revision == revision)
    }
    @Test func failedActivationDoesNotRepeatedlyRetrySourceFiles() throws {
        var state = LocalContextSnapshot(); state.connected = true
        var loads = 0
        do { try state.activate { _ in loads += 1; throw CocoaError(.fileReadNoPermission) } } catch {}
        try state.activate { _ in loads += 1 }
        #expect(state.active && loads == 1)
    }
    @Test func extractorReadsTextMarkdownAndDocxAndSkipsUnsafeEntries() throws {
        let folder = try fixture()
        defer { try? FileManager.default.removeItem(at: folder) }
        try "Synthetic TXT fact".write(to: folder.appendingPathComponent("one.txt"), atomically: true, encoding: .utf8)
        try "# Synthetic Markdown\n\nA second fact".write(to: folder.appendingPathComponent("two.md"), atomically: true, encoding: .utf8)
        let attributed = NSAttributedString(string: "Synthetic DOCX fact")
        let docx = try attributed.data(from: NSRange(location: 0, length: attributed.length), documentAttributes: [.documentType: NSAttributedString.DocumentType.officeOpenXML])
        try docx.write(to: folder.appendingPathComponent("three.docx"))
        try FileManager.default.createSymbolicLink(at: folder.appendingPathComponent("link.txt"), withDestinationURL: folder.appendingPathComponent("one.txt"))
        try Data([0xff, 0xfe, 0xff]).write(to: folder.appendingPathComponent("invalid.txt"))
        try "Hidden fact".write(to: folder.appendingPathComponent(".hidden.txt"), atomically: true, encoding: .utf8)
        var state = LocalContextSnapshot()
        try LocalContextExtractor.load(folder: folder, into: &state)
        #expect(state.documents.count == 3)
        #expect(state.skipped == 2)
        #expect(state.documents.contains { $0.text.contains("Synthetic DOCX fact") })
        #expect(!state.documents.contains { $0.text.contains("Hidden fact") })
    }
    @Test func pdfExtractsEmbeddedTextAndSkipsLockedDocuments() throws {
        let folder = try fixture()
        defer { try? FileManager.default.removeItem(at: folder) }
        let stream = "BT /F1 12 Tf 20 80 Td (Synthetic PDF fact) Tj ET"
        let objects = [
            "<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 100] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
            "<< /Length \(stream.utf8.count) >>\nstream\n\(stream)\nendstream"
        ]
        var pdf = "%PDF-1.4\n", offsets = [0]
        for (index, object) in objects.enumerated() {
            offsets.append(pdf.utf8.count)
            pdf += "\(index+1) 0 obj\n\(object)\nendobj\n"
        }
        let xref = pdf.utf8.count
        pdf += "xref\n0 6\n0000000000 65535 f \n"
        for offset in offsets.dropFirst() { pdf += String(format: "%010d 00000 n \n", offset) }
        pdf += "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n\(xref)\n%%EOF\n"
        let data = Data(pdf.utf8)
        try data.write(to: folder.appendingPathComponent("one.pdf"))
        let document = try #require(PDFDocument(data: data))
        #expect(document.write(to: folder.appendingPathComponent("locked.pdf"), withOptions: [.userPasswordOption: "synthetic-pass", .ownerPasswordOption: "synthetic-owner"]))
        var state = LocalContextSnapshot()
        try LocalContextExtractor.load(folder: folder, into: &state)
        #expect(state.documents.count == 1 && state.skipped == 1)
        #expect(state.documents.first?.text.contains("Synthetic PDF fact") == true)
    }
    @Test func extractorBoundsTextAndNeverFollowsSubfolders() throws {
        let folder = try fixture()
        defer { try? FileManager.default.removeItem(at: folder) }
        try String(repeating: "x", count: LocalContextExtractor.maxCharacters + 20).write(to: folder.appendingPathComponent("large.txt"), atomically: true, encoding: .utf8)
        try FileManager.default.createDirectory(at: folder.appendingPathComponent("nested.md"), withIntermediateDirectories: true)
        var state = LocalContextSnapshot()
        try LocalContextExtractor.load(folder: folder, into: &state)
        #expect(state.documents.reduce(0) { $0 + $1.text.count } == LocalContextExtractor.maxCharacters)
        #expect(state.truncated)
    }
    @Test func excerptsAreBoundedAndOffHasNoContext() {
        var state = LocalContextSnapshot(); state.documents = [.init(text: "Unrelated paragraph\n\nSynthetic engineering profile")]
        #expect(state.excerpt(query: "engineering").isEmpty)
        state.active = true
        #expect(state.excerpt(query: "engineering").hasPrefix("Synthetic engineering profile"))
        state.documents = [.init(text: String(repeating: "x", count: 8000))]
        #expect(state.excerpt(query: "profile").count == 6000)
    }
    @Test func cloudSpeechGetsNoContextReplyTextOrQuestion() {
        let reply = HostReply(sessionId: "s", requestId: "r", status: .needsInput,
                              question: Question(text: "Private document question", fieldIds: []), message: "Private generated description", modelAvailable: true)
        var state = LocalContextSnapshot()
        #expect(state.voiceSafe(reply).message == reply.message)
        state.active = true; state.connected = true
        let safe = state.voiceSafe(reply)
        #expect(safe.question == nil)
        #expect(safe.message == "The reply is shown in Safari. Local context stays on your Mac.")
    }
    @Test func disconnectDuringNativeReasoningRejectsStaleFill() async {
        var snapshot = LocalContextSnapshot(); snapshot.active = true; snapshot.connected = true
        snapshot.documents = [.init(text: "Synthetic engineer")]
        let box = ContextStateBox(snapshot)
        let engine = FormEngine(conversation: DisconnectingReasoner(state: box), contextProvider: { box.read() })
        _ = await engine.handle(InboundMessage(type: "FORM_SNAPSHOT", sessionId: "race", requestId: "1", pageOrigin: "http://localhost",
                                               fields: [FormField(id: "bio", label: "Description", kind: .textarea, required: true)]))
        let result = await engine.handle(InboundMessage(type: "USER_UTTERANCE", sessionId: "race", requestId: "2", text: "Use my context", source: "typed"))
        #expect(result.actions.isEmpty)
        #expect(result.message == "Local context changed during this step. Please repeat your request.")
    }
    @Test(.enabled(if: FoundationModelExtractor.isAvailable))
    func onDeviceContextGeneratesFrenchDescription() async throws {
        let reasoner = LocalConversationReasoner()
        let result = try await reasoner.decide(text: "Use my local context to write a short description in French.",
            fields: [FormField(id: "bio", label: "Professional description", kind: .textarea, required: true)],
            question: nil, language: "en", formLanguage: "en",
            context: "I am a software engineer. I build accessible browser tools.")
        #expect(result.intent == .answer && result.usedContext)
        #expect(!result.values.isEmpty, "Rejected: \(result.rejectionReasons)")
        for value in result.values { #expect(ConversationLanguage.detect(value.value) == "fr", "Synthetic output: \(value.value)") }
        #expect(result.values.allSatisfy { "I am a software engineer. I build accessible browser tools.".contains($0.source) })
    }
    @Test func contextEvidenceFillsDescriptionsButNeverCheckboxConsentOrExistingValues() async {
        var state = LocalContextSnapshot(); state.active = true; state.connected = true
        state.documents = [.init(text: "Synthetic engineer builds accessible interfaces.")]
        var decision = ConversationDecision(intent: .answer, values: [
            .init(fieldId: "bio", source: "Synthetic engineer", value: "Ingénieur en interfaces accessibles"),
            .init(fieldId: "agree", source: "Synthetic engineer", value: "true"),
            .init(fieldId: "existing", source: "Synthetic engineer", value: "Replacement")])
        decision.usedContext = true
        let cached = state
        let engine = FormEngine(conversation: StubConversation(decision: decision), contextProvider: { cached })
        let fields = [FormField(id: "bio", label: "Description", kind: .textarea, required: true),
                      FormField(id: "agree", label: "I agree", kind: .checkbox, required: true),
                      FormField(id: "existing", label: "Existing description", kind: .textarea, required: true, currentValuePresent: true)]
        _ = await engine.handle(InboundMessage(type: "FORM_SNAPSHOT", sessionId: "context-fixture", requestId: "1", pageOrigin: "http://localhost", fields: fields))
        let result = await engine.handle(InboundMessage(type: "USER_UTTERANCE", sessionId: "context-fixture", requestId: "2", text: "Use my context to fill the description in French", source: "typed"))
        #expect(result.actions == [FillAction(fieldId: "bio", value: "Ingénieur en interfaces accessibles")])
        #expect(result.status != .submit)
        decision.usedContext = false
        let ordinary = FormEngine(conversation: StubConversation(decision: decision), contextProvider: { cached })
        _ = await ordinary.handle(InboundMessage(type: "FORM_SNAPSHOT", sessionId: "ordinary", requestId: "1", pageOrigin: "http://localhost", fields: fields))
        let withoutPermission = await ordinary.handle(InboundMessage(type: "USER_UTTERANCE", sessionId: "ordinary", requestId: "2", text: "What does this description field mean?", source: "typed"))
        #expect(withoutPermission.actions.isEmpty)
    }
}
