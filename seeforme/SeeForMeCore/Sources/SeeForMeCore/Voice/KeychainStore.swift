import Foundation
import Security

/// Stores the ElevenLabs API key in the user's login keychain. The key never leaves the native app.
public enum KeychainStore {
    static let service = "com.seeforme.app.elevenlabs"
    static let account = "api-key"

    public enum Failure: Error { case status(OSStatus) }

    private static var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: account]
    }

    public static func save(_ key: String) throws {
        delete()
        var item = query
        item[kSecValueData as String] = Data(key.utf8)
        item[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        let status = SecItemAdd(item as CFDictionary, nil)
        guard status == errSecSuccess else { throw Failure.status(status) }
    }

    public static func load() -> String? {
        var search = query
        search[kSecReturnData as String] = true
        search[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(search as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    /// Whether a key is stored, without reading it. Reading only attributes avoids the
    /// "allow access" prompt a rebuilt (re-signed) app would otherwise trigger at launch.
    public static func exists() -> Bool {
        var search = query
        search[kSecReturnAttributes as String] = true
        search[kSecMatchLimit as String] = kSecMatchLimitOne
        return SecItemCopyMatching(search as CFDictionary, nil) == errSecSuccess
    }

    public static func delete() {
        SecItemDelete(query as CFDictionary)
    }
}
