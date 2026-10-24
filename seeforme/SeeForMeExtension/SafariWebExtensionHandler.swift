import Foundation
import SafariServices
import SeeForMeCore
import os.log

/// Receives `browser.runtime.sendNativeMessage` calls from the extension background script
/// and answers each with one HOST_REPLY (contract/PROTOCOL.md).
final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    /// One engine per extension process, so sessions survive between requests while the process lives.
    private static let engine = FormEngine()
    private static let log = Logger(subsystem: "com.seeforme.app.extension", category: "native-messaging")

    func beginRequest(with context: NSExtensionContext) {
        let item = context.inputItems.first as? NSExtensionItem
        let message = item?.userInfo?[SFExtensionMessageKey] ?? NSNull()
        // Never log message contents: they can include page labels and user answers.
        let data = JSONSerialization.isValidJSONObject(message) ? try? JSONSerialization.data(withJSONObject: message) : nil

        Task {
            let reply = await Self.engine.handle(data: data ?? Data())
            Self.log.info("reply status=\(reply.status.rawValue, privacy: .public) actions=\(reply.actions.count) error=\(reply.errorCode?.rawValue ?? "-", privacy: .public)")
            HostReplyBroadcast.post(reply)

            let response = NSExtensionItem()
            response.userInfo = [SFExtensionMessageKey: reply.jsonObject()]
            context.completeRequest(returningItems: [response], completionHandler: nil)
        }
    }
}
