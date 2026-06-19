import Foundation

struct MinerStats: Decodable {
    let amtDue: Double?
    let amtPaid: Double?
    let due: Double?
    let paid: Double?
    let hash: Double?
    let hash2: Double?
    let lastHash: Double?
    let lastShare: Double?
    let txnCount: Int?
}

struct Worker: Identifiable, Hashable {
    let id: String
    let name: String
    let hashrate: Double
    let algorithm: String?

    var isOnline: Bool { hashrate > 0 }
}

struct Payment: Identifiable, Hashable {
    let id: String
    let amountAtomic: Double
    let label: String
}

enum LoadState: Equatable {
    case idle
    case loading
    case failed(String)
}
