---
status: accepted
---

# Two-line Desktop Arcade release flow

Desktop Arcade will use two protected long-lived branches instead of publishing every Desktop-impacting `master` merge directly. `release-candidate` is the protected integration line for short-lived feature PRs and signs versioned GitHub pre-releases for the current Target release version as `desktop-vX.Y.Z-rc.N`; `master` is the protected Stable release line for public GitHub Releases and the existing GitHub Pages deploy, reached only by Release promotion PRs from `release-candidate` and patch-only Hotfixes from `master`. To keep the workflow low-risk and low-maintenance, the same protected Apple-signing environment may run only on `release-candidate` and `master`, Windows distribution is removed for now instead of introducing weaker signing, each RC cycle starts with an explicit user-chosen patch/minor/major target version, and old RC pre-releases remain on the Releases page as history.
