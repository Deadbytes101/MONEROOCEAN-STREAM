# MoneroOcean Steam Bot

Discord slash-command prototype for checking MoneroOcean mining status.

## Setup

```powershell
cd bot
copy .env.example .env
npm install
npm run dev
```

Fill `.env` first:

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
DEFAULT_WALLET=
```

`DEFAULT_WALLET` is optional, but useful so commands can be run without pasting a wallet every time.

## Commands

```text
/mo-stats [wallet]
/mo-workers [wallet]
/mo-payments [wallet]
```

## Notes

- Read-only only. The bot never asks for private keys.
- The API parser is deliberately tolerant because MoneroOcean endpoint shapes should be confirmed against real sample JSON before locking strict models.
- Offline alerts are planned after the workers JSON is confirmed from real rigs.
