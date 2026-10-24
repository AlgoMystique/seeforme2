import Foundation
import Testing
@testable import SeeForMeCore

@Test func audioLevelMapping() {
    #expect(AudioLevel.normalized(decibels: -160) == 0)
    #expect(AudioLevel.normalized(decibels: -.infinity) == 0)
    #expect(AudioLevel.normalized(decibels: -30) == 0.5)
    #expect(AudioLevel.normalized(decibels: 0) == 1)
    #expect(AudioLevel.normalized(rms: 0) == 0)
    #expect(abs(AudioLevel.normalized(rms: 0.1) - 0.75) < 0.001) // 0.1 RMS = -20 dBFS
}

@Test func voiceCommandsMatchContract() {
    #expect(VoiceCommand(rawValue: "VOICE_START") == .start)
    #expect(VoiceCommand(rawValue: "VOICE_STOP") == .stop)
    #expect(VoiceCommand(rawValue: "VOICE_MUTE") == .mute)
    #expect(VoiceCommand(rawValue: "VOICE_UNMUTE") == .unmute)
    #expect(VoiceCommand(rawValue: "FORM_SNAPSHOT") == nil)
}
