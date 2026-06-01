# Desktop Arcade release setup

Desktop Arcade releases are published from GitHub Actions after Desktop-impacting changes reach protected `master`. GitHub Releases are the only supported Desktop Arcade distribution channel for now. The release workflow must keep release credentials out of source, Web Arcade, Desktop Arcade runtime, logs, release assets, and Arcade project data.

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

## User download guide

Desktop Arcade is downloaded only from the repository's GitHub Releases page. Web Arcade remains the browser-hosted product surface at the GitHub Pages URL; Web Arcade URLs do not install, update, or distribute Desktop Arcade.

For each Desktop Arcade release, open the latest published GitHub Release tagged `desktop-vX.Y.Z` and download the matching Desktop install artifact:

| User machine | Desktop install artifact |
| --- | --- |
| Windows x64 | `Aksel-Arcade-X.Y.Z-windows-x64.exe` |
| Mac with Apple Silicon | `Aksel-Arcade-X.Y.Z-mac-arm64.dmg` |
| Mac with Intel processor | `Aksel-Arcade-X.Y.Z-mac-x64.dmg` |

The `X.Y.Z` part matches the Desktop Arcade version in the release. The initial distribution path does not include a Web Arcade download UI, in-app updates, package-manager distribution, Windows code signing, or checksum artifacts. Do not attach or link unsigned pull request packaging outputs as user-downloadable installers.

## Release planning helper

Run `npm run desktop:release-plan` before entering the `desktop-release` environment. The helper accepts newline- or comma-separated `DESKTOP_RELEASE_CHANGED_FILES` and `DESKTOP_RELEASE_TAGS` values, then prints a JSON plan.

The plan requires a release for Desktop shell files, Desktop packaging/release automation, release-specific docs, and shared Arcade renderer files shipped by Desktop Arcade. It does not require a Desktop release for unrelated docs, tests, or the Web Arcade deploy workflow. The first release computes `0.1.0`; later releases patch-bump the highest valid `desktop-vX.Y.Z` tag while ignoring malformed or unrelated tags.

For maintainer recovery dispatches, set `GITHUB_EVENT_NAME=workflow_dispatch` and `DESKTOP_RELEASE_REF_ON_PROTECTED_MASTER=true` only after verifying the selected commit is already on protected `master`. Accepted plans inject `AKSEL_ARCADE_DESKTOP_VERSION` for the packaging workspace and keep `package.json` unchanged in git.

## Maintainer recovery dispatch

The `desktop-release` workflow supports maintainer-triggered recovery through `workflow_dispatch` with a required `recovery_sha`. Use it only to recover a failed or cancelled Desktop Arcade release for a commit that is already reachable from protected `master`.

Recovery dispatch rules:

- Dispatch the workflow from the `master` branch and provide a full 40-character commit SHA.
- The plan job fetches `origin/master` and rejects the dispatch unless `recovery_sha` is an ancestor of protected `master`.
- Packaging jobs first checkout the trusted workflow ref, then re-fetch `origin/master`, re-verify the resolved release source is reachable from protected `master`, and only then detach to that commit before package scripts run.
- Recovery runs with an empty changed-file list and forces a Desktop release plan for the protected commit unless that same commit already has a published `desktop-vX.Y.Z` release tag.
- Do not use recovery dispatches for pull requests, arbitrary branches, unmerged commits, or local rebuilds.
- Recovery must reference only the `desktop-release` environment and configured secret names; never copy Desktop release credential values into issues, pull requests, chat, docs, source, logs, release assets, runtime state, or Arcade project data.

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

## Signed macOS release packaging

The signed macOS release path is CI-only and is prepared for the protected `desktop-release` environment. A macOS release job should call `npm run desktop:package:mac:release` after setting `AKSEL_ARCADE_DESKTOP_VERSION`. The command validates the required Desktop release credentials, imports the Developer ID Application certificate into a temporary keychain, builds the Desktop renderer, runs `electron-builder` in release signing mode, notarizes each expected DMG with the App Store Connect API key, staples the notarization ticket, validates the Developer ID signature, validates Gatekeeper assessment, and deletes the temporary keychain before exiting.

The release signing mode keeps local unsigned packaging unchanged and enables macOS hardened runtime with the minimal entitlements in `desktop/entitlements.mac.plist`. The expected signed macOS artifacts remain:

- `Aksel-Arcade-X.Y.Z-mac-arm64.dmg`
- `Aksel-Arcade-X.Y.Z-mac-x64.dmg`

## Failure expectations

- Non-Desktop-impacting pushes and commits that already have a published Desktop release tag are skipped before any job enters the `desktop-release` environment.
- Invalid recovery dispatches fail in the plan job before release credentials are requested.
- Missing or invalid Desktop release credentials fail the signed macOS package job with a setup error that names the missing secret, but never prints secret values.
- macOS signing, notarization, stapling, Gatekeeper validation, Windows packaging, or release asset validation failures stop the publish job and produce no public partial release.
- The publish job creates a draft release, uploads exactly the three expected installers, validates the published asset set, and only then marks the release public. If publish fails or is cancelled, the workflow deletes the draft release and cleans up the tag where possible.
- Pull request packaging checks stay unsigned, avoid the `desktop-release` environment, do not upload user-downloadable installers, and do not create GitHub Releases.

## Safety rules

- Detect Desktop-impacting changes before entering the `desktop-release` environment.
- Use a Desktop-specific Vite build with relative asset URLs and a separate build output from the Web Arcade GitHub Pages build.
- Keep Desktop release credentials out of source, Web Arcade, Desktop Arcade runtime, workflow logs, release assets, and Arcade project data. Documentation, issues, pull requests, and release notes may reference secret names only.
- Fail loudly with a setup error when a Desktop-impacting release is required but release secrets are missing or invalid, without printing secret values.
- Build and validate all required installers before creating the public GitHub Release.
- Publish no partial releases.
- Keep Web Arcade GitHub Pages deployment independent from Desktop Arcade release success.
- Use unsigned PR packaging checks for Desktop-impacting pull requests, but do not publish unsigned installers as user-downloadable artifacts.
- Keep signed public releases CI-only; local development supports unsigned Desktop Arcade builds only.
- Keep in-app updates, Web Arcade download UI, package-manager distribution, initial Windows signing, and checksum artifacts out of the initial release path.
