import AppKit
import SwiftUI

/// Floating voice-call bar shown above Safari while a voice conversation is active.
/// It never takes focus, so the user can keep typing into the web page.
final class CallBarController {
    private var panel: NSPanel?
    private let voice: VoiceModel

    init(voice: VoiceModel) {
        self.voice = voice
    }

    func setVisible(_ visible: Bool) {
        visible ? show() : hide()
    }

    private func show() {
        let panel = panel ?? makePanel()
        self.panel = panel
        guard !panel.isVisible else { return }
        panel.alphaValue = 0
        panel.orderFrontRegardless()
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.2
            panel.animator().alphaValue = 1
        }
    }

    private func hide() {
        guard let panel, panel.isVisible else { return }
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.2
            panel.animator().alphaValue = 0
        } completionHandler: {
            panel.orderOut(nil)
        }
    }

    private func makePanel() -> NSPanel {
        let size = NSSize(width: CallBarView.size.width + 40, height: CallBarView.size.height + 40) // room for the shadow
        let panel = NSPanel(contentRect: NSRect(origin: .zero, size: size),
                            styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.isFloatingPanel = true
        panel.level = .floating
        panel.hidesOnDeactivate = false
        panel.becomesKeyOnlyIfNeeded = true
        panel.isMovableByWindowBackground = true
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.hasShadow = false
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.contentView = FirstMouseHostingView(rootView: CallBarView(voice: voice))

        // Bottom centre of the screen with the mouse (usually the one showing Safari).
        let screen = NSScreen.screens.first { $0.frame.contains(NSEvent.mouseLocation) } ?? NSScreen.main
        if let visible = screen?.visibleFrame {
            panel.setFrameOrigin(NSPoint(x: visible.midX - size.width / 2, y: visible.minY + 40))
        }
        return panel
    }
}

/// Lets the buttons respond to the first click even though Safari is the active app.
private final class FirstMouseHostingView<Content: View>: NSHostingView<Content> {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}

struct CallBarView: View {
    static let size = CGSize(width: 300, height: 56)

    let voice: VoiceModel

    var body: some View {
        HStack(spacing: 0) {
            Button(action: voice.toggleMute) {
                Image(systemName: voice.muted ? "speaker.slash.fill" : "speaker.wave.2.fill")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Color(white: voice.state == .speaking ? 0.45 : 0.37)))
                    .contentTransition(.symbolEffect(.replace))
            }
            .buttonStyle(.plain)
            .help(voice.muted ? "Unmute SeeForMe" : "Mute SeeForMe")
            .accessibilityLabel(voice.muted ? "Unmute spoken replies" : "Mute spoken replies")

            Spacer(minLength: 8)
            Waveform(voice: voice)
                .help(voice.state.label)
                .accessibilityElement()
                .accessibilityLabel(voice.state.label)
            Spacer(minLength: 8)

            Button(action: voice.stop) {
                Image(systemName: "phone.down.fill")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Color(red: 0.78, green: 0.25, blue: 0.23)))
            }
            .buttonStyle(.plain)
            .help("End voice conversation")
            .accessibilityLabel("End voice conversation")
        }
        .padding(.horizontal, 6)
        .frame(width: Self.size.width, height: Self.size.height)
        .background(Capsule().fill(Color(white: 0.22)))
        .shadow(color: .black.opacity(0.3), radius: 12, y: 4)
        .frame(width: Self.size.width + 40, height: Self.size.height + 40)
    }
}

/// Eleven bars. While listening or speaking, heights come from real audio levels (newest at the centre).
/// While transcribing or thinking there is no audio, so the bars rest low and a soft highlight sweeps across
/// them as a processing indicator.
private struct Waveform: View {
    let voice: VoiceModel

    private static let shape: [CGFloat] = [0.55, 0.4, 0.7, 0.85, 0.3, 1.0, 0.3, 0.85, 0.7, 0.4, 0.55]
    private static let minHeight: CGFloat = 5
    private static let maxHeight: CGFloat = 30

    var body: some View {
        if voice.hasAudio {
            bars(opacity: { _ in 1 })
                .animation(.easeOut(duration: 0.08), value: voice.levels)
        } else {
            TimelineView(.animation) { context in
                let t = context.date.timeIntervalSinceReferenceDate
                bars(opacity: { index in
                    guard isProcessing else { return 0.35 }
                    return 0.35 + 0.45 * max(0, sin(t * 4 - Double(index) * 0.55))
                })
            }
        }
    }

    private var isProcessing: Bool {
        [.transcribing, .thinking, .preparingSpeech].contains(voice.state)
    }

    private func bars(opacity: @escaping (Int) -> Double) -> some View {
        HStack(spacing: 5) {
            ForEach(0..<Self.shape.count, id: \.self) { index in
                Capsule()
                    .fill(Color.white.opacity(barOpacity(opacity(index))))
                    .frame(width: 4, height: height(index))
            }
        }
        .frame(height: Self.maxHeight)
    }

    private func barOpacity(_ base: Double) -> Double {
        // Listening with no speech is grey; hearing speech or speaking is bright white.
        switch voice.state {
        case .hearing, .speaking: base
        case .listening: base * 0.7
        default: base
        }
    }

    private func height(_ index: Int) -> CGFloat {
        guard voice.hasAudio else { return Self.minHeight + 2 * Self.shape[index] }
        let levels = voice.levels
        let age = abs(index - Self.shape.count / 2)          // 0 at the centre
        let level = CGFloat(levels[max(0, levels.count - 1 - age)])
        return Self.minHeight + (Self.maxHeight - Self.minHeight) * min(1, level * (0.5 + Self.shape[index]))
    }
}
