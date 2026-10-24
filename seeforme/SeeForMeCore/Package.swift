// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "SeeForMeCore",
    platforms: [.macOS("26.0")],
    products: [
        .library(name: "SeeForMeCore", targets: ["SeeForMeCore"]),
    ],
    targets: [
        .target(name: "SeeForMeCore"),
        .testTarget(name: "SeeForMeCoreTests", dependencies: ["SeeForMeCore"]),
    ]
)
