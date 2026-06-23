---
status: superseded by ADR-0019
---

# Desktop Arcade release pipeline

Desktop Arcade releases will be published as versioned GitHub Releases, separate from Web Arcade deployment, with one release containing the Windows x64 installer and the macOS Apple Silicon and Intel DMGs for that Desktop Arcade version. The pipeline will use electron-builder inside a GitHub Actions OS/architecture matrix; release jobs run only after Desktop-impacting changes reach protected `master`, use protected GitHub environment secrets for Apple Developer ID signing and App Store Connect API-key notarization, and publish only after all required artifacts are built, signed where required, notarized, stapled, and validated.

Desktop Arcade versions will use `desktop-vX.Y.Z` tags as the source of truth, starting at `0.1.0` and patch-bumping automatically per releasing push without committing version changes back to `master`. This avoids release-loop bot commits and keeps signing credentials out of source, Web Arcade, Desktop Arcade runtime, logs, and release assets; the tradeoff is that CI injects the release version into the packaging workspace rather than reading it directly from a committed package version.

Desktop Arcade packaging will use a desktop-specific Vite build with relative assets and a separate build output from Web Arcade's GitHub Pages build. Desktop release publication will happen in a final GitHub Actions job rather than directly from each electron-builder matrix job, so a public release is created only after the Windows installer and both macOS DMGs have succeeded; unsigned PR packaging checks may validate those targets but should not publish user-downloadable installers.
