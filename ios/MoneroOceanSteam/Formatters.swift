import Foundation

enum Formatters {
    static func xmrAtomic(_ value: Double?) -> String {
        let xmr = (value ?? 0) / 1_000_000_000_000
        return String(format: "%.6f XMR", xmr)
    }

    static func hashrate(_ value: Double?) -> String {
        let h = value ?? 0

        if h >= 1_000_000 {
            return String(format: "%.2f MH/s", h / 1_000_000)
        }

        if h >= 1_000 {
            return String(format: "%.2f KH/s", h / 1_000)
        }

        return String(format: "%.2f H/s", h)
    }

    static func shortWallet(_ wallet: String) -> String {
        guard wallet.count > 18 else { return wallet }
        return "\(wallet.prefix(8))...\(wallet.suffix(8))"
    }
}
