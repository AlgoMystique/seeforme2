import Foundation

/// A short conversational answer such as "yes please", "no thanks", "skip", or "that's all".
/// Anything longer or containing other words returns nil and is treated as a normal answer.
enum ShortReply: Equatable {
    case yes, no, skip, done

    private static let vocabulary: Set<String> = [
        "yes", "yeah", "yep", "sure", "ok", "okay", "please", "go", "ahead", "submit", "do", "it", "absolutely", "correct", "right", "fine",
        "no", "nope", "not", "don't", "dont", "thanks", "thank", "you", "skip", "next", "leave", "blank", "that", "that's", "thats",
        "all", "done", "finished", "more", "nothing", "else", "i'm", "im", "i", "the", "form", "now", "one", "this", "just", "for", "and", "i'll", "ill", "myself", "will", "can", "let's", "lets",
    ]

    init?(_ text: String) {
        let clean = text.lowercased().trimmingCharacters(in: .whitespacesAndNewlines.union(.punctuationCharacters))
        // Exact short phrases only: negation or an explanation must never become consent.
        let yes: Set<String> = ["হ্যাঁ", "হ্যা", "জি", "হ্যাঁ করুন", "是", "是的", "好的", "同意", "确认", "确认提交", "確認提交", "oui", "sí", "sim", "ja", "sì", "はい", "네", "예", "vâng", "đồng ý", "हाँ", "हां", "evet", "ya", "да", "نعم", "d’accord", "d'accord"]
        let no: Set<String> = ["না", "না ধন্যবাদ", "不", "不是", "不要", "不同意", "不要提交", "不提交", "non", "não", "nein", "いいえ", "아니요", "không", "नहीं", "nee", "nej", "nei", "hayır", "tidak", "нет", "لا"]
        let skip: Set<String> = ["跳过", "跳過", "略过", "passer", "saltar", "überspringen", "スキップ", "건너뛰기", "bỏ qua"]
        let done: Set<String> = ["完成", "填完了", "terminé", "terminado", "fertig", "完了", "완료", "xong"]
        if yes.contains(clean) { self = .yes; return }
        if no.contains(clean) { self = .no; return }
        if skip.contains(clean) { self = .skip; return }
        if done.contains(clean) { self = .done; return }
        let tokens = Set(FieldRules.tokens(text))
        guard !tokens.isEmpty, tokens.count <= 6, tokens.isSubset(of: Self.vocabulary) else { return nil }
        if !tokens.isDisjoint(with: ["skip", "next", "blank"]) {
            self = .skip
        } else if !tokens.isDisjoint(with: ["done", "finished", "nothing", "more"]) || tokens.isSuperset(of: ["that's", "all"]) || tokens.isSuperset(of: ["thats", "all"]) {
            self = .done
        } else if !tokens.isDisjoint(with: ["no", "nope", "not", "don't", "dont"]) {
            self = .no
        } else if !tokens.isDisjoint(with: ["yes", "yeah", "yep", "sure", "ok", "okay", "submit", "go", "absolutely", "correct", "right", "fine"]) {
            self = .yes
        } else {
            return nil
        }
    }
}
