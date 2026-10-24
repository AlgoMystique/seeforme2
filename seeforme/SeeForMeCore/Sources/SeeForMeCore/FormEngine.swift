import Foundation

/// Handles extension messages for all sessions. Holds only field metadata, never field values:
/// values exist only inside the reply that carries them to the extension.
public actor FormEngine {
    struct Session {
        var language = ConversationLanguage.system
        var formLanguage: String?
        var pageText = ""
        var pendingLanguage: String?
        var pendingLanguageText: String?
        var declinedLanguages: Set<String> = []
        var pendingTranslation: [FillAction] = []
        var pendingSchema: [FormField] = []
        var origin: String
        var order: [String]
        var fields: [String: FormField]
        var filledByUs: Set<String> = []
        var question: Question?
        var prompt: Prompt = .none
        var issueFieldIds: [String] = []
        /// nil until the user is asked whether to fill optional fields.
        var wantsOptional: Bool?
        var skipped: Set<String> = []
        /// The extension found exactly one submit control for this form (PROTOCOL.md 3.1).
        var submitAvailable = false
        var submitDeclined = false
        var awaitingSubmitResult = false
        var lastUsed = Date()
    }

    /// What the last question asked, so short replies like "yes" or "skip" can be read in context.
    enum Prompt: Equatable {
        case none, field, optionalOffer, submitConfirm
        case optionalField(String)
    }

    private var translationCache: [String: String] = [:]
    private let conversation: (any ConversationReasoner)?
    private var sessions: [String: Session] = [:]
    private let primary: any FieldExtractor
    private let fallback: any FieldExtractor
    private let modelAvailable: @Sendable () -> Bool

    static let sessionLifetime: TimeInterval = 30 * 60
    static let maxSessions = 20

    public init(conversation: (any ConversationReasoner)? = nil, primary: any FieldExtractor = FoundationModelExtractor(),
                fallback: any FieldExtractor = HeuristicExtractor(),
                modelAvailable: @escaping @Sendable () -> Bool = { FoundationModelExtractor.isAvailable }) {
        self.conversation = conversation
        self.primary = primary
        self.fallback = fallback
        self.modelAvailable = modelAvailable
    }

    // MARK: Entry points

    /// Handles a message as received from Safari (a JSON-compatible object).
    public func handle(jsonObject: sending Any) async -> HostReply {
        guard JSONSerialization.isValidJSONObject(jsonObject),
              let data = try? JSONSerialization.data(withJSONObject: jsonObject) else {
            return .error(.badSchema, sessionId: "", requestId: "", modelAvailable: modelAvailable())
        }
        return await handle(data: data)
    }

    public func handle(data: Data) async -> HostReply {
        let available = modelAvailable()
        guard data.count <= ProtocolLimits.maxMessageBytes else {
            return .error(.tooLarge, sessionId: "", requestId: "", modelAvailable: available)
        }
        guard let message = try? JSONDecoder().decode(InboundMessage.self, from: data) else {
            return .error(.badSchema, sessionId: "", requestId: "", modelAvailable: available)
        }
        return await handle(message)
    }

    public func handle(_ message: InboundMessage) async -> HostReply {
        var reply = await process(message)
        guard let conversation, var session = sessions[message.sessionId] else { return reply }
        reply.conversationLanguage = session.language
        guard ConversationLanguage.supported(session.language) else {
            reply.actions = []
            reply.status = .needsInput
            reply.question = Question(text: "This language isn't supported by the on-device model. Choose a supported conversation language in Settings.", fieldIds: [])
            reply.message = nil
            return reply
        }
        if session.pendingLanguage == nil {
            do {
                if let text = reply.message { reply.message = try await localized(text, language: session.language, using: conversation) }
                if let q = reply.question {
                    reply.question = Question(text: try await localized(q.text, language: session.language, using: conversation), fieldIds: q.fieldIds)
                }
            } catch {
                // Failed translation cannot leave an invisible approval pending.
                session.pendingTranslation = []; session.pendingSchema = []; session.pendingLanguage = nil; session.pendingLanguageText = nil; session.prompt = .none
                // Do not perform actions when we cannot explain them in the chosen language.
                reply.actions = []; reply.status = .needsInput
                reply.message = nil
                reply.question = Question(text: "Translation is temporarily unavailable. Please retry or choose another language.", fieldIds: [])
            }
        }
        session.question = reply.question
        if sessions[message.sessionId] != nil { sessions[message.sessionId] = session }
        return reply
    }

    private func localized(_ text: String, language: String, using reasoner: any ConversationReasoner) async throws -> String {
        let key = language + "\n" + text
        if let cached = translationCache[key] { return cached }
        let matches = Array(text.matches(of: /«[^»]*»/))
        var protected = text
        var quoted: [(String, String)] = []
        for (index, match) in matches.enumerated().reversed() {
            let token = "SFM_VALUE_" + String(index)
            quoted.append((token, String(match.output)))
            protected.replaceSubrange(match.range, with: token)
        }
        var result = try await reasoner.translate(protected, language: language)
        for (token, original) in quoted {
            guard result.contains(token) else { throw ConversationError.unsupported }
            result = result.replacingOccurrences(of: token, with: original)
        }
        guard result.count <= 1000 else { throw ConversationError.unsupported }
        if translationCache.count >= 100 { translationCache.removeAll() }
        translationCache[key] = result
        return result
    }

    private func process(_ message: InboundMessage) async -> HostReply {
        let available = modelAvailable()
        let fail = { (code: HostErrorCode) in
            HostReply.error(code, sessionId: message.sessionId, requestId: message.requestId, modelAvailable: available)
        }
        guard message.v == protocolVersion else { return fail(.badVersion) }
        guard !message.sessionId.isEmpty, !message.requestId.isEmpty else { return fail(.badSchema) }
        expireSessions()

        switch message.type {
        case "FORM_SNAPSHOT":
            return snapshot(message, fail: fail)
        case "SESSION_RESET":
            sessions[message.sessionId] = nil
            return HostReply(sessionId: message.sessionId, requestId: message.requestId, status: .ended, modelAvailable: available)
        case "SUBMIT_RESULT":
            guard var session = sessions[message.sessionId] else { return fail(.unknownSession) }
            guard session.awaitingSubmitResult, let success = message.success else { return fail(.badSchema) }
            let reply = submitResult(success: success, errorCode: message.errorCode, session: &session, message: message)
            sessions[message.sessionId] = session
            return reply
        case "USER_UTTERANCE", "FILL_RESULT", "FORM_STATUS":
            guard var session = sessions[message.sessionId] else { return fail(.unknownSession) }
            session.lastUsed = Date()
            let reply: HostReply
            if message.type == "USER_UTTERANCE" {
                guard let text = message.text, !text.isEmpty, text.count <= ProtocolLimits.maxUtteranceChars else {
                    return fail(.badSchema)
                }
                reply = await utterance(text, session: &session, message: message)
            } else {
                reply = status(message, session: &session)
            }
            sessions[message.sessionId] = session
            return reply
        default:
            return fail(.badSchema)
        }
    }

    // MARK: Handlers

    private func snapshot(_ message: InboundMessage, fail: (HostErrorCode) -> HostReply) -> HostReply {
        guard (message.pageText?.count ?? 0) <= 6000, let origin = message.pageOrigin, let fields = message.fields else { return fail(.badSchema) }
        guard message.conversationLanguage.map(ConversationLanguage.validTag) ?? true,
              message.formLanguage.map({ $0.isEmpty || ConversationLanguage.validTag($0) }) ?? true,
              fields.allSatisfy({ ($0.language.map(ConversationLanguage.validTag) ?? true) && ($0.instructions?.count ?? 0) <= 300 })
        else { return fail(.badSchema) }
        guard Self.isAllowedOrigin(origin) else { return fail(.originNotAllowed) }
        guard fields.count <= ProtocolLimits.maxFields,
              Set(fields.map(\.id)).count == fields.count,
              !fields.contains(where: { $0.id.isEmpty }) else { return fail(.badSchema) }

        var session = sessions[message.sessionId] ?? Session(origin: origin, order: [], fields: [:])
        guard session.origin == origin else { return fail(.originMismatch) }
        if sessions[message.sessionId] == nil, sessions.count >= Self.maxSessions,
           let oldest = sessions.min(by: { $0.value.lastUsed < $1.value.lastUsed })?.key {
            sessions[oldest] = nil
        }

        if let language = message.conversationLanguage, !language.isEmpty {
            if language != session.language { session.pendingTranslation = []; session.pendingSchema = [] }
            session.language = String(language.prefix(40))
        }
        session.formLanguage = message.formLanguage
        session.pageText = message.pageText ?? ""
        if !session.pendingSchema.isEmpty && fields != session.pendingSchema {
            session.pendingTranslation = []; session.pendingSchema = []
        }
        session.order = fields.map(\.id)
        session.fields = Dictionary(uniqueKeysWithValues: fields.map { field in
            var field = field
            field.label = String(field.label.prefix(ProtocolLimits.maxLabelChars))
            return (field.id, field)
        })
        session.filledByUs.formIntersection(session.order)
        session.submitAvailable = message.submitAvailable ?? false
        session.lastUsed = Date()

        let reply = session.pendingLanguage != nil
            ? HostReply(sessionId: message.sessionId, requestId: message.requestId, status: .needsInput, question: session.question, modelAvailable: modelAvailable())
            : session.pendingTranslation.isEmpty
            ? nextStep(&session, message: message, actions: [], note: nil)
            : translationReview(session, message: message)
        sessions[message.sessionId] = session
        return reply
    }

    private func pageExplanation(text: String, session: Session, message: InboundMessage, using reasoner: any ConversationReasoner) async throws -> String {
        guard message.source == "voice", let id = message.utteranceId, UUID(uuidString: id) != nil else {
            return try await reasoner.explainPage(text: text, page: session.pageText, language: session.language)
        }
        return try await reasoner.streamPage(text: text, page: session.pageText, language: session.language) { text, seq, final in
            HostReplyBroadcast.postSentence(text, utteranceId: id, sequence: seq, final: final)
        }
    }

    private func utterance(_ text: String, session: inout Session, message: InboundMessage) async -> HostReply {
        if session.fields.isEmpty {
            var answer = "I couldn't read enough page text to explain it. Try a page with visible text."
            if !session.pageText.isEmpty, let conversation, modelAvailable() {
                do { answer = try await pageExplanation(text: text, session: session, message: message, using: conversation) }
                catch { answer = "Page explanation is temporarily unavailable. Please try again." }
            }
            session.prompt = .none
            session.question = Question(text: answer, fieldIds: [])
            return HostReply(sessionId: message.sessionId, requestId: message.requestId, status: .needsInput,
                             question: session.question, modelAvailable: modelAvailable())
        }
        // Short replies ("yes", "no", "skip", "that's all") answer the last question; they never fill fields here.
        let short = ShortReply(text)
        if let language = session.pendingLanguage {
            let original = session.pendingLanguageText
            session.pendingLanguage = nil; session.pendingLanguageText = nil
            if short == .yes {
                session.language = language
                _ = nextStep(&session, message: message, actions: [], note: nil)
                if let original { return await utterance(original, session: &session, message: message) }
            } else { session.declinedLanguages.insert(language) }
            if short != nil { return nextStep(&session, message: message, actions: [], note: nil) }
        }
        if conversation != nil && !modelAvailable() {
            return HostReply(sessionId: message.sessionId, requestId: message.requestId, status: .needsInput,
                             question: session.question, message: "On-device reasoning is unavailable. No fields were changed.",
                             modelAvailable: false)
        }
        if conversation != nil && !ConversationLanguage.supported(session.language) {
            return nextStep(&session, message: message, actions: [], note: nil)
        }
        if !session.pendingTranslation.isEmpty {
            let pending = session.pendingTranslation
            session.pendingTranslation = []; session.pendingSchema = []
            if short == .yes {
                return nextStep(&session, message: message, actions: pending, note: "Applying the answers you approved.")
            }
            if short != nil {
                return nextStep(&session, message: message, actions: [], note: "Those answers were not applied. Please give the corrected details.")
            }
        }
        switch session.prompt {
        case .optionalOffer:
            if let short {
                session.wantsOptional = short == .yes
                return nextStep(&session, message: message, actions: [], note: nil)
            }
            session.wantsOptional = true // Answered with details, e.g. "my company is Acme".
        case .optionalField(let id):
            if short == .skip || short == .no {
                session.skipped.insert(id)
                return nextStep(&session, message: message, actions: [], note: nil)
            }
            if short == .done {
                session.wantsOptional = false
                return nextStep(&session, message: message, actions: [], note: nil)
            }
        case .submitConfirm:
            if short == .yes {
                // Explicit confirmation of the submit question just asked. The extension re-checks the form before submitting.
                session.prompt = .none
                session.question = nil
                session.awaitingSubmitResult = true
                return HostReply(sessionId: message.sessionId, requestId: message.requestId, status: .submit,
                                 message: "Submitting the form now.", modelAvailable: modelAvailable())
            }
            if short != nil {
                session.submitDeclined = true
                return nextStep(&session, message: message, actions: [],
                                note: "Okay, I won't submit it. You can review the form and submit it yourself.")
            }
        case .none, .field:
            break
        }

        // Deterministic recovery for spoken identifiers when one field is being asked.
        // Explicit spelling fills directly and never authorizes submission.
        let targeted = (session.question?.fieldIds ?? []).compactMap { session.fields[$0] }
        if message.source == "voice", targeted.count == 1, let field = targeted.first, field.isFillable,
           !field.currentValuePresent || session.filledByUs.contains(field.id) {
            let explicit: String? = FieldRules.isName(field) ? FieldRules.spelledName(text)
                : field.kind == .email ? FieldRules.spokenEmail(text) : nil
            if let explicit, let value = FieldRules.normalize(explicit, for: field) {
                return nextStep(&session, message: message, actions: [FillAction(fieldId: field.id, value: value,
                    overwrite: session.filledByUs.contains(field.id) ? true : nil)], note: nil)
            }
        }
        let candidates = session.order.compactMap { session.fields[$0] }.filter(\.isFillable)
        if let conversation, modelAvailable() {
            do {
                let decision = try await conversation.decide(text: text, fields: candidates, question: session.question,
                                                             language: session.language, formLanguage: session.formLanguage)
                if [.help, .explain].contains(decision.intent), text.count >= 8,
                   let detected = ConversationLanguage.detect(text),
                   !ConversationLanguage.same(detected, session.language),
                   ConversationLanguage.supported(detected), !session.declinedLanguages.contains(detected) {
                    let offer = "Would you like to continue in " + ConversationLanguage.name(detected) + "? Say yes or no."
                    let current = try await localized(offer, language: session.language, using: conversation)
                    let other = try await localized(offer, language: detected, using: conversation)
                    session.pendingLanguage = detected; session.pendingLanguageText = text
                    session.prompt = .none
                    session.question = Question(text: current + " / " + other, fieldIds: [])
                    return HostReply(sessionId: message.sessionId, requestId: message.requestId, status: .needsInput,
                                     question: session.question, modelAvailable: true)
                }
                if decision.intent == .language {
                    if let language = decision.language, ConversationLanguage.supported(language) {
                        session.language = language
                    }
                    return nextStep(&session, message: message, actions: [], note: "Conversation language: " + ConversationLanguage.name(session.language) + ".")
                }
                if decision.intent != .answer {
                    // Explanations never advance consent or produce actions.
                    if !session.pageText.isEmpty {
                        let explanation = try await pageExplanation(text: text, session: session, message: message, using: conversation)
                        return HostReply(sessionId: message.sessionId, requestId: message.requestId,
                            status: .needsInput, question: Question(text: explanation, fieldIds: []), modelAvailable: true)
                    }
                    return HostReply(sessionId: message.sessionId, requestId: message.requestId,
                                     status: session.prompt == .submitConfirm ? .readyForReview : .needsInput,
                                     question: session.question, message: decision.explanation, modelAvailable: true)
                }
                var needsNameSpelling = false
                var direct: [Proposal] = []
                var translated: [FillAction] = []
                var seen: Set<String> = []
                for value in decision.values {
                    guard seen.insert(value.fieldId).inserted,
                          !value.source.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                          text.localizedCaseInsensitiveContains(value.source),
                          let field = session.fields[value.fieldId], field.isFillable,
                          !field.currentValuePresent || session.filledByUs.contains(field.id),
                          let normalized = FieldRules.normalize(value.value, for: field) else { continue }
                    if message.source == "voice", FieldRules.isName(field),
                       FieldRules.nameNeedsSpellingConfirmation(normalized, conversationLanguage: session.language) {
                        needsNameSpelling = true
                        continue
                    }
                    if FieldRules.isGrounded(normalized, field: field, utterance: text,
                                            isTargeted: session.question?.fieldIds.contains(field.id) == true) {
                        if message.source == "voice", field.kind == .email {
                            translated.append(FillAction(fieldId: field.id, value: normalized,
                                overwrite: session.filledByUs.contains(field.id) ? true : nil))
                        } else { direct.append(Proposal(fieldId: field.id, value: normalized)) }
                    } else if [.text, .textarea, .select, .radioGroup].contains(field.kind) {
                        // Changed-language text needs an explicit preview approval.
                        // Never translate names, addresses or other identifiers automatically.
                        guard !FieldRules.isIdentity(field) else { continue }
                        translated.append(FillAction(fieldId: field.id, value: normalized,
                                                     overwrite: session.filledByUs.contains(field.id) ? true : nil))
                    }
                }
                if needsNameSpelling {
                    return nextStep(&session, message: message, actions: [],
                        note: "I may have misheard the spelling of your name. Please say its spelling in a full sentence, or type your original/legal spelling. I will keep that spelling rather than translate your name.")
                }
                let actions = validate(direct, utterance: text, session: session)
                if !translated.isEmpty {
                    if (actions + translated).reduce(0, { $0 + $1.value.count + (session.fields[$1.fieldId]?.label.count ?? 0) }) > 450 {
                        return nextStep(&session, message: message, actions: [], note: "Please give one shorter answer at a time so I can translate it accurately.")
                    }
                    return nextStep(&session, message: message, actions: actions + translated, note: nil)
                }
                return nextStep(&session, message: message, actions: actions,
                                note: actions.isEmpty ? (targeted.contains(where: { $0.kind == .email })
                                    ? "I couldn't verify the exact email address. Please say every dot, at sign or underscore, or type it. I won't guess missing characters."
                                    : "I couldn't verify that answer. Please spell the detail or type its exact wording.") : nil)
            } catch {
                return HostReply(sessionId: message.sessionId, requestId: message.requestId, status: .needsInput,
                                 question: session.question, message: "I couldn't interpret that safely. Please try again; no fields were changed.",
                                 modelAvailable: modelAvailable())
            }
        }
        var proposals: [Proposal]
        do {
            proposals = modelAvailable()
                ? try await primary.extract(utterance: text, fields: candidates, question: session.question)
                : try await fallback.extract(utterance: text, fields: candidates, question: session.question)
        } catch {
            proposals = (try? await fallback.extract(utterance: text, fields: candidates, question: session.question)) ?? []
        }
        proposals = HeuristicExtractor.completeFamilyName(proposals, utterance: text, fields: candidates)

        let actions = validate(proposals, utterance: text, session: session)
        let labels = actions.compactMap { session.fields[$0.fieldId]?.label }
        let note: String
        if labels.isEmpty {
            note = "I didn't find a value for this form in that answer."
        } else {
            note = "Filled \(Self.list(labels))."
        }
        return nextStep(&session, message: message, actions: actions, note: note)
    }

    private func translationReview(_ session: Session, message: InboundMessage) -> HostReply {
        let preview = session.pendingTranslation.map { action in
            let field = session.fields[action.fieldId]
            let label = field?.options?.first(where: { $0.value == action.value })?.label ?? action.value
            // Translate meanings into the conversation language; protect only identity
            // spellings, not foreign option labels or descriptive translations.
            let meaning = field.map(FieldRules.isIdentity) == true ? "«" + label + "»" : label
            return "\(field?.label ?? action.fieldId): \(meaning)"
        }.joined(separator: "; ")
        return HostReply(sessionId: message.sessionId, requestId: message.requestId, status: .needsInput,
                         question: Question(text: "I understood these answers: " + preview + ". I will enter the corresponding wording on the form. Is that meaning correct? Say yes to fill or no to correct. This does not submit the form.", fieldIds: []),
                         modelAvailable: modelAvailable())
    }

    private func status(_ message: InboundMessage, session: inout Session) -> HostReply {
        var failedLabels: [String] = []
        for result in message.results ?? [] {
            guard var field = session.fields[result.fieldId] else { continue }
            if result.success {
                field.currentValuePresent = true
                session.filledByUs.insert(field.id)
            } else {
                failedLabels.append(field.label)
            }
            session.fields[field.id] = field
        }
        // The extension's read-back of the page is the truth for what is still empty.
        for id in message.missingRequiredFieldIds ?? [] {
            session.fields[id]?.currentValuePresent = false
            session.filledByUs.remove(id)
        }
        session.issueFieldIds = (message.validationIssues ?? []).filter { $0.code != "REQUIRED_MISSING" }.map(\.fieldId).filter { session.fields[$0] != nil }

        let note = failedLabels.isEmpty ? nil : "I couldn't fill \(Self.list(failedLabels))."
        return nextStep(&session, message: message, actions: [], note: note)
    }

    private func submitResult(success: Bool, errorCode: String?, session: inout Session, message: InboundMessage) -> HostReply {
        session.awaitingSubmitResult = false
        var reply = HostReply(sessionId: message.sessionId, requestId: message.requestId, status: .ended, modelAvailable: modelAvailable())
        if success {
            reply.message = "I submitted the form. Check the page to confirm it went through."
            return reply
        }
        session.submitDeclined = true
        reply.status = .readyForReview
        reply.message = switch errorCode {
        case "VALIDATION_FAILED": "The form reported a problem, so I didn't submit it. Please check the highlighted fields."
        case "NO_SUBMIT_CONTROL": "I couldn't find the submit button, so please submit the form yourself."
        default: "I couldn't submit the form. Please review it and submit it yourself."
        }
        return reply
    }

    // MARK: Validation

    /// Keeps only proposals that pass every deterministic check.
    func validate(_ proposals: [Proposal], utterance: String, session: Session) -> [FillAction] {
        var actions: [FillAction] = []
        var seen: Set<String> = []
        let targeted = Set(session.question?.fieldIds ?? [])
        for proposal in proposals {
            guard !seen.contains(proposal.fieldId),
                  let field = session.fields[proposal.fieldId], field.isFillable,
                  let value = FieldRules.normalize(proposal.value, for: field),
                  FieldRules.isGrounded(value, field: field, utterance: utterance, isTargeted: targeted.contains(field.id))
            else { continue }
            // Never overwrite something the page or the user put there; only correct our own fills.
            let ours = session.filledByUs.contains(field.id)
            if field.currentValuePresent && !ours { continue }
            seen.insert(field.id)
            actions.append(FillAction(fieldId: field.id, value: value, overwrite: ours ? true : nil))
        }
        return actions
    }

    // MARK: Conversation

    private func nextStep(_ session: inout Session, message: InboundMessage, actions: [FillAction], note: String?) -> HostReply {
        if session.fields.isEmpty {
            session.prompt = .none
            session.question = Question(text: "What would you like to understand about this page?", fieldIds: [])
            return HostReply(sessionId: message.sessionId, requestId: message.requestId, status: .needsInput,
                             question: session.question, modelAvailable: modelAvailable())
        }
        let pending = Set(actions.map(\.fieldId))
        let fields = session.order.compactMap { session.fields[$0] }.filter(\.isFillable)
        let missing = fields.filter { $0.required && !$0.currentValuePresent && !pending.contains($0.id) }
        let issues = session.issueFieldIds.compactMap { session.fields[$0] }.filter { !pending.contains($0.id) }

        let optional = fields.filter { !$0.required && !$0.currentValuePresent && !pending.contains($0.id) && !session.skipped.contains($0.id) }

        var reply = HostReply(sessionId: message.sessionId, requestId: message.requestId, status: .needsInput,
                              actions: actions, modelAvailable: modelAvailable())
        var prompt = Prompt.field
        var closing: String?
        if let issue = issues.first {
            reply.question = Question(text: "The form says \"\(issue.label)\" needs fixing. What should it be?", fieldIds: [issue.id])
        } else if let first = missing.first {
            reply.question = Self.question(for: first, among: missing)
        } else if !actions.isEmpty {
            // Wait for the extension's FILL_RESULT before offering optional fields, review, or submission.
            prompt = .none
        } else if session.wantsOptional == nil, !optional.isEmpty {
            prompt = .optionalOffer
            let labels = optional.prefix(3).map { "\"\($0.label)\"" }
            reply.question = Question(text: "All required fields are filled. Would you like to fill in optional fields, such as \(Self.list(labels))? Say yes or no.",
                                      fieldIds: [])
        } else if session.wantsOptional == true, let next = optional.first {
            prompt = .optionalField(next.id)
            let question = Self.question(for: next, among: optional)
            reply.question = Question(text: question.text + " (Optional — say skip to leave it blank, or done to finish.)", fieldIds: [next.id])
        } else {
            reply.status = .readyForReview
            if session.submitAvailable, !session.submitDeclined, !session.awaitingSubmitResult {
                prompt = .submitConfirm
                closing = "Everything is filled in. Please review the form."
                reply.question = Question(text: "Would you like me to submit it now? Say yes to submit, or no to submit it yourself.", fieldIds: [])
            } else {
                prompt = .none
                closing = "Everything is filled in. Please review the form and submit it yourself."
            }
        }
        reply.message = [note, closing].compactMap { $0 }.joined(separator: " ")
        if reply.message?.isEmpty == true { reply.message = nil }
        session.question = reply.question
        session.prompt = reply.question == nil ? .none : prompt
        return reply
    }

    static func question(for field: FormField, among missing: [FormField]) -> Question {
        if field.autocomplete == "given-name",
           let family = missing.first(where: { $0.autocomplete == "family-name" }) {
            return Question(text: "What's your first and last name?", fieldIds: [field.id, family.id])
        }
        // Standard HTML autocomplete semantics are independent of the visible
        // label's language. Keep source labels in metadata, but ask about the
        // known field meaning instead of inserting a foreign label into English.
        let semanticLabels = [
            "name": "full name", "given-name": "first name", "family-name": "last name",
            "additional-name": "middle name", "email": "email address", "tel": "phone number",
            "street-address": "street address", "postal-code": "postal code",
            "organization": "organization"
        ]
        let token = field.autocomplete?.lowercased().split(separator: " ").last.map(String.init) ?? ""
        let label = semanticLabels[token] ?? field.label.trimmingCharacters(in: .whitespacesAndNewlines)
        switch field.kind {
        case .select, .radioGroup:
            let options = (field.options ?? []).filter { !$0.value.isEmpty }.prefix(6).map(\.label)
            return Question(text: "\(label.hasSuffix("?") ? label : "Which \(label)?") Options: \(list(Array(options), joiner: "or")).", fieldIds: [field.id])
        case .checkbox:
            return Question(text: "Should I tick \"\(label)\"? Say yes or no.", fieldIds: [field.id])
        default:
            if label.hasSuffix("?") { return Question(text: label, fieldIds: [field.id]) }
            let lowered = label.count > 1 && label.dropFirst().first?.isLowercase == true
                ? label.prefix(1).lowercased() + label.dropFirst() : label
            return Question(text: "What's your \(lowered)?", fieldIds: [field.id])
        }
    }

    // MARK: Helpers

    static func isAllowedOrigin(_ origin: String) -> Bool {
        guard let url = URL(string: origin), let host = url.host() else { return false }
        switch url.scheme {
        case "https": return true
        case "http": return host == "localhost" || host == "127.0.0.1"
        default: return false
        }
    }

    static func list(_ items: [String], joiner: String = "and") -> String {
        switch items.count {
        case 0: ""
        case 1: items[0]
        default: items.dropLast().joined(separator: ", ") + " \(joiner) " + items.last!
        }
    }

    private func expireSessions() {
        let cutoff = Date().addingTimeInterval(-Self.sessionLifetime)
        sessions = sessions.filter { $0.value.lastUsed > cutoff }
    }
}
