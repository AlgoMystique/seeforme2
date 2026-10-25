import Foundation
import AppKit
import PDFKit

/// Local extracted text, never original documents. Each native process writes only its own private store.
/// A durable activation ID makes extension/host restarts resume the same snapshot.
public struct LocalContextSnapshot: Codable, Sendable {
    public struct Document: Codable, Sendable {
        public var text: String
        public init(text: String) { self.text = text }
    }
    /// Optional for backward-compatible decoding of existing private caches.
    public var allowRemoteSpeech: Bool?
    public var preferredLanguage: String? {
        guard active && connected else { return nil }
        var matches = Set<String>()
        for line in documents.flatMap({ $0.text.components(separatedBy: .newlines) }) {
            let clean = line.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "**", with: "")
            guard let range = clean.range(of: #"(?i)^(?:[-*]\s*)?(?:my\s+)?preferr?ed\s+(?:[A-Za-z]+\s+){0,3}language\s*(?::|=|is|[-–—])\s*"#, options: .regularExpression) else { continue }
            let value = String(clean[range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines.union(.punctuationCharacters)).lowercased()
            if value == "bengali" || value == "bangla" || value == "বাংলা" { matches.insert("bn"); continue }
            for code in Locale.LanguageCode.isoLanguageCodes.map(\.identifier) {
                if value == code || Locale(identifier: "en").localizedString(forLanguageCode: code)?.lowercased() == value || Locale(identifier: code).localizedString(forLanguageCode: code)?.lowercased() == value { matches.insert(code) }
            }
        }
        return matches.count == 1 ? matches.first : nil
    }
    public var sequence = 0
    public var permissionPersistent = false
    public var revision = UUID()
    public var active = false
    public var activationID: UUID?
    public var connected = false
    public var folderName = ""
    public var documents: [Document] = []
    public var skipped = 0
    public var truncated = false
    public var error: String?
    public var receipts: [String] = []
    public var explicitlyOff = false
    public static let empty = LocalContextSnapshot()
    public init() {}

    /// Transition only on an explicit activation, never on a new form/voice session.
    public mutating func activate(load: (inout Self) throws -> Void) throws {
        guard !active else { return }
        active = true; explicitlyOff = false; activationID = UUID(); revision = UUID()
        if connected { try load(&self) }
    }
    public mutating func turnOff() {
        active = false; explicitlyOff = true; activationID = nil; revision = UUID()
        documents = []; error = nil; skipped = 0; truncated = false
    }
    public mutating func disconnect() {
        connected = false; permissionPersistent = false; folderName = ""; documents = []; revision = UUID()
        error = nil; skipped = 0; truncated = false
    }
    public mutating func refresh(load: (inout Self) throws -> Void) throws {
        guard active && connected else { return }
        var replacement = self
        try load(&replacement)
        replacement.revision = UUID()
        self = replacement
    }
    public func voiceSafe(_ reply: HostReply) -> HostReply {
        guard active && connected && allowRemoteSpeech != true else { return reply }
        var safe = reply
        safe.question = nil
        safe.message = "The reply is shown in Safari. Local context stays on your Mac."
        return safe
    }

    /// Only matching fact snippets, never the whole document, are eligible for remote reasoning.
    public func relevantExcerpt(query: String) -> String {
        guard active && connected else { return "" }
        let terms = Set(query.lowercased().split { !$0.isLetter && !$0.isNumber }.filter { $0.count > 2 }.map(String.init))
        let pieces = documents.flatMap { $0.text.components(separatedBy: .newlines) }
            .flatMap { $0.components(separatedBy: ". ") }
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty && !$0.lowercased().contains("preferred language") && !$0.lowercased().contains("prefered language") }
        let ignored: Set<String> = ["the", "form", "context", "use", "and", "this"]
        let ranked = pieces.enumerated().map { item in (item.offset, item.element, terms.subtracting(ignored).filter { item.element.localizedCaseInsensitiveContains($0) }.count) }
        return ranked.filter { $0.2 > 0 }.sorted { $0.2 == $1.2 ? $0.0 < $1.0 : $0.2 > $1.2 }.prefix(6)
            .map { String($0.1.prefix(300)) }.joined(separator: "\n")
    }

    /// No rereading or semantic index: select bounded paragraphs from the in-session snapshot.
    public func excerpt(query: String) -> String {
        guard active else { return "" }
        let words = Set(query.lowercased().split { !$0.isLetter && !$0.isNumber }.filter { $0.count > 2 }.map(String.init))
        let paragraphs = documents.flatMap { $0.text.components(separatedBy: "\n\n") }
        let ranked = paragraphs.enumerated().sorted { a, b in
            let left = words.filter { a.element.localizedCaseInsensitiveContains($0) }.count
            let right = words.filter { b.element.localizedCaseInsensitiveContains($0) }.count
            return left == right ? a.offset < b.offset : left > right
        }
        var result = ""
        for item in ranked where result.count < 6000 {
            result += String(item.element.prefix(6000 - result.count)) + "\n"
        }
        return String(result.prefix(6000))
    }
}

public struct LocalContextStore: Sendable {
    public let directory: URL
    public init(directory: URL) { self.directory = directory }
    /// Each sandbox owns its cache. Snapshots cross the existing Safari native bridge;
    /// no shared filesystem access, App Group or provisioning profile is needed.
    public static func local() throws -> Self {
        guard let url = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            throw CocoaError(.fileReadNoPermission)
        }
        return Self(directory: url.appendingPathComponent("SeeForMe/LocalContext", isDirectory: true))
    }
    private var file: URL { directory.appendingPathComponent("session.json") }
    public func read() throws -> LocalContextSnapshot {
        guard FileManager.default.fileExists(atPath: file.path) else { return .empty }
        return try JSONDecoder().decode(LocalContextSnapshot.self, from: Data(contentsOf: file))
    }
    public func write(_ snapshot: LocalContextSnapshot) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true,
                                               attributes: [.posixPermissions: 0o700])
        var url = directory
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        try url.setResourceValues(values)
        try JSONEncoder().encode(snapshot).write(to: file, options: [.atomic])
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
    }
}

public enum LocalContextExtractor {
    public static let maxFiles = 50
    public static let maxFileBytes = 10 * 1024 * 1024
    public static let maxCharacters = 200_000

    /// Immediate children only; skip symlinks, packages and cloud placeholders. Never download.
    public static func load(folder: URL, into snapshot: inout LocalContextSnapshot) throws {
        let keys: Set<URLResourceKey> = [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey,
                                        .isUbiquitousItemKey, .ubiquitousItemDownloadingStatusKey]
        let urls = try FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: Array(keys),
                                                               options: [.skipsHiddenFiles, .skipsPackageDescendants])
            .filter { ["pdf", "txt", "md", "markdown", "docx"].contains($0.pathExtension.lowercased()) }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
        snapshot.documents = []; snapshot.skipped = 0; snapshot.truncated = urls.count > maxFiles; snapshot.error = nil
        var remaining = maxCharacters, remainingBytes = maxCharacters * 4
        for url in urls.prefix(maxFiles) {
            guard remaining > 0 && remainingBytes > 0 else { snapshot.truncated = true; break }
            do {
                let metadata = try url.resourceValues(forKeys: keys)
                guard metadata.isRegularFile == true, metadata.isSymbolicLink != true,
                      let size = metadata.fileSize, size <= maxFileBytes,
                      metadata.isUbiquitousItem != true || metadata.ubiquitousItemDownloadingStatus == .current else {
                    snapshot.skipped += 1; continue
                }
                let text: String
                switch url.pathExtension.lowercased() {
                case "pdf":
                    guard let pdf = PDFDocument(url: url), !pdf.isLocked else { snapshot.skipped += 1; continue }
                    var pages = ""
                    for index in 0..<min(pdf.pageCount, 500) where pages.count < remaining {
                        pages += String((pdf.page(at: index)?.string ?? "").prefix(remaining - pages.count)) + "\n\n"
                    }
                    if pdf.pageCount > 500 || pages.count >= remaining { snapshot.truncated = true }
                    text = pages
                case "docx":
                    text = try NSAttributedString(url: url, options: [.documentType: NSAttributedString.DocumentType.officeOpenXML],
                                                  documentAttributes: nil).string
                default:
                    text = try String(contentsOf: url, encoding: .utf8)
                }
                let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !clean.isEmpty else { snapshot.skipped += 1; continue }
                if clean.count > remaining { snapshot.truncated = true }
                var bounded = String(clean.prefix(remaining))
                if bounded.utf8.count > remainingBytes {
                    bounded = String(decoding: bounded.utf8.prefix(remainingBytes), as: UTF8.self)
                    snapshot.truncated = true
                }
                snapshot.documents.append(.init(text: bounded))
                remaining -= bounded.count; remainingBytes -= bounded.utf8.count
            } catch { snapshot.skipped += 1 }
        }
    }
}
