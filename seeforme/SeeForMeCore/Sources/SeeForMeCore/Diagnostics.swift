import Foundation
import os

/// Privacy-safe diagnostics: event names, status codes, counts and timings only.
/// Never pass transcripts, spoken text, labels, field values, or credentials.
/// Written to the system log (persisted, `notice` level) and to
/// `Library/Application Support/seeforme-diagnostics.log` in the process's own sandbox container.
public enum Diagnostics {
    private static let logger = Logger(subsystem: "com.seeforme.app", category: "diagnostics")
    private static let lock = NSLock()
    private static let maxBytes = 256 * 1024

    private static let fileURL: URL? = {
        guard let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { return nil }
        try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        return support.appending(path: "seeforme-diagnostics.log")
    }()

    private static let timestamp = Date.ISO8601FormatStyle(includingFractionalSeconds: true, timeZone: .current)

    /// - Parameters:
    ///   - event: e.g. `voice.state`.
    ///   - fields: codes only, e.g. `["from": "listening", "to": "transcribing"]`.
    public static func record(_ event: String, _ fields: KeyValuePairs<String, String> = [:]) {
        let detail = fields.map { "\($0.key)=\($0.value)" }.joined(separator: " ")
        logger.notice("\(event, privacy: .public) \(detail, privacy: .public)")
        lock.withLock {
            guard let fileURL else { return }
            let line = "\(Date().formatted(timestamp)) \(ProcessInfo.processInfo.processName) \(event) \(detail)\n"
            if let size = try? FileManager.default.attributesOfItem(atPath: fileURL.path)[.size] as? Int, size > maxBytes {
                try? FileManager.default.removeItem(at: fileURL)
            }
            if let handle = try? FileHandle(forWritingTo: fileURL) {
                handle.seekToEndOfFile()
                handle.write(Data(line.utf8))
                try? handle.close()
            } else {
                try? Data(line.utf8).write(to: fileURL)
            }
        }
    }

    /// Milliseconds since `start`, as a string field.
    public static func ms(since start: ContinuousClock.Instant) -> String {
        let duration = start.duration(to: .now)
        return String(duration.components.seconds * 1000 + duration.components.attoseconds / 1_000_000_000_000_000)
    }
}
