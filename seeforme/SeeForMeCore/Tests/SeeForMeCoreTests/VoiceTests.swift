import Foundation
import Testing
@testable import SeeForMeCore

func summary(_ type: String, _ status: ReplyStatus = .needsInput, question: String? = nil, message: String? = nil, filled: Int = 0) -> HostReplyBroadcast.Summary {
    HostReplyBroadcast.Summary(requestType: type, status: status, question: question, message: message, modelAvailable: true, filledCount: filled)
}

@Test func voiceTurnSpeaksOnlyAtTheEndOfATurn() {
    let ask = "What's your first and last name?"
    // Inspect form: first question is spoken.
    #expect(VoiceTurn.speech(for: summary("FORM_SNAPSHOT", question: ask), awaitingReply: false, lastQuestion: nil)?.text == ask)
    // Refresh during a voice turn, or repeating the same question: silent.
    #expect(VoiceTurn.speech(for: summary("FORM_SNAPSHOT", question: ask), awaitingReply: true, lastQuestion: nil) == nil)
    #expect(VoiceTurn.speech(for: summary("FORM_SNAPSHOT", question: ask), awaitingReply: false, lastQuestion: ask) == nil)
    // Utterance that filled fields: wait for FILL_RESULT.
    #expect(VoiceTurn.speech(for: summary("USER_UTTERANCE", question: "Email?", message: "Filled First name.", filled: 1), awaitingReply: true, lastQuestion: ask) == nil)
    let next = VoiceTurn.speech(for: summary("FILL_RESULT", question: "What's your email?", message: "Filled First name."), awaitingReply: true, lastQuestion: ask)
    #expect(next?.text == "Filled First name. What's your email?")
    // Utterance that filled nothing is final.
    #expect(VoiceTurn.speech(for: summary("USER_UTTERANCE", question: ask, message: "I didn't find a value."), awaitingReply: true, lastQuestion: ask) != nil)
    #expect(VoiceTurn.speech(for: summary("SESSION_RESET", .ended), awaitingReply: false, lastQuestion: ask) == nil)
    // Confirmed submission: silent until the result arrives.
    #expect(VoiceTurn.speech(for: summary("USER_UTTERANCE", .submit, message: "Submitting the form now."), awaitingReply: true, lastQuestion: ask) == nil)
    #expect(VoiceTurn.speech(for: summary("SUBMIT_RESULT", .ended, message: "I submitted the form."), awaitingReply: true, lastQuestion: ask)?.text == "I submitted the form.")
}

@Test func segmenterEmitsOnlySpeech() {
    var segmenter = UtteranceSegmenter()
    let chunk = 1600 // 0.1 s
    let silence = [Int16](repeating: 0, count: chunk)
    let loud = (0..<chunk).map { Int16(8000 * sin(Double($0) / 5)) }
    for _ in 0..<10 { #expect(segmenter.append(silence) == nil) }
    for _ in 0..<10 { #expect(segmenter.append(loud) == nil) }
    var result: Data?
    for _ in 0..<10 where result == nil { result = segmenter.append(silence) }
    let seconds = Double(result?.count ?? 0) / 2 / UtteranceSegmenter.sampleRate
    #expect(seconds > 1.0 && seconds < 2.5)
    // A click shorter than the minimum speech length is dropped.
    _ = segmenter.append(loud)
    var click: Data?
    for _ in 0..<10 { click = click ?? segmenter.append(silence) }
    #expect(click == nil)
}

@Test func elevenLabsRequestsCarryKeyOnlyInHeader() throws {
    let client = ElevenLabsClient(apiKey: "test-key")
    let stt = client.transcriptionRequest(pcm: Data([1, 2, 3, 4]))
    #expect(stt.url?.absoluteString == "https://api.elevenlabs.io/v1/speech-to-text")
    #expect(stt.value(forHTTPHeaderField: "xi-api-key") == "test-key")
    let body = String(decoding: stt.httpBody ?? Data(), as: UTF8.self)
    #expect(body.contains("scribe_v2") && body.contains("pcm_s16le_16") && !body.contains("test-key"))

    let tts = client.speechRequest("Hello")
    #expect(tts.url?.absoluteString == "https://api.elevenlabs.io/v1/text-to-speech/\(ElevenLabsClient.defaultVoiceId)?output_format=mp3_44100_64")
    let json = try #require(JSONSerialization.jsonObject(with: tts.httpBody ?? Data()) as? [String: String])
    #expect(json == ["text": "Hello", "model_id": "eleven_flash_v2_5"])
}

@Test func streamingSpeechUsesNativePCMEndpoint() throws {
    let request = ElevenLabsClient(apiKey: "synthetic-key").speechRequest("Synthetic response", outputFormat: "pcm_24000", streaming: true)
    #expect(request.url?.path.hasSuffix("/stream") == true)
    #expect(request.url?.query == "output_format=pcm_24000")
    #expect(request.value(forHTTPHeaderField: "xi-api-key") == "synthetic-key")
    #expect(!String(decoding: request.httpBody ?? Data(), as: UTF8.self).contains("synthetic-key"))
}

@Test func interruptionDetectionKeepsTheBeginningOfSpeech() throws {
    var segmenter = UtteranceSegmenter()
    let chunk = [Int16](repeating: 6000, count: 1600)
    _ = segmenter.append(chunk)
    #expect(!segmenter.confirmedSpeech) // A single 100 ms sound is insufficient.
    _ = segmenter.append(chunk)
    #expect(segmenter.confirmedSpeech)
    _ = segmenter.append(chunk)
    _ = segmenter.append(chunk)
    var result: Data?
    for _ in 0..<10 where result == nil { result = segmenter.append([Int16](repeating: 0, count: 1600)) }
    let audio = try #require(result)
    #expect(audio.prefix(2) == Data([0x70, 0x17])) // The first spoken sample survives detection.
    #expect(!segmenter.confirmedSpeech)
}

@Test func autoEndOnlyAfterCompletedTask() {
    #expect(VoiceTurn.endsTask(summary("USER_UTTERANCE", .ended, question: "Here is the explanation.")))
    #expect(VoiceTurn.endsTask(summary("FILL_RESULT", .readyForReview)))
    #expect(VoiceTurn.endsTask(summary("SUBMIT_RESULT", .ended)))
    #expect(!VoiceTurn.endsTask(summary("FILL_RESULT", .readyForReview, question: "Submit now?")))
    #expect(!VoiceTurn.endsTask(summary("USER_UTTERANCE", .needsInput, question: "Your email?")))
    #expect(!VoiceTurn.endsTask(summary("USER_UTTERANCE", .needsInput, filled: 1)))
    #expect(!VoiceTurn.endsTask(summary("USER_UTTERANCE", .error)))
}
