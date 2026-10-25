import AppKit
import Foundation
import SeeForMeCore

/// Only content-free commands use distributed notifications. Cache parts return through
/// Safari's existing native push/message bridge into this process's private sandbox.
enum LocalContextBridge {
    private static let inbox = (try? LocalContextStore.local()).map { LocalContextInbox(store: $0) }
    static let operations = ["status", "activate", "off", "connect", "refresh", "change", "disconnect", "allow-speech", "private-speech", "poll", "cached-status"]
    static func snapshot() -> LocalContextSnapshot { (try? LocalContextStore.local().read()) ?? .empty }
    static func status(_ state: LocalContextSnapshot) -> [String: Any] {
        ["allowRemoteSpeech": state.allowRemoteSpeech == true, "active": state.active, "explicitlyOff": state.explicitlyOff, "connected": state.connected,
         "folderName": state.folderName, "documentCount": state.documents.count,
         "permissionPersistent": state.permissionPersistent, "skipped": state.skipped, "truncated": state.truncated, "error": state.error ?? ""]
    }
    static func receive(_ part: LocalContextTransfer.Part) async -> [String: Any] {
        var reply: [String: Any] = ["v": 1, "type": "CONTEXT_CACHE_ACK", "requestId": part.requestId, "accepted": false]
        do {
            guard let inbox else { return reply }
            reply["complete"] = try await inbox.receive(part)
            reply["accepted"] = true
            Diagnostics.record("context.receive", ["complete": "\(reply["complete"] as? Bool == true)"])
        } catch { /* No packet text, file paths or decoder errors enter diagnostics. */ }
        return reply
    }
    static func request(operation: String, requestId: String) async -> [String: Any] {
        var result: [String: Any] = ["v": 1, "type": "CONTEXT_STATE", "requestId": requestId, "ok": false]
        do {
            let store = try LocalContextStore.local()
            let state = try store.read()
            if operation == "cached-status" || state.receipts.contains(requestId) {
                result["ok"] = true; result["state"] = status(state)
                return result
            }
            if operation != "poll" {
                if NSRunningApplication.runningApplications(withBundleIdentifier: "com.seeforme.app").isEmpty {
                    let app = Bundle.main.bundleURL.deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
                    let config = NSWorkspace.OpenConfiguration(); config.activates = false
                    try await NSWorkspace.shared.openApplication(at: app, configuration: config)
                }
                let data = try JSONSerialization.data(withJSONObject: ["operation": operation, "requestId": requestId])
                DistributedNotificationCenter.default().postNotificationName(
                    Notification.Name("com.seeforme.app.localContext"), object: String(decoding: data, as: UTF8.self), userInfo: nil, deliverImmediately: true)
            }
            // Complete this native request before Safari relays cache parts back.
            // Holding it open can serialize the very delivery we are waiting for.
            result["pending"] = true
        } catch {
            result["error"] = "Local context storage is unavailable."
        }
        return result
    }
}
