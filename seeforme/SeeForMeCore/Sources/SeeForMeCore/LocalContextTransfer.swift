import Foundation

/// Bounded local transport over the existing Safari native push/native message path.
/// No document text goes through distributed notifications or into a page/content script.
public enum LocalContextTransfer {
    public static let chunkBytes = 16 * 1024
    public static let maxParts = 128
    public static let maxBytes = chunkBytes * maxParts

    public struct Part: Codable, Sendable {
        public var v = 1
        public var type = "CONTEXT_CACHE_PART"
        public var requestId: String
        public var sequence: Int
        public var index: Int
        public var total: Int
        public var chunk: String
        public var valid: Bool {
            v == 1 && type == "CONTEXT_CACHE_PART" && UUID(uuidString: requestId) != nil && sequence > 0 &&
            total > 0 && total <= maxParts && index >= 0 && index < total && chunk.utf8.count <= 21848
        }
        public func jsonObject() throws -> [String: Any] {
            guard let value = try JSONSerialization.jsonObject(with: JSONEncoder().encode(self)) as? [String: Any] else {
                throw CocoaError(.coderInvalidValue)
            }
            return value
        }
    }
    public static func parts(_ snapshot: LocalContextSnapshot, requestId: String) throws -> [Part] {
        let data = try JSONEncoder().encode(snapshot)
        guard data.count <= maxBytes, UUID(uuidString: requestId) != nil, snapshot.sequence > 0 else {
            throw CocoaError(.coderInvalidValue)
        }
        let total = (data.count + chunkBytes - 1) / chunkBytes
        return stride(from: 0, to: data.count, by: chunkBytes).enumerated().map { index, offset in
            Part(requestId: requestId, sequence: snapshot.sequence, index: index, total: total,
                 chunk: data.subdata(in: offset..<min(offset + chunkBytes, data.count)).base64EncodedString())
        }
    }
    public static func valid(_ snapshot: LocalContextSnapshot) -> Bool {
        snapshot.sequence > 0 && snapshot.documents.count <= LocalContextExtractor.maxFiles &&
        snapshot.documents.reduce(0, { $0 + $1.text.count }) <= LocalContextExtractor.maxCharacters &&
        snapshot.folderName.count <= 255 && (snapshot.error?.count ?? 0) <= 512 &&
        snapshot.receipts.count <= 32 && snapshot.receipts.allSatisfy { UUID(uuidString: $0) != nil } &&
        (!snapshot.active || snapshot.activationID != nil) &&
        (snapshot.active && snapshot.connected || snapshot.documents.isEmpty)
    }
}

/// Only complete, validated snapshots replace the native extension's private cache.
/// Sequence ordering prevents delayed pre-OFF data from restoring disconnected context.
public actor LocalContextInbox {
    private struct Pending {
        var sequence: Int
        var total: Int
        var created: Date
        var chunks: [Int: Data] = [:]
    }
    private let store: LocalContextStore
    private var pending: [String: Pending] = [:]
    public init(store: LocalContextStore) { self.store = store }

    public func receive(_ part: LocalContextTransfer.Part) throws -> Bool {
        guard part.valid, let chunk = Data(base64Encoded: part.chunk), chunk.count <= LocalContextTransfer.chunkBytes else {
            throw CocoaError(.coderInvalidValue)
        }
        let current = try store.read()
        if part.sequence <= current.sequence { return true }
        let now = Date()
        pending = pending.filter { now.timeIntervalSince($0.value.created) < 30 }
        let key = part.requestId + ":" + String(part.sequence)
        if pending[key] == nil, pending.count >= 4 { pending.removeAll() }
        var transfer = pending[key] ?? Pending(sequence: part.sequence, total: part.total, created: now)
        guard transfer.total == part.total, transfer.chunks[part.index].map({ $0 == chunk }) ?? true else {
            pending[key] = nil
            throw CocoaError(.coderInvalidValue)
        }
        transfer.chunks[part.index] = chunk
        pending[key] = transfer
        guard transfer.chunks.count == transfer.total else { return false }
        pending[key] = nil
        var data = Data()
        for index in 0..<transfer.total {
            guard let value = transfer.chunks[index] else { throw CocoaError(.coderInvalidValue) }
            data.append(value)
        }
        guard data.count <= LocalContextTransfer.maxBytes else { throw CocoaError(.coderInvalidValue) }
        let snapshot = try JSONDecoder().decode(LocalContextSnapshot.self, from: data)
        guard LocalContextTransfer.valid(snapshot), snapshot.sequence == part.sequence,
              snapshot.receipts.contains(part.requestId) else { throw CocoaError(.coderInvalidValue) }
        try store.write(snapshot)
        pending = pending.filter { $0.value.sequence > snapshot.sequence }
        return true
    }
}
