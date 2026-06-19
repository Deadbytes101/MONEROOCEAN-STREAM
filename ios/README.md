# iOS

SwiftUI source cut for MoneroOcean Steam.

This is the phone shell: dark navy, cyan accent, real API client, dashboard, workers, payments placeholder, and settings wallet input.

## Files

```text
MoneroOceanSteamApp.swift   app entry
RootView                    tab shell
DashboardView               pool overview
WorkersView                 worker list
SettingsView                wallet input
MoneroOceanClient           API tap
AppState                    screen state
Theme                       visual system
```

## Xcode bring-up

Create a new iOS SwiftUI app named `MoneroOceanSteam`, then drop the files from `ios/MoneroOceanSteam/` into the app target.

Minimum target: iOS 17 while the shell is moving fast.

The first real build target is dashboard + workers. Payments stays honest until live sample JSON is locked.
