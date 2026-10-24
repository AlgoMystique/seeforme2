import Foundation

// Wire types for contract/PROTOCOL.md v1. Keep in sync with that file.

public let protocolVersion = 1

public enum FieldKind: String, Codable, Sendable {
    case text, email, tel, url, number, date, time, textarea, select, checkbox
    case radioGroup = "radio-group"
    /// Any kind this host does not understand. Never filled.
    case unsupported

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = FieldKind(rawValue: raw) ?? .unsupported
    }
}

public struct FieldOption: Codable, Sendable, Equatable {
    public var value: String
    public var label: String

    public init(value: String, label: String) {
        self.value = value
        self.label = label
    }
}

public struct FormField: Codable, Sendable, Equatable {
    public var id: String
    public var label: String
    public var kind: FieldKind
    public var required: Bool
    public var visible: Bool
    public var disabled: Bool
    public var currentValuePresent: Bool
    public var options: [FieldOption]?
    public var autocomplete: String?
    public var placeholder: String?
    public var maxLength: Int?
    public var language: String?
    public var instructions: String?

    public init(id: String, label: String, kind: FieldKind, required: Bool = false, visible: Bool = true,
                disabled: Bool = false, currentValuePresent: Bool = false, options: [FieldOption]? = nil,
                autocomplete: String? = nil, placeholder: String? = nil, maxLength: Int? = nil) {
        self.id = id
        self.label = label
        self.kind = kind
        self.required = required
        self.visible = visible
        self.disabled = disabled
        self.currentValuePresent = currentValuePresent
        self.options = options
        self.autocomplete = autocomplete
        self.placeholder = placeholder
        self.maxLength = maxLength
    }

    /// Whether the host may ever propose a value for this field.
    var isFillable: Bool {
        guard visible, !disabled, kind != .unsupported else { return false }
        let ac = autocomplete?.lowercased() ?? ""
        return !ac.hasPrefix("cc-") && !ac.contains("password")
    }
}

public struct FillResultItem: Codable, Sendable {
    public var fieldId: String
    public var success: Bool
    public var errorCode: String?
}

public struct ValidationIssue: Codable, Sendable {
    public var fieldId: String
    public var code: String
    public var message: String?
}

/// Every extension → host message. Flat: optional fields depend on `type`.
public struct InboundMessage: Codable, Sendable {
    public var v: Int
    public var type: String
    public var sessionId: String
    public var requestId: String
    public var pageOrigin: String?
    public var utteranceId: String?
    public var pageTitle: String?
    public var pageText: String?
    public var conversationLanguage: String?
    public var formLanguage: String?
    public var fields: [FormField]?
    public var text: String?
    public var source: String?
    public var results: [FillResultItem]?
    public var missingRequiredFieldIds: [String]?
    public var validationIssues: [ValidationIssue]?
    /// FORM_SNAPSHOT: the extension found exactly one submit control it can use.
    public var submitAvailable: Bool?
    /// SUBMIT_RESULT
    public var success: Bool?
    public var errorCode: String?

    public init(v: Int = protocolVersion, type: String, sessionId: String, requestId: String,
                pageOrigin: String? = nil, fields: [FormField]? = nil, text: String? = nil, source: String? = nil,
                results: [FillResultItem]? = nil, missingRequiredFieldIds: [String]? = nil,
                validationIssues: [ValidationIssue]? = nil, submitAvailable: Bool? = nil,
                success: Bool? = nil, errorCode: String? = nil) {
        self.v = v
        self.type = type
        self.sessionId = sessionId
        self.requestId = requestId
        self.pageOrigin = pageOrigin
        self.fields = fields
        self.text = text
        self.source = source
        self.results = results
        self.missingRequiredFieldIds = missingRequiredFieldIds
        self.validationIssues = validationIssues
        self.submitAvailable = submitAvailable
        self.success = success
        self.errorCode = errorCode
    }
}

public struct FillAction: Codable, Sendable, Equatable {
    public var fieldId: String
    public var value: String
    public var overwrite: Bool?
}

public struct Question: Codable, Sendable, Equatable {
    public var text: String
    public var fieldIds: [String]
}

public enum ReplyStatus: String, Codable, Sendable {
    case needsInput = "needs_input"
    case readyForReview = "ready_for_review"
    /// The user explicitly confirmed submission; the extension re-checks and submits, then sends SUBMIT_RESULT.
    case submit
    case ended
    case error
}

public enum HostErrorCode: String, Codable, Sendable {
    case badVersion = "BAD_VERSION"
    case badSchema = "BAD_SCHEMA"
    case tooLarge = "TOO_LARGE"
    case unknownSession = "UNKNOWN_SESSION"
    case originMismatch = "ORIGIN_MISMATCH"
    case originNotAllowed = "ORIGIN_NOT_ALLOWED"
    case `internal` = "INTERNAL"
}

public struct HostReply: Codable, Sendable {
    public var v = protocolVersion
    public var type = "HOST_REPLY"
    public var sessionId: String
    public var requestId: String
    public var status: ReplyStatus
    public var actions: [FillAction] = []
    public var question: Question?
    public var message: String?
    public var modelAvailable: Bool
    public var errorCode: HostErrorCode?
    public var conversationLanguage: String?

    static func error(_ code: HostErrorCode, sessionId: String, requestId: String, modelAvailable: Bool) -> HostReply {
        HostReply(sessionId: sessionId, requestId: requestId, status: .error, modelAvailable: modelAvailable, errorCode: code)
    }

    /// The reply as a dictionary Safari can hand to JavaScript.
    public func jsonObject() -> [String: Any] {
        guard let data = try? JSONEncoder().encode(self),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
        return dict
    }
}

/// Native app → extension push (PROTOCOL.md section 5).
public struct UserInputPush: Codable, Sendable {
    public var v = protocolVersion
    public var type = "USER_INPUT"
    public var utteranceId: String?
    public var text: String
    public var source: String

    public init(text: String, source: String) {
        self.text = text
        self.source = source
    }
}

public enum ProtocolLimits {
    public static let maxMessageBytes = 64 * 1024
    public static let maxFields = 150
    public static let maxUtteranceChars = 1000
    public static let maxLabelChars = 120
}
