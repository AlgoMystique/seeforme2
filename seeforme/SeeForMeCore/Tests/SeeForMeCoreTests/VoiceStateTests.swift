import Foundation
import Testing
@testable import SeeForMeCore

@Test func voiceStatePushMatchesContract() throws {
    var sequencer = VoiceStateSequencer()
    let listening = sequencer.push(.listening, speechDetected: true)
    let json = listening.jsonObject()
    #expect(json["v"] as? Int == 1)
    #expect(json["type"] as? String == "VOICE_STATE")
    #expect(json["state"] as? String == "listening")
    #expect(json["speechDetected"] as? Bool == true)
    #expect(json["seq"] as? Int == 1)
    #expect(json["ttlMs"] as? Int == 15_000)
    #expect(json["instanceId"] as? String == sequencer.instanceId)
    #expect(json["message"] == nil)
    #expect(json["muted"] as? Bool == false)
    #expect(Set(json.keys) == ["v", "type", "state", "speechDetected", "instanceId", "seq", "ttlMs", "muted"])
}

@Test func voiceStateSequencing() {
    var sequencer = VoiceStateSequencer()
    #expect(sequencer.current == .idle)
    _ = sequencer.push(.listening, speechDetected: false)
    let speaking = sequencer.push(.speaking, speechDetected: true)
    #expect(speaking.seq == 2)
    #expect(speaking.speechDetected == nil)       // only meaningful while listening
    let heartbeat = sequencer.repeatCurrent()
    #expect(heartbeat.state == .speaking && heartbeat.seq == 3)
    let error = sequencer.push(.error, message: "ElevenLabs quota or rate limit reached.")
    #expect(error.message != nil && error.seq == 4)
    #expect(sequencer.push(.idle).message == nil)
}

@Test func voiceStateLevelAndMute() {
    var sequencer = VoiceStateSequencer()
    #expect(sequencer.level(0.5) == nil)                 // idle: no audio, no level
    _ = sequencer.push(.listening, speechDetected: true)
    let level = sequencer.level(0.734)
    #expect(level?.level == 0.73 && level?.state == .listening && level?.speechDetected == true)
    _ = sequencer.push(.thinking)
    #expect(sequencer.level(0.9) == nil)                 // no audio while thinking
    let muted = sequencer.setMuted(true)
    #expect(muted.muted && muted.state == .thinking && muted.level == nil)
    #expect(sequencer.repeatCurrent().muted)              // mute persists in heartbeats
    #expect(sequencer.push(.speaking).jsonObject()["muted"] as? Bool == true)
}
