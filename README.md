**MoneroOcean** Steam is a read-only MoneroOcean mining pool monitor planned for iOS and Discord.

The product direction is simple: the mobile clarity of a SupportXMR-style pool monitor mixed with the deeper data model of the MoneroOcean web dashboard.

## Status

Initial scaffold is being built around API validation first. The Discord bot comes before the iOS app because it lets us prove the MoneroOcean JSON shape quickly with real wallet data.

## Boundaries

This project is a monitoring dashboard only.

It does not mine cryptocurrency on the device, manage private keys, act as a wallet, exchange funds, or submit transactions.

## Planned surfaces

- iOS app: dark-mode dashboard, workers, payments, pool status, settings
- Discord bot: slash commands for wallet stats, workers, payments, and later offline alerts
- API probe: local PowerShell script to capture real MoneroOcean JSON samples safely

## Repository layout

```text
api-probe/       PowerShell probes for real MoneroOcean API JSON
bot/             Discord bot prototype using TypeScript and discord.js
ios/             SwiftUI skeleton and product notes
```

## API base

```text
https://api.moneroocean.stream
```

Initial endpoints:

```text
GET /miner/<wallet>/stats
GET /miner/<wallet>/stats/allWorkers
GET /miner/<wallet>/chart/hashrate
GET /miner/<wallet>/chart/hashrate/allWorkers
GET /miner/<wallet>/payments?page=0&limit=15
GET /pool/stats
GET /network/stats
```

## Local start

Probe the API first:

```powershell
.\api-probe\mo-api-probe.ps1 -Wallet "YOUR_XMR_WALLET"
```

Run the bot prototype:

```powershell
cd bot
copy .env.example .env
npm install
npm run dev
```
