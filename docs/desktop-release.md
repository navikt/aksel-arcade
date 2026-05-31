# Desktop Arcade release setup

Desktop Arcade releases are published from GitHub Actions after Desktop-impacting changes reach protected `master`. GitHub Releases are the only supported Desktop Arcade distribution channel for now. The release workflow must keep release credentials out of source, Web Arcade, Desktop Arcade runtime, logs, and release assets.

## GitHub environment

Create a protected GitHub environment named `desktop-release` for signed Desktop Arcade releases.

- Do not require manual approval; releases are automatic after protected `master` merges.
- Restrict release credentials to this environment.
- Signed/notarized release jobs must run only on `push` to `master` or maintainer-triggered recovery dispatches for commits already on `master`, never on pull requests or arbitrary refs.

Maintainers can provision the environment metadata from a local terminal without handling any secret values in source or chat:

```bash
gh api \
  --method PUT \
  repos/navikt/aksel-arcade/environments/desktop-release \
  --input - <<'JSON'
{
  "wait_timer": 0,
  "reviewers": [],
  "prevent_self_review": false,
  "deployment_branch_policy": {
    "protected_branches": false,
    "custom_branch_policies": true
  }
}
JSON

gh api \
  --method POST \
  repos/navikt/aksel-arcade/environments/desktop-release/deployment-branch-policies \
  -f name=master \
  -f type=branch
```

This intentionally uses a custom branch policy for `master` plus the repository's branch protection on `master`, rather than allowing every protected branch to use Desktop release credentials.

## Required Apple credentials

Store these as encrypted environment secrets in `desktop-release`:

- `MAC_CERTIFICATE_P12_BASE64`: base64-encoded password-protected Developer ID Application certificate export.
- `MAC_CERTIFICATE_PASSWORD`: password for the exported `.p12`.
- `APPLE_API_KEY_BASE64`: base64-encoded App Store Connect API `.p8` key.
- `APPLE_API_KEY_ID`: App Store Connect API key ID.
- `APPLE_API_ISSUER_ID`: App Store Connect issuer ID.
- `APPLE_TEAM_ID`: Apple Developer team ID for the Developer ID certificate.

The release workflow should import the certificate into a temporary keychain for the macOS jobs and remove that keychain before the job exits. The App Store Connect API key is used for notarization only.

Set the environment secrets from a maintainer-controlled machine. Do not paste secret values into issues, pull requests, chat, docs, source files, release notes, workflow logs, or Arcade project data.

```bash
gh secret set MAC_CERTIFICATE_P12_BASE64 --env desktop-release --repo navikt/aksel-arcade
gh secret set MAC_CERTIFICATE_PASSWORD --env desktop-release --repo navikt/aksel-arcade
gh secret set APPLE_API_KEY_BASE64 --env desktop-release --repo navikt/aksel-arcade
gh secret set APPLE_API_KEY_ID --env desktop-release --repo navikt/aksel-arcade
gh secret set APPLE_API_ISSUER_ID --env desktop-release --repo navikt/aksel-arcade
gh secret set APPLE_TEAM_ID --env desktop-release --repo navikt/aksel-arcade
```

Run `npm run desktop:release-env-check` as a repository maintainer to confirm the environment metadata and required secret names are ready. The check reads only GitHub environment metadata and secret names; it never reads or prints secret values.

## Release shape

The installed app name is `Aksel Arcade` and the stable Electron/macOS application identifier is `no.nav.aksel.arcade`. Desktop packaging should use generated macOS and Windows icons derived from `public/aksel-favicon.svg`.

Each Desktop Arcade release uses a `desktop-vX.Y.Z` tag and publishes these human-facing installers:

- `Aksel-Arcade-X.Y.Z-windows-x64.exe`
- `Aksel-Arcade-X.Y.Z-mac-arm64.dmg`
- `Aksel-Arcade-X.Y.Z-mac-x64.dmg`

The first public Desktop Arcade release starts at `0.1.0`; the pipeline-introducing merge may publish `desktop-v0.1.0` when the release secrets are ready. Later automatic releases patch-bump from the latest `desktop-vX.Y.Z` tag. Version changes are injected in the workflow workspace before packaging and are not committed back to `master`.

The Windows installer is unsigned initially. macOS artifacts must use minimal hardened-runtime entitlements, be Developer ID signed, notarized, stapled, and locally validated before publication.

Release notes should include generated commit/PR notes plus a short fixed download guide that maps Windows, Mac Apple Silicon, and Mac Intel users to the right installer. Do not publish checksum artifacts initially.

## Release planning helper

Run `npm run desktop:release-plan` before entering the `desktop-release` environment. The helper accepts newline- or comma-separated `DESKTOP_RELEASE_CHANGED_FILES` and `DESKTOP_RELEASE_TAGS` values, then prints a JSON plan.

The plan requires a release for Desktop shell files, Desktop packaging/release automation, release-specific docs, and shared Arcade renderer files shipped by Desktop Arcade. It does not require a Desktop release for unrelated docs, tests, or the Web Arcade deploy workflow. The first release computes `0.1.0`; later releases patch-bump the highest valid `desktop-vX.Y.Z` tag while ignoring malformed or unrelated tags.

For maintainer recovery dispatches, set `GITHUB_EVENT_NAME=workflow_dispatch` and `DESKTOP_RELEASE_REF_ON_PROTECTED_MASTER=true` only after verifying the selected commit is already on protected `master`. Accepted plans inject `AKSEL_ARCADE_DESKTOP_VERSION` for the packaging workspace and keep `package.json` unchanged in git.

## Local unsigned packaging

Local development supports unsigned Desktop Arcade builds only. Run `npm run desktop:build` to generate Desktop icons from `public/aksel-favicon.svg`, build the sandbox bundle, and emit a Desktop-specific renderer to `dist-desktop` with relative asset URLs. This output is separate from the Web Arcade GitHub Pages build in `dist`.

Run `AKSEL_ARCADE_DESKTOP_VERSION=0.1.0 npm run desktop:package` to build the full configured unsigned local target matrix into `release/desktop` without publishing. The matrix is Windows x64 NSIS, macOS Apple Silicon DMG, and macOS Intel DMG. For host-specific local packaging, use `npm run desktop:package:mac` or `npm run desktop:package:win`; macOS DMGs require macOS, and Windows NSIS builds from macOS or Linux may require Wine.

The local packaging command uses `electron-builder.config.cjs`, installs the app as `Aksel Arcade`, uses `no.nav.aksel.arcade`, and names local artifacts with the same Desktop Arcade shape:

- `Aksel-Arcade-X.Y.Z-windows-x64.exe`
- `Aksel-Arcade-X.Y.Z-mac-arm64.dmg`
- `Aksel-Arcade-X.Y.Z-mac-x64.dmg`

## Pull request packaging checks

Desktop-impacting pull requests run unsigned Desktop packaging checks without entering the `desktop-release` environment. The `desktop-pr-packaging` workflow collects the pull request changed-file list, runs `npm run desktop:pr-package-plan`, and skips packaging when the same Desktop-impacting rules used for release planning find no Desktop Arcade impact.

When packaging is required, the workflow reuses the local unsigned package contract: macOS runners run `npm run desktop:package:mac`, Windows runners run `npm run desktop:package:win`, `AKSEL_ARCADE_DESKTOP_VERSION` is injected as CI workspace state, and the expected DMG/NSIS install artifacts must exist in `release/desktop`. Pull request packaging jobs do not request Desktop release credentials, do not sign or notarize artifacts, do not upload installers as workflow artifacts, and do not create GitHub Releases.

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
