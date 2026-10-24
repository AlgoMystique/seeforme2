import AppKit
import SwiftUI

@main struct MyApp: App {
    init() {
        // `seeforme --self-test` runs the built-in synthetic-form check inside the sandboxed app and exits.
        if CommandLine.arguments.contains("--self-test") {
            Task {
                let model = AppModel()
                await model.runSelfTest()
                print(model.selfTestResult ?? "no result")
                NSApplication.shared.terminate(nil)
            }
        }
    }

    var body: some Scene {
        WindowGroup("SeeForMe") {
            ContentView()
        }
    }
}
