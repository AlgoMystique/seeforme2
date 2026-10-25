import Foundation
import Testing
@testable import SeeForMeCore

private struct FailedReasoner: ConversationReasoner {
    func decide(text: String, fields: [FormField], question: Question?, language: String, formLanguage: String?) async throws -> ConversationDecision {
        throw DecodingError.keyNotFound(Key(stringValue: "explanation")!, .init(codingPath: [], debugDescription: "Synthetic omitted metadata"))
    }
    func translate(_ text: String, language: String) async throws -> String { text }
    private struct Key: CodingKey { var stringValue: String; var intValue: Int? { nil }; init?(stringValue: String) { self.stringValue = stringValue }; init?(intValue: Int) { return nil } }
}

@Suite struct DirectAnswerRecoveryTests {
    @Test func combinedBengaliNameAndEmailProduceBothActions() async {
        let engine = FormEngine(conversation: FailedReasoner(), modelAvailable: { true })
        var initial = snapshot([FormField(id: "name", label: "Full name", kind: .text, required: true),
                                FormField(id: "email", label: "Contact Email", kind: .text, required: true)])
        initial.conversationLanguage = "bn"; initial.formLanguage = "en"
        _ = await engine.handle(initial)
        var answer = say("হ্যাঁ আমার নাম অনন্যা সেন। Contact email synthetic@example.test")
        answer.source = "voice"
        let result = await engine.handle(answer)
        #expect(result.actions == [FillAction(fieldId: "name", value: "অনন্যা সেন"),
                                  FillAction(fieldId: "email", value: "synthetic@example.test")])
        #expect(result.status != .submit)
    }
    @Test(.enabled(if: ProcessInfo.processInfo.environment["SEEFORME_LIVE_RECOVERY_CHECK"] == "1"))
    func liveBengaliIdentifierDecision() async throws {
        do {
            let result = try await ElevenLabsReasoner().decide(text: "আমার নাম অনন্যা সেন",
                fields: [FormField(id: "name", label: "Full name", kind: .text, required: true, autocomplete: "name")],
                question: Question(text: "আপনার পুরো নাম কী?", fieldIds: ["name"]), language: "bn", formLanguage: "en")
            #expect(result.intent == .answer)
            #expect(result.values.contains { $0.fieldId == "name" && $0.value == "অনন্যা সেন" })
        } catch {
            print("LIVE_REASONING_CODE=" + Diagnostics.reasoningCode(error))
            throw error
        }
    }
    @Test func optionalReasoningMetadataDoesNotDiscardAnswers() throws {
        for json in [
            #"{"intent":"answer","values":[{"fieldId":"name","source":"Synthetic Person","value":"Synthetic Person"}]}"#,
            #"{"intent":"answer","explanation":null,"usedContext":null,"values":[{"fieldId":"name","source":"Synthetic Person","value":"Synthetic Person"}]}"#
        ] {
            let result = try JSONDecoder().decode(ElevenLabsReasoner.Decision.self, from: Data(json.utf8))
            #expect(result.values.count == 1)
            #expect(!result.usedContext)
        }
    }

    @Test func spokenFieldsProgressWithFailedReasoning() async {
        let fields = [FormField(id: "name", label: "Full name", kind: .text, required: true, autocomplete: "name"),
                      FormField(id: "email", label: "Email", kind: .email, required: true),
                      FormField(id: "phone", label: "Phone", kind: .tel, required: true),
                      FormField(id: "job", label: "Occupation", kind: .text, required: true)]
        let engine = FormEngine(conversation: FailedReasoner(), modelAvailable: { true })
        var initial = snapshot(fields); initial.conversationLanguage = "en"; initial.formLanguage = "en"
        #expect(await engine.handle(initial).question?.fieldIds == ["name"])
        for (id, answer, expected, next) in [
            ("name", "My name is Synthetic Person", "Synthetic Person", "email"),
            ("email", "synthetic dot person at example dot test", "synthetic.person@example.test", "phone"),
            ("phone", "+61 400 123 456", "+61 400 123 456", "job"),
            ("job", "Software engineer", "Software engineer", "")
        ] {
            var input = say(answer); input.source = "voice"
            let result = await engine.handle(input)
            #expect(result.actions == [FillAction(fieldId: id, value: expected)])
            #expect(result.status != .submit)
            let receipt = InboundMessage(type: "FILL_RESULT", sessionId: sessionId, requestId: UUID().uuidString,
                results: [.init(fieldId: id, success: true)], missingRequiredFieldIds: [], validationIssues: [])
            let after = await engine.handle(receipt)
            if !next.isEmpty { #expect(after.question?.fieldIds == [next]) }
            else { #expect(after.status == .readyForReview) }
        }
    }

    @Test func bengaliNameKeepsOriginalSpelling() async {
        let engine = FormEngine(conversation: FailedReasoner(), modelAvailable: { true })
        var initial = snapshot([FormField(id: "name", label: "Full name", kind: .text, required: true, autocomplete: "name")])
        initial.conversationLanguage = "bn"; initial.formLanguage = "en"
        _ = await engine.handle(initial)
        var answer = say("আমার নাম অনন্যা সেন"); answer.source = "voice"
        #expect(await engine.handle(answer).actions == [FillAction(fieldId: "name", value: "অনন্যা সেন")])
    }

    @Test func failedContextLookupAsksForMissingField() async {
        var context = LocalContextSnapshot(); context.active = true; context.connected = true
        context.documents = [.init(text: "Occupation: Synthetic engineer")]
        let cached = context
        let engine = FormEngine(conversation: FailedReasoner(), modelAvailable: { true }, contextProvider: { cached })
        var initial = snapshot([FormField(id: "name", label: "Full name", kind: .text, required: true)])
        initial.conversationLanguage = "en"
        _ = await engine.handle(initial)
        let question = await engine.handle(say("yes"))
        #expect(question.actions.isEmpty)
        #expect(question.question?.fieldIds == ["name"])
        #expect(await engine.handle(say("Synthetic Person")).actions == [FillAction(fieldId: "name", value: "Synthetic Person")])
    }

    @Test func bengaliAnswerToContextGreetingTargetsTheForm() async {
        var context = LocalContextSnapshot(); context.active = true; context.connected = true
        context.documents = [.init(text: "Preferred language: Bengali\nOccupation: Synthetic engineer")]
        let cached = context
        let engine = FormEngine(conversation: FailedReasoner(), modelAvailable: { true }, contextProvider: { cached })
        var initial = snapshot([FormField(id: "name", label: "Full name", kind: .text, required: true)])
        initial.conversationLanguage = "bn"; initial.formLanguage = "en"
        #expect(await engine.handle(initial).question?.fieldIds == [])
        var answer = say("আমার নাম অনন্যা সেন"); answer.source = "voice"
        #expect(await engine.handle(answer).actions == [FillAction(fieldId: "name", value: "অনন্যা সেন")])
    }

    @Test func askingForFormHelpKeepsMissingFieldConversationOpen() async {
        let engine = FormEngine(conversation: StubConversation(decision: .init(intent: .help, explanation: "I can help with this form.")), modelAvailable: { true })
        var initial = snapshot([FormField(id: "name", label: "Full name", kind: .text, required: true)])
        initial.conversationLanguage = "en"; initial.pageText = "Synthetic registration form"
        _ = await engine.handle(initial)
        let result = await engine.handle(say("Help me fill this form"))
        #expect(result.status == .needsInput)
        #expect(result.question?.fieldIds == ["name"])
        #expect(result.actions.isEmpty)
    }

    @Test func failedReasoningNeverTurnsHelpOrConsentIntoValues() async {
        for text in ["What is your full name?", "Help me fill the form", "yes", "আমার নাম কী?"] {
            let engine = FormEngine(conversation: FailedReasoner(), modelAvailable: { true })
            var initial = snapshot([FormField(id: "name", label: "Full name", kind: .text, required: true)])
            initial.conversationLanguage = "en"
            _ = await engine.handle(initial)
            #expect(await engine.handle(say(text)).actions.isEmpty)
        }
        var existing = FormField(id: "name", label: "Full name", kind: .text, required: true)
        existing.currentValuePresent = true
        let engine = FormEngine(conversation: FailedReasoner(), modelAvailable: { true })
        _ = await engine.handle(snapshot([existing]))
        #expect(await engine.handle(say("Synthetic Person")).actions.isEmpty)
    }
}
