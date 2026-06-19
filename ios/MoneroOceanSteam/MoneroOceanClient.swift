import Foundation

final class MoneroOceanClient {
    private let baseURL = URL(string: "https://api.moneroocean.stream")!
    private let decoder = JSONDecoder()

    func minerStats(wallet: String) async throws -> MinerStats {
        try await get("/miner/\(wallet)/stats")
    }

    func workers(wallet: String) async throws -> [Worker] {
        let raw: [String: [String: AnyValue]] = try await get("/miner/\(wallet)/stats/allWorkers")

        return raw.map { name, fields in
            let hashrate = fields.number(for: ["hash2", "hash", "h", "r", "rate", "hashrate"]) ?? 0
            let algo = fields.string(for: ["algo", "algorithm", "coin", "ticker"])
            return Worker(id: name, name: name, hashrate: hashrate, algorithm: algo)
        }
        .sorted { $0.hashrate > $1.hashrate }
    }

    private func get<T: Decodable>(_ path: String) async throws -> T {
        let url = baseURL.appending(path: path)
        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 12

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }

        return try decoder.decode(T.self, from: data)
    }
}

enum AnyValue: Decodable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: AnyValue])
    case array([AnyValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: AnyValue].self) {
            self = .object(value)
        } else if let value = try? container.decode([AnyValue].self) {
            self = .array(value)
        } else {
            self = .null
        }
    }
}

extension Dictionary where Key == String, Value == AnyValue {
    func number(for keys: [String]) -> Double? {
        for key in keys {
            switch self[key] {
            case .number(let value): return value
            case .string(let value):
                if let parsed = Double(value) { return parsed }
            default:
                break
            }
        }

        return nil
    }

    func string(for keys: [String]) -> String? {
        for key in keys {
            if case .string(let value) = self[key], !value.isEmpty {
                return value
            }
        }

        return nil
    }
}
