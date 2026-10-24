import Foundation

/// Deterministic checks applied to every proposed value, whoever proposed it.
enum FieldRules {

    static func isName(_ field: FormField) -> Bool {
        if ["name", "given-name", "family-name", "additional-name"].contains(field.autocomplete ?? "") { return true }
        return ["name", "姓名", "名字", "姓氏", "nom", "nombre"].contains { field.label.lowercased().contains($0) }
    }

    /// Short spoken names can be transcribed in an unrelated script. Ask for spelling
    /// instead of treating that transcription as a verified legal name.
    static func nameNeedsSpellingConfirmation(_ value: String, conversationLanguage: String) -> Bool {
        let language = Locale(identifier: conversationLanguage).language.languageCode?.identifier ?? ""
        let scripts: String
        switch language {
        case "zh": scripts = "\\p{Han}\\p{Latin}"
        case "ja": scripts = "\\p{Han}\\p{Hiragana}\\p{Katakana}\\p{Latin}"
        case "ko": scripts = "\\p{Hangul}\\p{Han}\\p{Latin}"
        case "ar": scripts = "\\p{Arabic}\\p{Latin}"
        case "ru", "uk", "bg": scripts = "\\p{Cyrillic}\\p{Latin}"
        case "hi": scripts = "\\p{Devanagari}\\p{Latin}"
        case "el": scripts = "\\p{Greek}\\p{Latin}"
        case "ta": scripts = "\\p{Tamil}\\p{Latin}"
        default: scripts = "\\p{Latin}"
        }
        let pattern = "^[" + scripts + "\\p{M} .’'\\-]+$"
        return value.range(of: pattern, options: .regularExpression) == nil
    }

    static func isIdentity(_ field: FormField) -> Bool {
        if [.email, .tel, .url].contains(field.kind) { return true }
        let identity = ["name", "given-name", "family-name", "organization", "street-address", "address-line1", "address-line2", "postal-code", "username"]
        if identity.contains(field.autocomplete ?? "") { return true }
        let label = field.label.lowercased()
        return ["name", "address", "email", "phone", "姓名", "名字", "姓氏", "地址", "nom", "adresse", "nombre", "dirección"].contains { label.contains($0) }
    }

    // MARK: Normalisation

    /// Converts a proposed value to the wire format for `field.kind`, or nil if it is not valid for the field.
    static func normalize(_ raw: String, for field: FormField) -> String? {
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return nil }

        let result: String?
        switch field.kind {
        case .text, .textarea:
            result = value.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        case .email:
            result = normalizeEmail(value)
        case .tel:
            let digits = value.filter(\.isNumber)
            let allowed = value.allSatisfy { $0.isNumber || " +-().".contains($0) }
            result = allowed && digits.count >= 6 ? value : nil
        case .url:
            result = normalizeURL(value)
        case .number:
            let cleaned = value.replacingOccurrences(of: ",", with: "")
            result = Double(cleaned) != nil ? cleaned : nil
        case .date:
            result = normalizeDate(value)
        case .time:
            result = normalizeTime(value)
        case .select, .radioGroup:
            result = matchOption(value, in: field.options ?? [])?.value
        case .checkbox:
            result = parseBool(value).map { $0 ? "true" : "false" }
        case .unsupported:
            result = nil
        }
        if let result, let max = field.maxLength, max > 0, result.count > max { return nil }
        return result
    }

    /// Parse explicit spelling, never guess a name from pronunciation.
    static func spelledName(_ text: String) -> String? {
        var value = text.trimmingCharacters(in: .whitespacesAndNewlines)
        value = value.replacingOccurrences(of: "(?i)^(?:my name is spelled|my name is|it is spelled|it's spelled|spelled|spell it)\\s+", with: "", options: .regularExpression)
        let letters = value.split { $0.isWhitespace || "-,.".contains($0) }
        guard (2...40).contains(letters.count), letters.allSatisfy({ $0.count == 1 && $0.first!.isLetter }) else { return nil }
        return letters.joined().capitalized
    }

    /// Only explicit punctuation words are converted. Never invent a dot between names.
    static func spokenEmail(_ text: String) -> String? {
        var value = text.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        value = value.replacingOccurrences(of: "^(?:my email address is|my email is|email is|it is|it's)\\s+", with: "", options: .regularExpression)
        for (word, symbol) in [("at", "@"), ("dot", "."), ("underscore", "_"), ("dash", "-")] {
            value = value.replacingOccurrences(of: "\\s+" + word + "\\s+", with: symbol, options: .regularExpression)
        }
        guard !value.contains(where: \.isWhitespace), value.range(of: "^[a-z0-9._%+\\-]+@[a-z0-9.\\-]+\\.[a-z]{2,}$", options: .regularExpression) != nil else { return nil }
        return value
    }

    static func normalizeEmail(_ value: String) -> String? {
        let email = value.lowercased().filter { !$0.isWhitespace }
        let pattern = /^[^@]+@[^@]+\.[a-z]{2,}$/
        return email.wholeMatch(of: pattern) != nil ? email : nil
    }

    static func normalizeURL(_ value: String) -> String? {
        let candidate = value.contains("://") ? value : "https://" + value
        guard let url = URL(string: candidate), let host = url.host(), host.contains("."),
              ["http", "https"].contains(url.scheme?.lowercased() ?? "") else { return nil }
        return candidate
    }

    private static let dateFormats = [
        "yyyy-MM-dd", "MM/dd/yyyy", "M/d/yyyy", "MMMM d, yyyy", "MMMM d yyyy", "d MMMM yyyy",
        "MMM d, yyyy", "MMM d yyyy", "d MMM yyyy", "MMMM dd, yyyy",
    ]

    static func normalizeDate(_ value: String) -> String? {
        // Strip ordinal suffixes: "March 3rd, 1990" → "March 3, 1990".
        let cleaned = value.replacing(/(\d)(st|nd|rd|th)\b/) { $0.output.1 + "" }
        let parser = DateFormatter()
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.timeZone = TimeZone(identifier: "UTC")
        parser.isLenient = false
        for format in dateFormats {
            parser.dateFormat = format
            if let date = parser.date(from: cleaned) {
                parser.dateFormat = "yyyy-MM-dd"
                return parser.string(from: date)
            }
        }
        return nil
    }

    static func normalizeTime(_ value: String) -> String? {
        let parser = DateFormatter()
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.timeZone = TimeZone(identifier: "UTC")
        for format in ["HH:mm", "H:mm", "h:mm a", "h:mma", "h a", "ha"] {
            parser.dateFormat = format
            if let date = parser.date(from: value.uppercased()) {
                parser.dateFormat = "HH:mm"
                return parser.string(from: date)
            }
        }
        return nil
    }

    /// Exact value, then case-insensitive value or label, then a unique partial label match.
    static func matchOption(_ value: String, in options: [FieldOption]) -> FieldOption? {
        let real = options.filter { !$0.value.isEmpty }
        if let exact = real.first(where: { $0.value == value }) { return exact }
        let lower = value.lowercased()
        if let match = real.first(where: { $0.value.lowercased() == lower || $0.label.lowercased() == lower }) {
            return match
        }
        let partial = real.filter { $0.label.lowercased().contains(lower) || lower.contains($0.label.lowercased()) }
        return partial.count == 1 ? partial[0] : nil
    }

    static func parseBool(_ value: String) -> Bool? {
        switch value.lowercased() {
        case "true", "yes", "y", "1", "checked", "on", "agree", "accept": true
        case "false", "no", "n", "0", "unchecked", "off", "disagree", "decline": false
        default: nil
        }
    }

    // MARK: Grounding

    private static let affirmative: Set<String> = ["yes", "yeah", "yep", "sure", "ok", "okay", "agree", "accept", "correct", "absolutely", "tick", "check"]
    private static let negative: Set<String> = ["no", "nope", "not", "don't", "dont", "disagree", "decline", "untick", "uncheck"]
    private static let stopwords: Set<String> = ["the", "and", "for", "you", "your", "with", "this", "that", "have", "are", "from", "agree", "i", "to", "of", "a"]

    /// True if `value` (already normalised) can be traced to what the user said.
    /// This is what stops the model from inventing personal details.
    static func isGrounded(_ value: String, field: FormField, utterance: String, isTargeted: Bool) -> Bool {
        let said = tokens(utterance)
        let saidSet = Set(said)
        switch field.kind {
        case .text, .textarea, .email:
            let valueTokens = tokens(value)
            return !valueTokens.isEmpty && (valueTokens.allSatisfy(saidSet.contains) || (value.unicodeScalars.contains { $0.value > 0x2E80 } && utterance.contains(value)))
        case .url:
            let valueTokens = tokens(value).filter { !["https", "http", "www"].contains($0) }
            return !valueTokens.isEmpty && valueTokens.allSatisfy(saidSet.contains)
        case .tel, .number:
            let digits = value.filter(\.isNumber)
            return !digits.isEmpty && utterance.filter(\.isNumber).contains(digits)
        case .date:
            let parts = value.split(separator: "-").compactMap { Int($0) }
            guard parts.count == 3 else { return false }
            let numbers = Set(said.compactMap { Int($0.replacing(/(st|nd|rd|th)$/, with: "")) })
            let monthNamed = monthNames(parts[1]).contains { saidSet.contains($0) }
            return numbers.contains(parts[2]) && (numbers.contains(parts[0]) || numbers.contains(parts[0] % 100))
                && (monthNamed || numbers.contains(parts[1]))
        case .time:
            guard let hour = Int(value.prefix(2)) else { return false }
            let numbers = Set(said.compactMap { Int($0.prefix { $0.isNumber }) })
            return numbers.contains(hour) || numbers.contains(hour % 12 == 0 ? 12 : hour % 12)
        case .select, .radioGroup:
            guard let option = field.options?.first(where: { $0.value == value }) else { return false }
            let labelTokens = tokens(option.label).filter { $0.count >= 2 || $0.allSatisfy(\.isNumber) }
            return labelTokens.contains(where: saidSet.contains) || saidSet.contains(option.value.lowercased())
        case .checkbox:
            if isTargeted, let reply = ShortReply(utterance) {
                if value == "true" { return reply == .yes }
                if value == "false" { return reply == .no }
            }
            let saysNo = !saidSet.isDisjoint(with: negative)
            let saysYes = !saidSet.isDisjoint(with: affirmative)
            let labelOverlap = tokens(field.label).contains { $0.count >= 4 && !stopwords.contains($0) && saidSet.contains($0) }
            guard isTargeted || labelOverlap else { return false }
            return value == "true" ? (saysYes || labelOverlap) && !saysNo : saysNo
        case .unsupported:
            return false
        }
    }

    static func tokens(_ text: String) -> [String] {
        text.lowercased()
            .split { !($0.isLetter || $0.isNumber || $0 == "'") }
            .map { String($0).trimmingCharacters(in: CharacterSet(charactersIn: "'")) }
            .filter { !$0.isEmpty }
    }

    private static func monthNames(_ month: Int) -> [String] {
        let symbols = DateFormatter()
        symbols.locale = Locale(identifier: "en_US_POSIX")
        guard (1...12).contains(month) else { return [] }
        return [symbols.monthSymbols[month - 1].lowercased(), symbols.shortMonthSymbols[month - 1].lowercased()]
    }
}
