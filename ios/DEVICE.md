# Device build

This path is for a real iPhone, not the simulator.

## Need

- Mac
- Xcode
- Apple ID signed into Xcode
- XcodeGen
- iPhone connected by cable or trusted Wi-Fi

Install XcodeGen:

```bash
brew install xcodegen
```

Generate the project:

```bash
git pull
xcodegen generate
```

Open:

```bash
open MoneroOceanSteam.xcodeproj
```

In Xcode:

```text
Target: MoneroOceanSteam
Signing & Capabilities:
- Team: your Apple ID team
- Bundle Identifier: change if Xcode says it is taken

Run destination:
- your physical iPhone
```

Press Run.

## CLI build

If the team id is known:

```bash
export DEVELOPMENT_TEAM=ABCDE12345
bash scripts/ios-device-build.sh
```

The app is read-only. It talks to `https://api.moneroocean.stream` and stores only the wallet address in app storage.
