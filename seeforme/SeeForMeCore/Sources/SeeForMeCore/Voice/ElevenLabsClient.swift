import Foundation

/// Minimal ElevenLabs REST client: batch speech-to-text (Scribe v2) and text-to-speech (Flash v2.5).
/// Cloud processing: audio sent here and text spoken here leave the Mac. Never log either.
public struct ElevenLabsClient: Sendable {
    public static let defaultVoiceId = "JBFqnCBsd6RMkjVDRZzb"
    static let base = URL(string: "https://api.elevenlabs.io")!

    public enum Failure: LocalizedError, Equatable {
        case invalidKey, quotaOrRateLimit, http(Int), badResponse

        public var errorDescription: String? {
            switch self {
            case .invalidKey: "ElevenLabs rejected the API key."
            case .quotaOrRateLimit: "ElevenLabs quota or rate limit reached."
            case .http(let code): "ElevenLabs request failed (HTTP \(code))."
            case .badResponse: "Unexpected response from ElevenLabs."
            }
        }
    }

    let apiKey: String
    let voiceId: String
    let session: URLSession

    public init(apiKey: String, voiceId: String = defaultVoiceId, session: URLSession = .shared) {
        self.apiKey = apiKey
        self.voiceId = voiceId.isEmpty ? Self.defaultVoiceId : voiceId
        self.session = session
    }

    // MARK: Speech to text

    /// `pcm` is 16 kHz mono signed 16-bit little-endian audio.
    public struct Transcript: Decodable, Sendable {
        public var text: String
        public var language_code: String?
        public var language_probability: Double?
    }
    public func transcribe(pcm: Data) async throws -> String {
        try await transcribeDetected(pcm: pcm).text
    }
    public func transcribeDetected(pcm: Data) async throws -> Transcript {
        let (data, response) = try await session.data(for: transcriptionRequest(pcm: pcm))
        try Self.check(response)

        guard var transcript = try? JSONDecoder().decode(Transcript.self, from: data) else { throw Failure.badResponse }
        transcript.text = transcript.text.trimmingCharacters(in: .whitespacesAndNewlines)
        return transcript
    }

    func transcriptionRequest(pcm: Data) -> URLRequest {
        let boundary = "seeforme-\(UUID().uuidString)"
        var request = URLRequest(url: Self.base.appending(path: "v1/speech-to-text"), timeoutInterval: 30)
        request.httpMethod = "POST"
        request.setValue(apiKey, forHTTPHeaderField: "xi-api-key")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        func field(_ name: String, _ value: String) {
            body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"\r\n\r\n\(value)\r\n".utf8))
        }
        field("model_id", "scribe_v2")
        field("file_format", "pcm_s16le_16")
        // Omit language_code so Scribe detects the spoken language.
        field("tag_audio_events", "false")
        body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"file\"; filename=\"speech.pcm\"\r\nContent-Type: application/octet-stream\r\n\r\n".utf8))
        body.append(pcm)
        body.append(Data("\r\n--\(boundary)--\r\n".utf8))
        request.httpBody = body
        return request
    }

    // MARK: Text to speech

    /// Returns audio for `text`: MP3 by default, or e.g. `pcm_16000` for raw 16 kHz PCM.
    public func speak(_ text: String, outputFormat: String = "mp3_44100_64") async throws -> Data {
        let (data, response) = try await session.data(for: speechRequest(text, outputFormat: outputFormat))
        try Self.check(response)
        guard !data.isEmpty else { throw Failure.badResponse }
        return data
    }

    public func speechStream(_ text: String) -> AsyncThrowingStream<Data, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    let request = speechRequest(text, outputFormat: "pcm_24000", streaming: true)
                    let (bytes, response) = try await session.bytes(for: request)
                    try Self.check(response)
                    var chunk = Data(), total = 0
                    for try await byte in bytes {
                        try Task.checkCancellation()
                        chunk.append(byte); total += 1
                        guard total <= 10_000_000 else { throw Failure.badResponse }
                        if chunk.count == 4800 { continuation.yield(chunk); chunk.removeAll(keepingCapacity: true) }
                    }
                    guard total > 0, total % 2 == 0 else { throw Failure.badResponse }
                    if !chunk.isEmpty { continuation.yield(chunk) }
                    continuation.finish()
                } catch { continuation.finish(throwing: error) }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    func speechRequest(_ text: String, outputFormat: String = "mp3_44100_64", streaming: Bool = false) -> URLRequest {
        var components = URLComponents(url: Self.base.appending(path: "v1/text-to-speech/\(voiceId)"), resolvingAgainstBaseURL: false)!
        if streaming { components.path += "/stream" }
        components.queryItems = [URLQueryItem(name: "output_format", value: outputFormat)]
        var request = URLRequest(url: components.url!, timeoutInterval: 30)
        request.httpMethod = "POST"
        request.setValue(apiKey, forHTTPHeaderField: "xi-api-key")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["text": text, "model_id": "eleven_flash_v2_5"])
        return request
    }

    // MARK: Usage

    /// Account usage counters from `GET /v1/user/subscription` (a free call), for cost tracking.
    public func subscriptionUsage() async throws -> [String: Int] {
        var request = URLRequest(url: Self.base.appending(path: "v1/user/subscription"), timeoutInterval: 15)
        request.setValue(apiKey, forHTTPHeaderField: "xi-api-key")
        let (data, response) = try await session.data(for: request)
        try Self.check(response)
        let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
        return object.compactMapValues { $0 as? Int }
    }

    static func check(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { throw Failure.badResponse }
        switch http.statusCode {
        case 200..<300: return
        case 401, 403: throw Failure.invalidKey
        case 429: throw Failure.quotaOrRateLimit
        default: throw Failure.http(http.statusCode)
        }
    }
}
