# MoneroOcean Steam PWA

This is the phone path for blocked ISP routes.

The iPhone opens this site, but the site calls `/api/...` on the same Cloudflare Pages domain. Cloudflare then fetches `https://api.moneroocean.stream` server-side.

Phone never talks to MoneroOcean directly.

## Cloudflare Pages settings

Use the existing Pages project linked to this repo.

```text
Build command: npm run build
Build output directory: pwa/dist
Root directory: /
```

Then redeploy.

## Local test on Windows

```powershell
git pull
npm install
npm run build
```

Or run the PWA only:

```powershell
cd pwa
npm install
npm run dev
```

Local dev does not include the Cloudflare function unless you use Wrangler/Pages dev. The deployed site is the real test path.

## iPhone install

Open the deployed Pages URL in Safari:

```text
Share -> Add to Home Screen
```

Then open it from the Home Screen icon.

## API paths

```text
/api/health
/api/miner/<wallet>/stats
/api/miner/<wallet>/workers
/api/miner/<wallet>/payments
```

The proxy rejects unknown paths and bad wallet strings.
