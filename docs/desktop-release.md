# Desktop Arcade release setup

This document is the release policy that agents and GitHub automation should follow. Desktop Arcade uses a two-line release flow: `release-candidate` publishes signed Desktop release candidates for team testing, while `master` publishes public Desktop Arcade releases and the stable GitHub Pages site. GitHub Releases remain the only supported Desktop distribution channel, and only signed macOS DMGs are supported for distribution for now.

## Branch roles

- **`release-candidate`**: protected integration line for ordinary feature work. Short-lived feature branches should open PRs back to `release-candidate`, and Desktop-impacting merges there should publish signed GitHub pre-releases for the active RC cycle.
- **`master`**: protected Stable release line. Only **Release promotions** and **Hotfixes** should land here. Merges here should publish the public Desktop release and update GitHub Pages.
- Agents should default ordinary work to `release-candidate`. Agents should touch `master` only when the user explicitly asks for a **Release promotion** or **Hotfix**.
- Agents may merge to `master` only on explicit user instruction and only after the required checks pass.

## RC cycle state

- The active RC cycle lives in `.github/release-candidate.json`.
- That file contains only the current `targetVersion`.
- The initial target version for this workflow is `0.2.0`.
- RC builds should publish as versioned GitHub pre-releases with tags shaped like `desktop-vX.Y.Z-rc.N`.
- Public releases should publish as non-prerelease GitHub Releases with tags shaped like `desktop-vX.Y.Z`.
- Old RC pre-releases should remain on the Releases page as history after the matching public release ships.
- Each new RC cycle starts when the user chooses a `patch`, `minor`, or `major` bump and asks an agent to update `.github/release-candidate.json`.
- Hotfixes are always patch-only public releases and must be carried back automatically into `release-candidate`.

## Agent request examples

These are the preferred user requests for agents:

- `Start the next minor RC cycle from master and set the target version in .github/release-candidate.json.`
- `Merge this feature PR into release-candidate when checks pass.`
- `Prepare a Release promotion from release-candidate to master for the current target version.`
- `Merge the release promotion PR if checks are green.`
- `Prepare a Hotfix from master for <bug>, then carry it back to release-candidate.`
- `Merge the hotfix PR if checks are green.`

If the user does not explicitly ask for a **Release promotion** or **Hotfix**, agents should keep work on the ordinary feature flow targeting `release-candidate`.

## GitHub environment

Use one protected GitHub environment named `desktop-release` for both RC and public signed macOS releases.

- Do not require manual approval.
- Restrict signing credentials to this environment.
- Allow only the protected `release-candidate` and `master` branches to use it.
- Do not allow pull requests or arbitrary refs to access release credentials.

Maintainers can provision the shared environment metadata from a local terminal without handling any secret values in source or chat:

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
  -f name=release-candidate \
  -f type=branch

gh api \
  --method POST \
  repos/navikt/aksel-arcade/environments/desktop-release/deployment-branch-policies \
  -f name=master \
  -f type=branch
```

Keep the configured branch policies limited to those two protected branches.

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

## Release shape

The installed app name is `Aksel Arcade` and the stable Electron/macOS application identifier is `no.nav.aksel.arcade`.

Supported download artifacts:

- `Aksel-Arcade-X.Y.Z-mac-arm64.dmg`
- `Aksel-Arcade-X.Y.Z-mac-x64.dmg`

macOS artifacts must use minimal hardened-runtime entitlements, be Developer ID signed, notarized, stapled, and validated before publication.

Windows installers are not a supported Desktop release target for now. If Windows packaging commands or workflow fragments remain in the repo during migration, do not treat them as supported release distribution.

Release notes should include generated commit or PR notes plus a short fixed download guide for Mac Apple Silicon and Mac Intel users.

## User download guide

Desktop Arcade is downloaded only from the repository's GitHub Releases page.

- Team testers should download the latest matching GitHub pre-release for the active RC cycle.
- End users should download the latest non-prerelease GitHub Release.
- Web Arcade remains the browser-hosted product surface at the GitHub Pages URL on `master`.
- Merges to `release-candidate` must not update the public GitHub Pages site.

| User machine | Desktop install artifact |
| --- | --- |
| Mac with Apple Silicon | `Aksel-Arcade-X.Y.Z-mac-arm64.dmg` |
| Mac with Intel processor | `Aksel-Arcade-X.Y.Z-mac-x64.dmg` |

## Local packaging for smoke checks

Local development supports unsigned Desktop Arcade builds only. Use local packages for smoke checks, not for team or public distribution.

```bash
npm run desktop:build
AKSEL_ARCADE_DESKTOP_VERSION=0.2.0 npm run desktop:package:mac
```

The local macOS package shape remains:

- `Aksel-Arcade-X.Y.Z-mac-arm64.dmg`
- `Aksel-Arcade-X.Y.Z-mac-x64.dmg`

## One-time bootstrap checklist

1. Create `release-candidate` from the current stable `master`.
2. Protect both `release-candidate` and `master` with required checks and PR-based merges.
3. Configure the shared `desktop-release` environment so only `release-candidate` and `master` may use release credentials.
4. Commit `.github/release-candidate.json` with the initial target version `0.2.0` on `release-candidate`.
5. Update release automation, release notes, and distribution guidance to remove Windows as a supported downloadable artifact.
6. Keep public GitHub Pages deployment on `master` only.

## Safety rules

- Default ordinary work to `release-candidate`.
- Use `master` only for explicit **Release promotions** and **Hotfixes**.
- Keep Desktop release credentials out of source, Web Arcade, Desktop Arcade runtime, workflow logs, release assets, and Arcade project data.
- Publish signed release candidates and signed public releases only from the shared protected environment.
- Publish no partial releases.
- Do not distribute unsigned pull request builds or local smoke packages to testers or end users.
- Carry every merged Hotfix back into `release-candidate`.
