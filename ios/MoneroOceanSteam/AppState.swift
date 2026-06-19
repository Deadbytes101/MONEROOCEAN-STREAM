import Foundation
import SwiftUI

@MainActor
final class AppState: ObservableObject {
    @AppStorage("wallet") var wallet = ""

    @Published var stats: MinerStats?
    @Published var workers: [Worker] = []
    @Published var state: LoadState = .idle
    @Published var lastUpdated: Date?

    private let client = MoneroOceanClient()

    var onlineWorkers: Int {
        workers.filter(\.isOnline).count
    }

    var currentHashrate: Double {
        stats?.hash2 ?? stats?.hash ?? 0
    }

    func refresh() async {
        guard !wallet.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            state = .failed("Set wallet first")
            return
        }

        state = .loading

        do {
            async let statsTask = client.minerStats(wallet: wallet)
            async let workersTask = client.workers(wallet: wallet)

            stats = try await statsTask
            workers = try await workersTask
            lastUpdated = Date()
            state = .idle
        } catch {
            state = .failed(error.localizedDescription)
        }
    }
}
