import Foundation
import Testing
@testable import SeeForMeCore

struct StubConversation: ConversationReasoner {
    var decision: ConversationDecision
    func decide(text: String, fields: [FormField], question: Question?, language: String, formLanguage: String?) async throws -> ConversationDecision { decision }
    func translate(_ text: String, language: String) async throws -> String { text }
}
@Suite(.serialized) struct ConversationTests {
@Test func automaticSpeechDetectionDoesNotForceEnglish() {
    let request = ElevenLabsClient(apiKey: "fixture").transcriptionRequest(pcm: Data())
    #expect(!String(decoding: request.httpBody!, as: UTF8.self).contains("language_code"))
    #expect(!ConversationLanguage.supported("zz"))
    #expect(ConversationLanguage.same("en-AU", "en-US"))
}
@Test func questionsNeverBecomeFieldValues() async {
    let reasoner = StubConversation(decision: .init(intent: .explain, explanation: "This field asks for your occupation.",
        values: [.init(fieldId: "job", source: "occupation", value: "Engineer")]))
    let e = FormEngine(conversation: reasoner)
    _ = await e.handle(snapshot([FormField(id: "job", label: "Occupation", kind: .text, required: true)]))
    let r = await e.handle(say("What does occupation mean?"))
    #expect(r.actions.isEmpty)
    #expect(r.message == "This field asks for your occupation.")
}
@Test func translatedValuesFillDirectlyAndCannotSubmit() async {
    let reasoner = StubConversation(decision: .init(intent: .answer, values: [
        .init(fieldId: "job", source: "工程师", value: "Engineer")]))
    let e = FormEngine(conversation: reasoner)
    let fields = [FormField(id: "job", label: "Occupation", kind: .text, required: true)]
    _ = await e.handle(snapshot(fields))
    let proposed = await e.handle(say("我是工程师"))
    #expect(proposed.actions == [FillAction(fieldId: "job", value: "Engineer")])
    #expect(proposed.status != .submit)
}
@Test func translationDoesNotOverwriteChangedFields() async {
    let e = FormEngine(conversation: StubConversation(decision: .init(intent: .answer, values: [
        .init(fieldId: "job", source: "工程师", value: "Engineer")])))
    var fields = [FormField(id: "job", label: "Occupation", kind: .text, required: true)]
    _ = await e.handle(snapshot(fields))
    _ = await e.handle(say("我是工程师"))
    fields[0].currentValuePresent = true
    _ = await e.handle(snapshot(fields))
    let r = await e.handle(say("yes"))
    #expect(r.actions.isEmpty)
    #expect(r.status != .submit)
}
@Test func translationNeedsQuotedEvidenceAndPreservesNames() async {
    let e = FormEngine(conversation: StubConversation(decision: .init(intent: .answer, values: [
        .init(fieldId: "job", source: "not spoken", value: "Engineer"),
        .init(fieldId: "name", source: "李", value: "Lee")])))
    _ = await e.handle(snapshot([FormField(id: "job", label: "Job", kind: .text, required: true),
                                FormField(id: "name", label: "Name", kind: .text, required: true, autocomplete: "family-name")]))
    let r = await e.handle(say("我姓李"))
    #expect(r.actions.isEmpty)
    #expect(r.question?.text.contains("May I fill") != true)
}
@Test func multilingualConsentRejectsAmbiguity() {
    #expect(ShortReply("是的。") == .yes)
    #expect(ShortReply("不要提交") == .no)
    #expect(ShortReply("oui") == .yes)
    #expect(ShortReply("sí") == .yes)
    #expect(ShortReply("はい") == .yes)
    #expect(ShortReply("yes but don't submit") != .yes)
    #expect(ShortReply("可以，但是先不要提交") == nil)
    #expect(ShortReply("是什么意思") == nil)
}

@Test func languageSwitchRequiresConfirmationAndSurvivesRefresh() async {
    let e = FormEngine(conversation: StubConversation(decision: .init(intent: .help, explanation: "Form overview.")))
    var input = snapshot([FormField(id: "job", label: "Occupation", kind: .text, required: true)])
    input.conversationLanguage = "en"
    _ = await e.handle(input)
    let offered = await e.handle(say("请帮我解释这个报名表格"))
    #expect(offered.actions.isEmpty)
    #expect(offered.question?.text.contains("continue") == true)
    _ = await e.handle(input)
    let accepted = await e.handle(say("是的"))
    #expect(accepted.conversationLanguage?.hasPrefix("zh") == true)
    #expect(accepted.actions.isEmpty)
}
@Test func unsupportedLanguageNeverFills() async {
    let e = FormEngine(conversation: StubConversation(decision: .init(intent: .answer,
        values: [.init(fieldId: "job", source: "engineer", value: "engineer")])))
    var input = snapshot([FormField(id: "job", label: "Occupation", kind: .text, required: true)])
    input.conversationLanguage = "zz"
    _ = await e.handle(input)
    let result = await e.handle(say("engineer"))
    #expect(result.actions.isEmpty)
    #expect(result.question?.text.contains("supported") == true)
}

@Test func unrelatedScriptInSpokenNameRequiresSpelling() async {
    let e = FormEngine(conversation: StubConversation(decision: .init(intent: .answer,
        values: [.init(fieldId: "name", source: "ليلى", value: "ليلى")])))
    var input = snapshot([FormField(id: "name", label: "姓名", kind: .text, required: true, autocomplete: "name")])
    input.conversationLanguage = "en"; input.formLanguage = "zh-Hans"
    _ = await e.handle(input)
    var answer = say("ليلى"); answer.source = "voice"
    let result = await e.handle(answer)
    #expect(result.actions.isEmpty)
    #expect(result.message?.contains("spelling") == true)
}
@Test func originalNameIsNotTranslatedToFormLanguage() async {
    let e = FormEngine(conversation: StubConversation(decision: .init(intent: .answer,
        values: [.init(fieldId: "name", source: "Alex Demo", value: "Alex Demo")])))
    var input = snapshot([FormField(id: "name", label: "姓名", kind: .text, required: true, autocomplete: "name")])
    input.conversationLanguage = "en"; input.formLanguage = "zh-Hans"
    _ = await e.handle(input)
    var answer = say("My name is Alex Demo"); answer.source = "voice"
    let result = await e.handle(answer)
    #expect(result.actions == [FillAction(fieldId: "name", value: "Alex Demo")])
}
@Test func nameScriptCheckSupportsOriginalSpellings() {
    #expect(!FieldRules.nameNeedsSpellingConfirmation("Élodie O’Connor", conversationLanguage: "en"))
    #expect(!FieldRules.nameNeedsSpellingConfirmation("李华", conversationLanguage: "zh-Hans"))
    #expect(!FieldRules.nameNeedsSpellingConfirmation("ليلى", conversationLanguage: "ar"))
    #expect(FieldRules.nameNeedsSpellingConfirmation("ليلى", conversationLanguage: "en"))
}

@Test(.enabled(if: FoundationModelExtractor.isAvailable))
func liveCrossLanguageMappingBothDirections() async throws {
    let reasoner = LocalConversationReasoner()
    let english = [FormField(id: "occupation", label: "Occupation", kind: .text, required: true)]
    let chinese = [FormField(id: "occupation", label: "职业", kind: .text, required: true)]
    let intoEnglish = try await reasoner.decide(text: "我的职业是软件工程师", fields: english,
        question: Question(text: "您的职业是什么？", fieldIds: ["occupation"]), language: "zh-Hans", formLanguage: "en")
    #expect(intoEnglish.intent == .answer)
    #expect(intoEnglish.values.contains { $0.fieldId == "occupation" && $0.value.lowercased().contains("engineer") && "我的职业是软件工程师".contains($0.source) })
    let intoChinese = try await reasoner.decide(text: "I am a software engineer.", fields: chinese,
        question: Question(text: "What is your occupation?", fieldIds: ["occupation"]), language: "en", formLanguage: "zh")
    #expect(intoChinese.intent == .answer)
    #expect(intoChinese.values.contains { $0.fieldId == "occupation" && ($0.value.contains("工程师") || $0.value.contains("工程師")) })
}
@Test(.enabled(if: FoundationModelExtractor.isAvailable))
func liveExplanationAndLocalizedQuestion() async throws {
    let reasoner = LocalConversationReasoner()
    let explanation = try await reasoner.decide(text: "帮我解释这个表格，需要填写什么？",
        fields: [FormField(id: "job", label: "Occupation", kind: .text, required: true)],
        question: nil, language: "zh-Hans", formLanguage: "en")
    #expect(explanation.intent != .answer)
    #expect(explanation.values.isEmpty)
    #expect(ConversationLanguage.detect(explanation.explanation)?.hasPrefix("zh") == true)
    let french = try await reasoner.translate("What is your email address?", language: "fr")
    #expect(ConversationLanguage.detect(french) == "fr")
    let english = try await reasoner.translate("What's your 职业?", language: "en")
    #expect(!english.contains("职业"))
    #expect(english.lowercased().contains("occupation") || english.lowercased().contains("profession") || english.lowercased().contains("job"))
}

@Test(.enabled(if: FoundationModelExtractor.isAvailable))
func liveLocalizedAutomaticTranslation() async throws {
    let e = FormEngine(conversation: LocalConversationReasoner())
    var input = snapshot([FormField(id: "job", label: "Occupation", kind: .text, required: true)])
    input.conversationLanguage = "zh-Hans"
    input.formLanguage = "en"
    let initial = await e.handle(input)
    #expect(ConversationLanguage.detect(initial.question?.text ?? "")?.hasPrefix("zh") == true)
    let preview = await e.handle(say("我的职业是软件工程师"))
    #expect(preview.actions.first?.value.lowercased().contains("engineer") == true)
    #expect(preview.status != .submit)
}

@Test(.enabled(if: FoundationModelExtractor.isAvailable))
func liveReviewExplainsChineseOptionInEnglish() async throws {
    let e = FormEngine(conversation: LocalConversationReasoner())
    var input = snapshot([FormField(id: "size", label: "T恤尺码", kind: .select, required: true,
        options: [FieldOption(value: "s", label: "小号"), FieldOption(value: "m", label: "中号")])])
    input.conversationLanguage = "en"; input.formLanguage = "zh-Hans"
    _ = await e.handle(input)
    let preview = await e.handle(say("I would like the small T-shirt size."))
    #expect(preview.actions == [FillAction(fieldId: "size", value: "s")])
    #expect(preview.status != .submit)
}

@Test func standardNameQuestionUsesMeaningNotForeignLabel() {
    let field = FormField(id: "name", label: "姓名", kind: .text, required: true, autocomplete: "name")
    #expect(FormEngine.question(for: field, among: [field]).text == "What's your full name?")
    let email = FormField(id: "email", label: "电子邮箱", kind: .email, required: true, autocomplete: "email")
    #expect(FormEngine.question(for: email, among: [email]).text == "What's your email address?")
}
@Test(.enabled(if: FoundationModelExtractor.isAvailable))
func liveChineseNameQuestionIsEntirelyEnglish() async throws {
    let reasoner = LocalConversationReasoner()
    let translated = try await reasoner.translate("What's your 姓名?", language: "en")
    #expect(translated.lowercased().contains("name"))
    #expect(!translated.contains("姓名"))
    #expect(!translated.lowercased().contains("xing"))
    let e = FormEngine(conversation: reasoner)
    var input = snapshot([FormField(id: "name", label: "姓名", kind: .text, required: true, autocomplete: "name")])
    input.conversationLanguage = "en"; input.formLanguage = "zh-Hans"
    let reply = await e.handle(input)
    #expect(reply.question?.text.lowercased().contains("name") == true)
    #expect(reply.question?.text.contains("姓名") != true)
}

@Test(.enabled(if: FoundationModelExtractor.isAvailable))
func livePageExplanationAcrossLanguages() async throws {
    let reasoner = LocalConversationReasoner()
    for page in ["报名表单系统。在线设计表单。登录。免费注册。", "Créer des formulaires d'inscription en ligne. Se connecter. Inscription gratuite."] {
        let answer = try await reasoner.explainPage(text: "Explain this website to me", page: page, language: "en")
        #expect(answer.lowercased().contains("form"))
        #expect(answer.count <= 1000)
        #expect(answer.range(of: "[\\p{Han}]", options: .regularExpression) == nil)
    }
}

@Test(.enabled(if: FoundationModelExtractor.isAvailable))
func liveExplanationStreamsOrFallsBackWithoutDuplicateText() async throws {
    final class Collected: @unchecked Sendable {
        let lock = NSLock()
        var chunks: [(String, Int, Bool)] = []
        func add(_ text: String, _ seq: Int, _ final: Bool) { lock.lock(); defer { lock.unlock() }; chunks.append((text, seq, final)) }
    }
    let collected = Collected()
    let answer = try await LocalConversationReasoner().streamPage(
        text: "Explain the three steps in three sentences.",
        page: "Create an account. Choose a registration template. Publish the completed form.", language: "en") {
            collected.add($0, $1, $2)
        }
    #expect(collected.chunks.contains { !$0.2 })
    #expect(collected.chunks.last?.2 == true)
    #expect(collected.chunks.map { $0.1 } == Array(0..<collected.chunks.count))
    #expect(collected.chunks.map { $0.0 }.joined() == answer)
}

@Test(.enabled(if: FoundationModelExtractor.isAvailable))
func liveUnsupportedActionIsNotAFormAnswer() async throws {
    let result = try await LocalConversationReasoner().decide(text: "Open a template for me", fields: [FormField(id: "name", label: "Name", kind: .text)], question: nil, language: "en", formLanguage: "en")
    #expect(result.intent == .unsupported)
    #expect(result.values.isEmpty)
}

}
