import AppKit
import SafariServices
import Security
import SeeForMeCore

/// Safari remains the UI. Only the system directory picker comes to the foreground.
/// The host owns source-file access; each process keeps its own private text cache.
@MainActor final class LocalContextController {
    static let notification = Notification.Name("com.seeforme.app.localContext")
    private var observer: NSObjectProtocol?
    private var pending = Set<String>()
    private var picker: NSOpenPanel?
    private var tail: Task<Void, Never>?
    private var memory: LocalContextSnapshot?
    private var folderURL: URL?
    private var folderScoped = false
    private let bookmarkKey = "localContextFolderBookmark"

    init() {
        observer = DistributedNotificationCenter.default().addObserver(forName: Self.notification, object: nil, queue: .main) { [weak self] note in
            guard let json = note.object as? String, json.utf8.count < 512,
                  let command = try? JSONDecoder().decode(Command.self, from: Data(json.utf8)) else { return }
            MainActor.assumeIsolated { self?.enqueue(command) }
        }
    }
    /// An explicit Finder/Launch Services open grants the same user-selected folder access
    /// as the picker. Reuse the existing cache and native transfer, never copy originals.
    func connectOpenedFolder(_ folder: URL) {
        guard (try? folder.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true else { return }
        let previous = tail
        tail = Task {
            await previous?.value
            guard let store = try? LocalContextStore.local(), var snapshot = memory ?? (try? store.read()) else { return }
            let access = folder.startAccessingSecurityScopedResource()
            do {
                var replacement = snapshot
                replacement.connected = true; replacement.folderName = folder.lastPathComponent
                replacement.active = true; replacement.explicitlyOff = false
                replacement.activationID = replacement.activationID ?? UUID()
                replacement.revision = UUID()
                try LocalContextExtractor.load(folder: folder, into: &replacement)
                retainFolder(folder, scoped: access)
                UserDefaults.standard.set(folder.path, forKey: "localContextLastFolderPath")
                replacement.allowRemoteSpeech = UserDefaults.standard.bool(forKey: "contextSpeechConsent")
                replacement.sequence += 1
                let requestId = UUID().uuidString
                replacement.receipts = Array((replacement.receipts + [requestId]).suffix(32))
                try store.write(replacement)
                snapshot = replacement; memory = replacement
                publish(snapshot, requestId: requestId)
                Diagnostics.record("context.openFolder", ["ok": "true", "documents": String(snapshot.documents.count)])
            } catch {
                if access { folder.stopAccessingSecurityScopedResource() }
                Diagnostics.record("context.openFolder", ["ok": "false"])
            }
        }
    }
    nonisolated struct Command: Codable { var operation: String; var requestId: String }
    private func enqueue(_ command: Command) {
        guard UUID(uuidString: command.requestId) != nil,
              ["status", "activate", "off", "connect", "refresh", "change", "disconnect", "allow-speech", "private-speech"].contains(command.operation),
              !pending.contains(command.requestId) else { return }
        if ["off", "disconnect"].contains(command.operation) { picker?.cancel(nil) }
        pending.insert(command.requestId)
        let previous = tail
        tail = Task {
            await previous?.value
            await perform(command)
            pending.remove(command.requestId)
        }
    }
    private func perform(_ command: Command) async {
        guard let store = try? LocalContextStore.local(), var snapshot = memory ?? (try? store.read()) else { return }
        if snapshot.receipts.contains(command.requestId) {
            publish(snapshot, requestId: command.requestId) // Delivery retry; never a source-file reread.
            return
        }
        do {
            switch command.operation {
            case "allow-speech", "private-speech":
                UserDefaults.standard.set(command.operation == "allow-speech", forKey: "contextSpeechConsent")
                if command.operation == "private-speech" { AppModel.shared.voice.stop() }

            case "off":
                snapshot.turnOff()
                AppModel.shared.voice.stop()
            case "disconnect":
                AppModel.shared.voice.stop()
                UserDefaults.standard.removeObject(forKey: bookmarkKey)
                UserDefaults.standard.removeObject(forKey: "localContextLastFolderPath")
                retainFolder(nil, scoped: false)
                snapshot.disconnect()
            case "connect", "change":
                let panel = NSOpenPanel()
                picker = panel
                defer { picker = nil }
                panel.canChooseDirectories = true; panel.canChooseFiles = false; panel.allowsMultipleSelection = false
                panel.prompt = "Connect Folder"
                panel.message = "Read PDF, TXT, Markdown and DOCX locally. Originals stay in place. Only ask SeeForMe to fill websites you trust."
                panel.directoryURL = UserDefaults.standard.string(forKey: "localContextLastFolderPath").map { URL(fileURLWithPath: $0, isDirectory: true) } ?? FileManager.default.urls(for: .desktopDirectory, in: .userDomainMask).first?.appendingPathComponent("SeeForMe Context", isDirectory: true)
                let previousApp = NSWorkspace.shared.frontmostApplication
                NSApp.activate()
                defer { previousApp?.activate() }
                let response = await panel.begin()
                guard response == .OK, let folder = panel.url else { break }
                let access = folder.startAccessingSecurityScopedResource()
                var retained = false
                defer { if access && !retained { folder.stopAccessingSecurityScopedResource() } }
                let bookmark = supportsPersistentBookmarks ? try? folder.bookmarkData(
                    options: [.withSecurityScope, .securityScopeAllowOnlyReadAccess], includingResourceValuesForKeys: nil, relativeTo: nil) : nil
                // Build first; a failed folder change preserves the previous snapshot/access.
                var replacement = snapshot
                replacement.revision = UUID(); replacement.connected = true; replacement.folderName = folder.lastPathComponent
                replacement.permissionPersistent = bookmark != nil
                replacement.documents = []; replacement.skipped = 0; replacement.truncated = false; replacement.error = nil
                if replacement.active { try LocalContextExtractor.load(folder: folder, into: &replacement) }
                if let bookmark { UserDefaults.standard.set(bookmark, forKey: bookmarkKey) }
                else { UserDefaults.standard.removeObject(forKey: bookmarkKey) }
                retainFolder(folder, scoped: access); retained = true
                UserDefaults.standard.set(folder.path, forKey: "localContextLastFolderPath")
                snapshot = replacement
            case "activate":
                // New forms/calls and process restarts resume ON; only OFF → ON loads files.
                try snapshot.activate {
                    $0.error = "Context loading was interrupted. Use Refresh Context to retry."
                    try store.write($0) // Persist ON before touching originals, including crash recovery.
                    try loadRemembered(into: &$0)
                }
            case "refresh":
                try snapshot.refresh { try loadRemembered(into: &$0) }
            default: break // Status never opens source files.
            }
        } catch {
            snapshot.error = "Folder access is unavailable. Reconnect to read the originals; existing cached context is retained."
        }
        snapshot.allowRemoteSpeech = UserDefaults.standard.bool(forKey: "contextSpeechConsent")
        snapshot.receipts = Array((snapshot.receipts + [command.requestId]).suffix(32))
        snapshot.sequence += 1
        do { try store.write(snapshot) }
        catch { snapshot.error = "The local cache could not be saved. Keep SeeForMe running and try again." }
        memory = snapshot
        publish(snapshot, requestId: command.requestId)
    }
    private func retainFolder(_ folder: URL?, scoped: Bool) {
        if folderScoped { folderURL?.stopAccessingSecurityScopedResource() }
        folderURL = folder; folderScoped = scoped
    }
    private var supportsPersistentBookmarks: Bool {
        // Keep the project's existing signing/entitlements unchanged. Use persistence only
        // if a future signed host already carries the standard bookmark entitlement.
        var code: SecCode?
        var info: CFDictionary?
        var staticCode: SecStaticCode?
        guard SecCodeCopySelf([], &code) == errSecSuccess, let code,
              SecCodeCopyStaticCode(code, [], &staticCode) == errSecSuccess, let staticCode,
              SecCodeCopySigningInformation(staticCode, SecCSFlags(rawValue: kSecCSSigningInformation), &info) == errSecSuccess,
              let values = info as? [String: Any],
              let entitlements = values[kSecCodeInfoEntitlementsDict as String] as? [String: Any] else { return false }
        return entitlements["com.apple.security.files.bookmarks.app-scope"] as? Bool == true
    }
    private func loadRemembered(into snapshot: inout LocalContextSnapshot) throws {
        if let folderURL {
            try LocalContextExtractor.load(folder: folderURL, into: &snapshot)
            return
        }
        guard supportsPersistentBookmarks, let bookmark = UserDefaults.standard.data(forKey: bookmarkKey) else {
            throw CocoaError(.fileReadNoPermission)
        }
        var stale = false
        let folder = try URL(resolvingBookmarkData: bookmark, options: [.withSecurityScope, .withoutUI], relativeTo: nil,
                             bookmarkDataIsStale: &stale)
        guard folder.startAccessingSecurityScopedResource() else { throw CocoaError(.fileReadNoPermission) }
        retainFolder(folder, scoped: true)
        if stale {
            let renewed = try folder.bookmarkData(options: [.withSecurityScope, .securityScopeAllowOnlyReadAccess],
                                                  includingResourceValuesForKeys: nil, relativeTo: nil)
            UserDefaults.standard.set(renewed, forKey: bookmarkKey)
        }
        try LocalContextExtractor.load(folder: folder, into: &snapshot)
    }
    private func publish(_ snapshot: LocalContextSnapshot, requestId: String) {
        guard let parts = try? LocalContextTransfer.parts(snapshot, requestId: requestId) else { return }
        for part in parts {
            guard let payload = try? part.jsonObject() else { return }
            SFSafariApplication.dispatchMessage(withName: "seeforme", toExtensionWithIdentifier: AppModel.extensionIdentifier,
                                                userInfo: payload) { error in
                Diagnostics.record("context.dispatch", ["ok": "\(error == nil)", "error": error.map { "\(($0 as NSError).domain)#\(($0 as NSError).code)" } ?? "-"])
            }
        }
    }
}
