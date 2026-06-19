import SwiftUI

struct RootView: View {
    @StateObject private var app = AppState()

    var body: some View {
        TabView {
            DashboardView()
                .tabItem { Label("Dash", systemImage: "house") }

            WorkersView()
                .tabItem { Label("Workers", systemImage: "person.2") }

            PaymentsView()
                .tabItem { Label("Payments", systemImage: "wallet.pass") }

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gear") }
        }
        .environmentObject(app)
        .tint(Theme.cyan)
    }
}

struct DashboardView: View {
    @EnvironmentObject private var app: AppState

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    header

                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        StatCard("Hashrate", Formatters.hashrate(app.currentHashrate), "30m average")
                        StatCard("Pending", Formatters.xmrAtomic(app.stats?.amtDue ?? app.stats?.due), "unpaid balance")
                        StatCard("Paid", Formatters.xmrAtomic(app.stats?.amtPaid ?? app.stats?.paid), "total payout")
                        StatCard("Workers", "\(app.onlineWorkers) / \(app.workers.count)", "online")
                    }

                    HashrateCard(value: app.currentHashrate)
                    StatusStrip()
                }
                .padding()
            }
            .background(Theme.bg.ignoresSafeArea())
            .navigationTitle("MoneroOcean Steam")
            .toolbar {
                Button { Task { await app.refresh() } } label: {
                    Image(systemName: "arrow.clockwise")
                }
            }
            .task { await app.refresh() }
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            WhaleTailMark()
                .frame(width: 34, height: 34)

            VStack(alignment: .leading, spacing: 3) {
                Text(app.wallet.isEmpty ? "No wallet set" : Formatters.shortWallet(app.wallet))
                    .font(.system(.body, design: .monospaced).weight(.medium))
                    .foregroundStyle(Theme.text)

                Text("clean read-only pool monitor")
                    .font(.caption)
                    .foregroundStyle(Theme.sub)
            }

            Spacer()
        }
        .padding(14)
        .background(CardBackground())
    }
}

struct WorkersView: View {
    @EnvironmentObject private var app: AppState

    var body: some View {
        NavigationStack {
            List {
                Section("\(app.onlineWorkers) / \(app.workers.count) online") {
                    ForEach(app.workers) { worker in
                        WorkerRow(worker: worker)
                            .listRowBackground(Theme.panel)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            .navigationTitle("Workers")
            .toolbar {
                Button { Task { await app.refresh() } } label: {
                    Image(systemName: "arrow.clockwise")
                }
            }
        }
    }
}

struct PaymentsView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Image(systemName: "wallet.pass")
                    .font(.system(size: 42))
                    .foregroundStyle(Theme.cyan)

                Text("Payments")
                    .font(.title2.bold())

                Text("Payment parser comes after live sample JSON is locked. Keep the first build honest.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.sub)
                    .padding(.horizontal)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.bg)
            .navigationTitle("Payments")
        }
    }
}

struct SettingsView: View {
    @EnvironmentObject private var app: AppState

    var body: some View {
        NavigationStack {
            Form {
                Section("Wallet") {
                    TextField("XMR wallet", text: $app.wallet, axis: .vertical)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .font(.system(.body, design: .monospaced))
                }

                Section("Build") {
                    LabeledContent("Mode", value: "read-only")
                    LabeledContent("Accent", value: "cyan")
                    LabeledContent("Refresh", value: "manual")
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            .navigationTitle("Settings")
        }
    }
}

struct StatCard: View {
    private let title: String
    private let value: String
    private let foot: String

    init(_ title: String, _ value: String, _ foot: String) {
        self.title = title
        self.value = value
        self.foot = foot
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption)
                .foregroundStyle(Theme.sub)

            Text(value)
                .font(.title3.bold())
                .foregroundStyle(Theme.text)
                .lineLimit(1)
                .minimumScaleFactor(0.65)

            Text(foot)
                .font(.caption2)
                .foregroundStyle(Theme.sub)
        }
        .frame(maxWidth: .infinity, minHeight: 92, alignment: .leading)
        .padding(14)
        .background(CardBackground())
    }
}

struct WorkerRow: View {
    let worker: Worker

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(worker.isOnline ? Theme.green : Theme.red)
                .frame(width: 9, height: 9)

            VStack(alignment: .leading, spacing: 3) {
                Text(worker.name)
                    .font(.system(.body, design: .monospaced).weight(.semibold))

                Text(worker.algorithm ?? "unknown algo")
                    .font(.caption)
                    .foregroundStyle(Theme.sub)
            }

            Spacer()

            Text(Formatters.hashrate(worker.hashrate))
                .font(.system(.body, design: .monospaced).weight(.medium))
        }
        .padding(.vertical, 8)
    }
}

struct HashrateCard: View {
    let value: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Hashrate")
                    .font(.headline)
                Spacer()
                Text(Formatters.hashrate(value))
                    .font(.system(.callout, design: .monospaced).weight(.semibold))
                    .foregroundStyle(Theme.cyan)
            }

            ChartLine()
                .stroke(Theme.cyan, style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
                .frame(height: 120)
                .background(
                    LinearGradient(colors: [Theme.cyan.opacity(0.18), .clear], startPoint: .top, endPoint: .bottom)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                )
        }
        .padding(14)
        .background(CardBackground())
    }
}

struct StatusStrip: View {
    var body: some View {
        HStack {
            Label("Connected", systemImage: "checkmark.shield")
                .foregroundStyle(Theme.green)
            Spacer()
            Text("MoneroOcean API")
                .foregroundStyle(Theme.sub)
        }
        .font(.footnote.weight(.medium))
        .padding(14)
        .background(CardBackground())
    }
}

struct CardBackground: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 18, style: .continuous)
            .fill(Theme.panel)
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(Theme.line, lineWidth: 1)
            )
    }
}

struct ChartLine: Shape {
    func path(in rect: CGRect) -> Path {
        let points: [CGFloat] = [0.62, 0.50, 0.57, 0.47, 0.52, 0.44, 0.40, 0.31, 0.39, 0.55, 0.48, 0.35, 0.28, 0.34]
        var path = Path()

        guard let first = points.first else { return path }
        path.move(to: CGPoint(x: rect.minX, y: rect.minY + first * rect.height))

        for index in points.indices.dropFirst() {
            let x = rect.minX + rect.width * CGFloat(index) / CGFloat(points.count - 1)
            let y = rect.minY + points[index] * rect.height
            path.addLine(to: CGPoint(x: x, y: y))
        }

        return path
    }
}

struct WhaleTailMark: View {
    var body: some View {
        Image(systemName: "water.waves")
            .font(.system(size: 26, weight: .bold))
            .foregroundStyle(Theme.cyan)
    }
}
