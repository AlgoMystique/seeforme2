import Foundation
import Testing
@testable import SeeForMeCore

@Suite(.serialized) struct ElevenLabsReasonerTests {
    @Test func snippetSelectionDoesNotSendUnrelatedProfile() {
        var context = LocalContextSnapshot(); context.active = true; context.connected = true
        context.documents = [.init(text: "Name: Synthetic Person\nEmail: synthetic@example.test\nUnrelated private notes never needed here\nPreferred language: Bengali")]
        let excerpt = context.relevantExcerpt(query: "name")
        #expect(excerpt == "Name: Synthetic Person")
        #expect(!excerpt.contains("Email"))
    }
    @Test(.enabled(if: ProcessInfo.processInfo.environment["SEEFORME_LIVE_ELEVEN_TEST"] == "1"))
    func bengaliGreetingAndFormAnswer() async throws {
        let reasoner = ElevenLabsReasoner()
        let greeting = try await reasoner.translate("Hi, I'm SeeForMe. Would you like me to fill up this form for you?", language: "bn")
        #expect(greeting.unicodeScalars.contains { (0x0980...0x09ff).contains($0.value) })
        var context = LocalContextSnapshot(); context.active = true; context.connected = true
        context.documents = [.init(text: "Preferred language - Bengali\nName: Synthetic Person\nProfessional description: Software engineer building accessible browser tools.")]
        let cached = context
        let engine = FormEngine(conversation: reasoner, modelAvailable: { true }, contextProvider: { cached })
        var snapshot = InboundMessage(type: "FORM_SNAPSHOT", sessionId: "remote-bn", requestId: "1", pageOrigin: "http://localhost", fields: [FormField(id: "name", label: "Full name", kind: .text, required: true), FormField(id: "description", label: "Professional description", kind: .textarea, required: true)])
        snapshot.formLanguage = "en"
        let first = await engine.handle(snapshot)
        #expect(first.conversationLanguage == "bn")
        #expect(first.actions.isEmpty)
        let answer = await engine.handle(InboundMessage(type: "USER_UTTERANCE", sessionId: "remote-bn", requestId: "2", text: "হ্যাঁ", source: "voice"))
        #expect(answer.actions.contains { $0.fieldId == "name" && $0.value == "Synthetic Person" })
        #expect(answer.actions.contains { $0.fieldId == "description" && ConversationLanguage.detect($0.value) == "en" })
        #expect(answer.status != .submit)
        guard let key = KeychainStore.load() else { throw ElevenLabsClient.Failure.invalidKey }
        let client = ElevenLabsClient(apiKey: key)
        let audio = try await client.speak(greeting, outputFormat: "pcm_16000")
        #expect(audio.count > 1000)
        let transcript = try await client.transcribeDetected(pcm: audio)
        #expect(transcript.language_code == "ben" || transcript.language_code == "bn")
    }
    @Test(.enabled(if: ProcessInfo.processInfo.environment["SEEFORME_LIVE_ELEVEN_TEST"] == "1"))
    func bengaliYesFillsJapaneseFormAndSpeechStreams() async throws {
        let reasoner = ElevenLabsReasoner()
        var context = LocalContextSnapshot(); context.active = true; context.connected = true
        context.documents = [.init(text: "Preferred language: Bengali\nName: Synthetic Person\nProfessional description: Software engineer building accessible browser tools.\nUnrelated private travel plans.")]
        let cached = context
        let engine = FormEngine(conversation: reasoner, modelAvailable: { true }, contextProvider: { cached })
        var snapshot = InboundMessage(type: "FORM_SNAPSHOT", sessionId: "remote-ja", requestId: "1", pageOrigin: "http://localhost", fields: [FormField(id: "name", label: "氏名", kind: .text, required: true), FormField(id: "description", label: "自己紹介", kind: .textarea, required: true)])
        snapshot.formLanguage = "ja"
        _ = await engine.handle(snapshot)
        let answer = await engine.handle(InboundMessage(type: "USER_UTTERANCE", sessionId: "remote-ja", requestId: "2", text: "হ্যাঁ", source: "voice"))
        #expect(answer.actions.contains { $0.fieldId == "name" && $0.value == "Synthetic Person" })
        #expect(answer.actions.contains { $0.fieldId == "description" && ConversationLanguage.detect($0.value) == "ja" }, "Synthetic fixture actions: \(answer.actions); message: \(answer.message ?? "none")")
        #expect(answer.status != .submit)
        let fixtureData = try JSONEncoder().encode(answer.actions)
        try fixtureData.write(to: URL(fileURLWithPath: "/tmp/seeforme-eleven-japanese-actions.json"), options: .atomic)
        guard let key = KeychainStore.load() else { throw ElevenLabsClient.Failure.invalidKey }
        var size = 0
        for try await chunk in ElevenLabsClient(apiKey: key).speechStream("আমি প্রস্তুত।") { size += chunk.count }
        #expect(size > 1000)
    }

    @Test(.enabled(if: ProcessInfo.processInfo.environment["SEEFORME_LIVE_ELEVEN_TEST"] == "1"))
    func freeFormBengaliAnswerBecomesJapaneseValue() async throws {
        let utterance = "আমি সফটওয়্যার ইঞ্জিনিয়ার। আমি সবার জন্য সহজে ব্যবহারযোগ্য ব্রাউজার টুল তৈরি করি।"
        let answer = try await ElevenLabsReasoner().decide(text: utterance,
            fields: [FormField(id: "bio", label: "自己紹介", kind: .textarea, required: true)],
            question: Question(text: "নিজের কাজ সম্পর্কে বলুন।", fieldIds: ["bio"]), language: "bn", formLanguage: "ja")
        #expect(answer.intent == .answer)
        #expect(answer.values.contains { $0.fieldId == "bio" && ConversationLanguage.detect($0.value) == "ja" && utterance.contains($0.source) })
        #expect(!answer.usedContext)
    }

    @Test(.enabled(if: ProcessInfo.processInfo.environment["SEEFORME_LIVE_ELEVEN_TEST"] == "1"))
    func previouslyApprovedContextIsUsedWithoutRepeatingFacts() async throws {
        let reply = try await ElevenLabsReasoner().decide(text: "ওটা আমার কনটেক্সটে আছে।",
            fields: [FormField(id: "email", label: "メールアドレス", kind: .email, required: true)],
            question: Question(text: "আপনার ইমেল কী?", fieldIds: ["email"]), language: "bn", formLanguage: "ja",
            context: "Email: synthetic@example.test", contextAuthorized: true)
        #expect(reply.usedContext)
        #expect(reply.values.contains { $0.fieldId == "email" && $0.value == "synthetic@example.test" })
    }

}
