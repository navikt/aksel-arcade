# Desktop Arcade release setup

Desktop Arcade releases are published from GitHub Actions after Desktop-impacting changes reach protected `master`. GitHub Releases are the only supported Desktop Arcade distribution channel for now. The release workflow must keep release credentials out of source, Web Arcade, Desktop Arcade runtime, logs, and release assets.

## GitHub environment

Create a protected GitHub environment named `desktop-release` for signed Desktop Arcade releases.

- Do not require manual approval; releases are automatic after protected `master` merges.
- Restrict release credentials to this environment.
- Signed/notarized release jobs must run only on `push` to `master` or maintainer-triggered recovery dispatches for commits already on `master`, never on pull requests or arbitrary refs.

## Required Apple credentials

Store these as encrypted environment secrets in `desktop-release`:

- `MAC_CERTIFICATE_P12_BASE64`: base64-encoded password-protected Developer ID Application certificate export.
- `MAC_CERTIFICATE_PASSWORD`: password for the exported `.p12`.
- `APPLE_API_KEY_BASE64`: base64-encoded App Store Connect API `.p8` key.
- `APPLE_API_KEY_ID`: App Store Connect API key ID.
- `APPLE_API_ISSUER_ID`: App Store Connect issuer ID.
- `APPLE_TEAM_ID`: Apple Developer team ID for the Developer ID certificate.

The release workflow should import the certificate into a temporary keychain for the macOS jobs and remove that keychain before the job exits. The App Store Connect API key is used for notarization only.

## Release shape

The installed app name is `Aksel Arcade` and the stable Electron/macOS application identifier is `no.nav.aksel.arcade`. Desktop packaging should use generated macOS and Windows icons derived from `public/aksel-favicon.svg`.

Each Desktop Arcade release uses a `desktop-vX.Y.Z` tag and publishes these human-facing installers:

- `Aksel-Arcade-X.Y.Z-windows-x64.exe`
- `Aksel-Arcade-X.Y.Z-mac-arm64.dmg`
- `Aksel-Arcade-X.Y.Z-mac-x64.dmg`

The first public Desktop Arcade release starts at `0.1.0`; the pipeline-introducing merge may publish `desktop-v0.1.0` when the release secrets are ready. Later automatic releases patch-bump from the latest `desktop-vX.Y.Z` tag. Version changes are injected in the workflow workspace before packaging and are not committed back to `master`.

The Windows installer is unsigned initially. macOS artifacts must use minimal hardened-runtime entitlements, be Developer ID signed, notarized, stapled, and locally validated before publication.

Release notes should include generated commit/PR notes plus a short fixed download guide that maps Windows, Mac Apple Silicon, and Mac Intel users to the right installer. Do not publish checksum artifacts initially.

## Safety rules

- Detect Desktop-impacting changes before entering the `desktop-release` environment.
- Use a Desktop-specific Vite build with relative asset URLs and a separate build output from the Web Arcade GitHub Pages build.
- Fail loudly with a setup error when a Desktop-impacting release is required but release secrets are missing.
- Build and validate all required installers before creating the public GitHub Release.
- Publish no partial releases.
- Keep Web Arcade GitHub Pages deployment independent from Desktop Arcade release success.
- Use unsigned PR packaging checks for Desktop-impacting pull requests, but do not publish unsigned installers as user-downloadable artifacts.
- Keep signed public releases CI-only; local development supports unsigned Desktop Arcade builds only.
- Keep in-app updates and Web Arcade download UI out of the initial release path.
