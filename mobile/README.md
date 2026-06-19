# Mobile path for Windows

This is the Windows-first phone build.

The goal is personal use, not App Store release.

## What works from Windows

Use Expo Go on the iPhone. This runs the app on the real phone without App Store submission and without a Mac.

You still need the iPhone and Windows machine on the same Wi-Fi for the clean LAN path.

## Clean run on a real iPhone

Do not run `npm audit fix --force` on Expo projects. It can jump Expo across incompatible SDK lines.

From Windows PowerShell:

```powershell
cd mobile
npm install
npm run phone
```

On iPhone:

```text
Install Expo Go
Scan the LAN QR code
Open MoneroOcean Steam
Settings -> paste wallet -> Save and refresh
```

## If tunnel is needed

LAN is the first path. Tunnel is only for broken Wi-Fi or separate networks.

```powershell
cd mobile
npm install --save-dev @expo/ngrok@^4.1.0
npm run tunnel
```

If ngrok was just installed globally and Expo still says to install it, close PowerShell, open a new PowerShell, then run again.

## Repair after npm audit force

If `npm audit fix --force` was run:

```powershell
cd mobile
git restore package.json
if (Test-Path package-lock.json) { del package-lock.json }
if (Test-Path node_modules) { rmdir /s /q node_modules }
npm install
npm run phone
```

## Standalone iOS app without App Store

For an installable standalone iOS build from Windows, use EAS internal distribution. This still needs Apple signing/provisioning.

```powershell
cd mobile
npm install --global eas-cli
eas login
eas build:configure
eas device:create
eas build --platform ios --profile preview
```

If you only need it for yourself right now, use Expo Go first.
