import Foundation
import Testing
@testable import SeeForMeCore

@Suite struct LocalContextTransferTests {
    func fixture() throws -> (URL, LocalContextStore) {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("seeforme-transfer-test-" + UUID().uuidString)
        return (folder, LocalContextStore(directory: folder))
    }
    func snapshot(sequence: Int = 1, requestId: String, text: String = "Synthetic local context") -> LocalContextSnapshot {
        var value = LocalContextSnapshot()
        try? value.activate { _ in }
        value.connected = true; value.documents = [.init(text: text)]
        value.sequence = sequence; value.receipts = [requestId]
        return value
    }
    @Test func reorderedAndDuplicatedPartsCommitOnlyCompleteSnapshot() async throws {
        let (folder, store) = try fixture()
        defer { try? FileManager.default.removeItem(at: folder) }
        let id = UUID().uuidString
        let value = snapshot(requestId: id, text: String(repeating: "Synthetic context paragraph. ", count: 3000))
        let parts = try LocalContextTransfer.parts(value, requestId: id)
        #expect(parts.count > 1)
        #expect(parts.allSatisfy { $0.valid && $0.chunk.utf8.count <= 21848 })
        let inbox = LocalContextInbox(store: store)
        #expect(try await inbox.receive(parts.last!) == false)
        #expect(try await inbox.receive(parts.last!) == false)
        #expect(try store.read().documents.isEmpty)
        for part in parts.dropLast().reversed() { _ = try await inbox.receive(part) }
        #expect(try store.read().documents.first?.text == value.documents.first?.text)
        #expect(try store.read().activationID == value.activationID)
        let resumed = try LocalContextStore(directory: folder).read()
        #expect(resumed.active && resumed.sequence == 1)
    }
    @Test func delayedPreOffDataCannotRestoreClearedContext() async throws {
        let (folder, store) = try fixture()
        defer { try? FileManager.default.removeItem(at: folder) }
        let firstID = UUID().uuidString, offID = UUID().uuidString
        let before = snapshot(requestId: firstID, text: String(repeating: "Private synthetic fact. ", count: 2000))
        let oldParts = try LocalContextTransfer.parts(before, requestId: firstID)
        let inbox = LocalContextInbox(store: store)
        _ = try await inbox.receive(oldParts[0])
        var off = before; off.turnOff(); off.sequence = 2; off.receipts.append(offID)
        for part in try LocalContextTransfer.parts(off, requestId: offID) { _ = try await inbox.receive(part) }
        for part in oldParts { _ = try await inbox.receive(part) }
        #expect(try store.read().sequence == 2)
        #expect(try store.read().documents.isEmpty)
        #expect(try store.read().explicitlyOff)
    }
    @Test func freshReceiverCanResumeFromPrivateCacheWithoutHostFileAccess() async throws {
        let (folder, store) = try fixture()
        defer { try? FileManager.default.removeItem(at: folder) }
        let id = UUID().uuidString, value = snapshot(requestId: id)
        let parts = try LocalContextTransfer.parts(value, requestId: id)
        let first = LocalContextInbox(store: store)
        for part in parts { _ = try await first.receive(part) }
        let resumed = LocalContextInbox(store: LocalContextStore(directory: folder))
        #expect(try await resumed.receive(parts[0]))
        #expect(try store.read().documents.first?.text == "Synthetic local context")
    }
    @Test func malformedAndOversizedPartsNeverReplaceCache() async throws {
        let (folder, store) = try fixture()
        defer { try? FileManager.default.removeItem(at: folder) }
        let id = UUID().uuidString
        let value = snapshot(requestId: id)
        try store.write(value)
        let inbox = LocalContextInbox(store: store)
        var part = try LocalContextTransfer.parts(snapshot(sequence: 2, requestId: id), requestId: id)[0]
        part.total = 129
        await #expect(throws: (any Error).self) { try await inbox.receive(part) }
        part.total = 1; part.chunk = "not base64"
        await #expect(throws: (any Error).self) { try await inbox.receive(part) }
        part.chunk = String(repeating: "A", count: 22000)
        await #expect(throws: (any Error).self) { try await inbox.receive(part) }
        #expect(try store.read().sequence == 1)
    }
    @Test func invalidSnapshotsAndMissingReceiptsAreRejected() async throws {
        let (folder, store) = try fixture()
        defer { try? FileManager.default.removeItem(at: folder) }
        let id = UUID().uuidString, inbox = LocalContextInbox(store: store)
        var invalid = snapshot(requestId: id)
        invalid.receipts = []
        let parts = try LocalContextTransfer.parts(invalid, requestId: id)
        await #expect(throws: (any Error).self) { try await inbox.receive(parts[0]) }
        invalid.receipts = [id]; invalid.active = false
        #expect(!LocalContextTransfer.valid(invalid))
        #expect(try store.read().documents.isEmpty)
    }
}
