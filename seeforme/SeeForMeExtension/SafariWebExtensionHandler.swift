import AppKit
import Foundation
import SafariServices
import SeeForMeCore
import os.log

/// Receives `browser.runtime.sendNativeMessage` calls from the extension background script
/// and answers each with one HOST_REPLY (contract/PROTOCOL.md).
final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    /// One engine per extension process, so sessions survive between requests while the process lives.
    private static let engine = FormEngine(conversation: SeeForMeConversationReasoner(), contextProvider: { LocalContextBridge.snapshot() })
    private static let log = Logger(subsystem: "com.seeforme.app.extension", category: "native-messaging")

    func beginRequest(with context: NSExtensionContext) {
        let item = context.inputItems.first as? NSExtensionItem
        let message = item?.userInfo?[SFExtensionMessageKey] ?? NSNull()
        // Never log message contents: they can include page labels and user answers.
        let data = JSONSerialization.isValidJSONObject(message) ? try? JSONSerialization.data(withJSONObject: message) : nil

        struct Envelope: Decodable { var v: Int?; var type: String; var requestId: String?; var conversationLanguage: String?; var voiceId: String?; var utteranceId: String?; var operation: String? }
        let envelope = data.flatMap { try? JSONDecoder().decode(Envelope.self, from: $0) }
        let requestType = envelope?.type

        if requestType == "CONTEXT_CACHE_PART" {
            guard let data, data.count <= 48_000,
                  let part = try? JSONDecoder().decode(LocalContextTransfer.Part.self, from: data), part.valid else {
                let response = NSExtensionItem()
                response.userInfo = [SFExtensionMessageKey: ["v": 1, "type": "CONTEXT_CACHE_ACK", "requestId": envelope?.requestId ?? "", "accepted": false]]
                context.completeRequest(returningItems: [response], completionHandler: nil)
                return
            }
            Task {
                let reply = await LocalContextBridge.receive(part)
                let response = NSExtensionItem(); response.userInfo = [SFExtensionMessageKey: reply]
                context.completeRequest(returningItems: [response], completionHandler: nil)
            }
            return
        }

        if requestType == "LOCAL_CONTEXT" {
            guard envelope?.v == 1, let id = envelope?.requestId, UUID(uuidString: id) != nil,
                  let operation = envelope?.operation, LocalContextBridge.operations.contains(operation) else {
                let response = NSExtensionItem()
                response.userInfo = [SFExtensionMessageKey: ["v": 1, "type": "CONTEXT_STATE", "requestId": envelope?.requestId ?? "", "ok": false]]
                context.completeRequest(returningItems: [response], completionHandler: nil)
                return
            }
            Task {
                let reply = await LocalContextBridge.request(operation: operation, requestId: id)
                let response = NSExtensionItem(); response.userInfo = [SFExtensionMessageKey: reply]
                context.completeRequest(returningItems: [response], completionHandler: nil)
            }
            return
        }

        if requestType == "VOICE_OPTIONS", envelope?.v == 1 {
            let response = NSExtensionItem()
            response.userInfo = [SFExtensionMessageKey: [
                "v": 1, "type": "VOICE_OPTIONS", "requestId": envelope?.requestId ?? "",
                "systemLanguage": ConversationLanguage.system,
                "languages": ConversationLanguage.supported.map { ["id": $0, "name": ConversationLanguage.name($0)] },
                "voices": VoicePreferences.voices
            ]]
            context.completeRequest(returningItems: [response], completionHandler: nil)
            return
        }
        if let command = requestType.flatMap(VoiceCommand.init(rawValue:)) {
            let local = LocalContextBridge.snapshot()
            let valid = !(command == .start && local.explicitlyOff) && envelope?.v == 1 && UUID(uuidString: envelope?.requestId ?? "") != nil
                && (envelope?.conversationLanguage.map(ConversationLanguage.supported) ?? true)
                && (envelope?.voiceId.map(VoicePreferences.validVoice) ?? true)
            guard valid else {
                let response = NSExtensionItem()
                response.userInfo = [SFExtensionMessageKey: ["v": 1, "type": "VOICE_ACK",
                    "requestId": envelope?.requestId ?? "", "accepted": false, "appLaunched": false,
                    "error": envelope?.conversationLanguage.map({ !ConversationLanguage.supported($0) }) == true ? "UNSUPPORTED_LANGUAGE" : "VOICE_UNAVAILABLE"]]
                context.completeRequest(returningItems: [response], completionHandler: nil)
                return
            }
            Self.relay(command, language: envelope?.conversationLanguage, voiceId: envelope?.voiceId) { accepted, launched in
                let response = NSExtensionItem()
                response.userInfo = [SFExtensionMessageKey: ["v": protocolVersion, "type": "VOICE_ACK", "requestId": envelope?.requestId ?? "",
                                                            "accepted": accepted, "appLaunched": launched]]
                context.completeRequest(returningItems: [response], completionHandler: nil)
            }
            return
        }

        let started = ContinuousClock.now
        Task {
            let before = LocalContextBridge.snapshot()
            let reply = await Self.engine.handle(data: data ?? Data())
            Diagnostics.record("ext.request", ["type": requestType ?? "-", "status": reply.status.rawValue, "actions": "\(reply.actions.count)",
                                               "hasQuestion": "\(reply.question != nil)", "error": reply.errorCode?.rawValue ?? "-",
                                               "ms": Diagnostics.ms(since: started)])
            Self.log.info("reply status=\(reply.status.rawValue, privacy: .public) actions=\(reply.actions.count) error=\(reply.errorCode?.rawValue ?? "-", privacy: .public)")
            // When local context is connected, never broadcast potentially derived text to
            // the cloud voice pipeline (nor other local notification observers).
            let local = LocalContextBridge.snapshot()
            if (before.active && before.connected) || (local.active && local.connected) {
                var policy = before.active && before.connected ? before : local
                policy.allowRemoteSpeech = before.allowRemoteSpeech == true && local.allowRemoteSpeech == true
                let safe = policy.voiceSafe(reply)
                HostReplyBroadcast.post(safe, requestType: requestType, utteranceId: envelope?.utteranceId)
            } else {
                HostReplyBroadcast.post(reply, requestType: requestType, utteranceId: envelope?.utteranceId)
            }

            let response = NSExtensionItem()
            response.userInfo = [SFExtensionMessageKey: reply.jsonObject()]
            context.completeRequest(returningItems: [response], completionHandler: nil)
        }
    }

    /// Voice runs in the SeeForMe app. Forward the command there, launching the app (with voice on) if needed.
    private static func relay(_ command: VoiceCommand, language: String?, voiceId: String?, completion: @escaping @Sendable (Bool, Bool) -> Void) {
        let running = !NSRunningApplication.runningApplications(withBundleIdentifier: "com.seeforme.app").isEmpty
        Diagnostics.record("ext.voiceCommand", ["command": command.rawValue, "appRunning": "\(running)"])
        if running {
            command.post(language: language, voiceId: voiceId)
            return completion(true, false)
        }
        // Stop/mute with no host running: nothing to control.
        guard command == .start else { return completion(command == .stop, false) }
        // appex → PlugIns → Contents → SeeForMe.app
        let app = Bundle.main.bundleURL.deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.arguments = ["--start-voice"]
        if let language { configuration.arguments += ["--conversation-language", language] }
        if let voiceId { configuration.arguments += ["--voice-id", voiceId] }
        NSWorkspace.shared.openApplication(at: app, configuration: configuration) { _, error in
            Diagnostics.record("ext.launchApp", ["ok": "\(error == nil)", "error": error.map { "\(($0 as NSError).domain)#\(($0 as NSError).code)" } ?? "-"])
            completion(error == nil, error == nil)
        }
    }
}
