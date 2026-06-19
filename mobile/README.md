# Mobile path for Windows

This is the Windows-first phone build.

The SwiftUI/Xcode source stays in `ios/`, but a real iPhone build cannot be signed locally from Windows. This Expo app is the practical path:

- run on real iPhone now through Expo Go
- build signed iOS binaries through EAS cloud later
- keep the same MoneroOcean API and visual direction

## Run on a real iPhone from Windows

Install Node LTS, then:

```powershell
cd mobile
npm install
npx expo start --tunnel
```

On iPhone:

```text
Install Expo Go
Scan the QR code
Open MoneroOcean Steam
Settings -> paste wallet -> Save and refresh
```

## Build a signed iOS app from Windows

This needs an Apple Developer Program account because Apple signing is still required.

```powershell
cd mobile
npm install --global eas-cli
eas login
eas build:configure
eas device:create
eas build --platform ios --profile preview
```

The `preview` profile is internal distribution. EAS will create a cloud iOS build and provide an install link for registered devices.

## Android side

Android can be built locally or with EAS later. The current priority is the iPhone-facing app shape.
