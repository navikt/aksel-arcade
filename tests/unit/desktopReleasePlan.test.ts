import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

interface DesktopReleasePlanInput {
  changedFiles?: string[];
  eventName?: string;
  refName?: string;
  refOnProtectedBranch?: boolean;
  stableBranch?: string;
  releaseCandidateBranch?: string;
  releaseTags?: string[];
  currentRefReleaseTags?: string[];
  targetVersion?: string;
}

interface VersionInjection {
  environment: Record<string, string>;
  commitPackageVersion: boolean;
}

interface DesktopReleasePlan {
  releaseChannel: "candidate" | "stable" | null;
  prerelease: boolean;
  targetVersion: string | null;
  releaseRequired: boolean;
  rejected: boolean;
  rejectionReason: string | null;
  reason: string;
  desktopImpacting: boolean;
  desktopImpactingFiles: string[];
  latestPublicDesktopReleaseTag: string | null;
  latestReleaseCandidateTag: string | null;
  currentRefDesktopReleaseTag: string | null;
  desktopVersion: string | null;
  desktopTag: string | null;
  versionInjection: VersionInjection | null;
}

interface ParsedDesktopReleaseTag {
  tag: string;
  version: string;
  major: number;
  minor: number;
  patch: number;
}

interface ParsedDesktopReleaseCandidateTag extends ParsedDesktopReleaseTag {
  targetVersion: string;
  rcNumber: number;
}

interface DesktopReleasePlanModule {
  FIRST_DESKTOP_VERSION: string;
  VERSION_ENV_VAR: string;
  createDesktopReleasePlan(
    input?: DesktopReleasePlanInput,
  ): DesktopReleasePlan;
  findLatestDesktopReleaseTag(
    tags: string[],
  ): ParsedDesktopReleaseTag | null;
  findLatestReleaseCandidateTag(
    tags: string[],
    targetVersion: string,
  ): ParsedDesktopReleaseCandidateTag | null;
  isDesktopImpactingPath(filePath: string): boolean;
  resolveStableDesktopVersion(input: {
    releaseTags: string[];
    targetVersion: string;
  }): string;
}

const require = createRequire(import.meta.url);
const releasePlan = require(
  "../../scripts/desktop-release-plan.cjs",
) as DesktopReleasePlanModule;

const createReleaseCandidatePushPlan = (
  overrides: DesktopReleasePlanInput = {},
): DesktopReleasePlan =>
  releasePlan.createDesktopReleasePlan({
    eventName: "push",
    refName: "release-candidate",
    changedFiles: [],
    releaseTags: ["desktop-v0.1.83"],
    targetVersion: "0.2.0",
    ...overrides,
  });

const createStablePushPlan = (
  overrides: DesktopReleasePlanInput = {},
): DesktopReleasePlan =>
  releasePlan.createDesktopReleasePlan({
    eventName: "push",
    refName: "master",
    changedFiles: [],
    releaseTags: ["desktop-v0.1.83"],
    targetVersion: "0.2.0",
    ...overrides,
  });

describe("Desktop release planning", () => {
  it("does not require a candidate release for unrelated docs, tests, or web-only deployment changes", () => {
    const plan = createReleaseCandidatePushPlan({
      changedFiles: [
        "README.md",
        "docs/prd/share-url.md",
        ".github/workflows/deploy.yml",
        "tests/unit/desktopReleasePlan.test.ts",
      ],
    });

    expect(plan).toMatchObject({
      releaseChannel: "candidate",
      prerelease: true,
      targetVersion: "0.2.0",
      releaseRequired: false,
      rejected: false,
      reason: "no-desktop-impacting-change",
      desktopImpacting: false,
      desktopImpactingFiles: [],
      desktopVersion: null,
      desktopTag: null,
      versionInjection: null,
    });
  });

  it("treats the RC target file as Desktop-impacting so a new cycle can publish its first candidate", () => {
    const plan = createReleaseCandidatePushPlan({
      changedFiles: [".github/release-candidate.json"],
    });

    expect(releasePlan.isDesktopImpactingPath(".github/release-candidate.json")).toBe(
      true,
    );
    expect(plan).toMatchObject({
      releaseChannel: "candidate",
      releaseRequired: true,
      reason: "desktop-impacting-change",
      desktopImpactingFiles: [".github/release-candidate.json"],
      latestPublicDesktopReleaseTag: "desktop-v0.1.83",
      desktopVersion: "0.2.0-rc.1",
      desktopTag: "desktop-v0.2.0-rc.1",
    });
  });

  it("increments the rc number from the latest published candidate tag for the target version", () => {
    const tags = [
      "desktop-v0.1.83",
      "desktop-v0.2.0-rc.1",
      "desktop-v0.2.0-rc.2",
      "desktop-v0.3.0-rc.1",
    ];
    const plan = createReleaseCandidatePushPlan({
      changedFiles: ["desktop/main.cjs"],
      releaseTags: tags,
    });

    expect(releasePlan.findLatestReleaseCandidateTag(tags, "0.2.0")).toMatchObject(
      {
        tag: "desktop-v0.2.0-rc.2",
        targetVersion: "0.2.0",
        rcNumber: 2,
      },
    );
    expect(plan).toMatchObject({
      releaseChannel: "candidate",
      prerelease: true,
      releaseRequired: true,
      latestReleaseCandidateTag: "desktop-v0.2.0-rc.2",
      desktopVersion: "0.2.0-rc.3",
      desktopTag: "desktop-v0.2.0-rc.3",
    });
    expect(plan.versionInjection).toEqual({
      environment: {
        [releasePlan.VERSION_ENV_VAR]: "0.2.0-rc.3",
      },
      commitPackageVersion: false,
    });
  });

  it("skips RC publishing until the user starts a new cycle when the target version is already public", () => {
    const plan = createReleaseCandidatePushPlan({
      changedFiles: ["desktop/main.cjs"],
      releaseTags: ["desktop-v0.1.83", "desktop-v0.2.0"],
    });

    expect(plan).toMatchObject({
      releaseChannel: "candidate",
      releaseRequired: false,
      rejected: false,
      reason: "target-version-already-released",
      latestPublicDesktopReleaseTag: "desktop-v0.2.0",
      desktopVersion: null,
      desktopTag: null,
      versionInjection: null,
    });
  });

  it("uses the target version for a stable release promotion when it is ahead of the latest public release", () => {
    const plan = createStablePushPlan({
      changedFiles: [
        "desktop/main.cjs",
        ".github/workflows/desktop-release.yml",
        "scripts/desktop-builder-config.cjs",
      ],
    });

    expect(plan).toMatchObject({
      releaseChannel: "stable",
      prerelease: false,
      releaseRequired: true,
      reason: "release-promotion",
      desktopImpactingFiles: [
        "desktop/main.cjs",
        ".github/workflows/desktop-release.yml",
        "scripts/desktop-builder-config.cjs",
      ],
      latestPublicDesktopReleaseTag: "desktop-v0.1.83",
      desktopVersion: "0.2.0",
      desktopTag: "desktop-v0.2.0",
    });
    expect(plan.versionInjection).toEqual({
      environment: {
        [releasePlan.VERSION_ENV_VAR]: "0.2.0",
      },
      commitPackageVersion: false,
    });
  });

  it("patch-bumps stable releases for hotfixes when the target version is not ahead of the latest public release", () => {
    const tags = ["desktop-v0.2.0", "desktop-v0.2.0-rc.2"];
    const plan = createStablePushPlan({
      changedFiles: ["desktop/main.cjs"],
      releaseTags: tags,
      targetVersion: "0.2.0",
    });

    expect(releasePlan.findLatestDesktopReleaseTag(tags)).toMatchObject({
      tag: "desktop-v0.2.0",
      version: "0.2.0",
      major: 0,
      minor: 2,
      patch: 0,
    });
    expect(
      releasePlan.resolveStableDesktopVersion({
        releaseTags: tags,
        targetVersion: "0.2.0",
      }),
    ).toBe("0.2.1");
    expect(plan).toMatchObject({
      releaseChannel: "stable",
      releaseRequired: true,
      reason: "hotfix",
      desktopVersion: "0.2.1",
      desktopTag: "desktop-v0.2.1",
    });
  });

  it("skips stable release planning when the current ref already has a public release tag", () => {
    const plan = createStablePushPlan({
      changedFiles: ["desktop/main.cjs"],
      releaseTags: ["desktop-v0.2.0", "desktop-v0.2.1"],
      currentRefReleaseTags: ["desktop-v0.2.1"],
      targetVersion: "0.2.0",
    });

    expect(plan).toMatchObject({
      releaseChannel: "stable",
      releaseRequired: false,
      rejected: false,
      reason: "current-ref-already-released",
      latestPublicDesktopReleaseTag: "desktop-v0.2.1",
      currentRefDesktopReleaseTag: "desktop-v0.2.1",
      desktopVersion: null,
      desktopTag: null,
      versionInjection: null,
    });
  });

  it("accepts manual recovery dispatches on protected release-candidate refs", () => {
    const plan = releasePlan.createDesktopReleasePlan({
      eventName: "workflow_dispatch",
      refName: "refs/heads/release-candidate",
      refOnProtectedBranch: true,
      changedFiles: [],
      releaseTags: ["desktop-v0.1.83", "desktop-v0.2.0-rc.1"],
      targetVersion: "0.2.0",
    });

    expect(plan).toMatchObject({
      releaseChannel: "candidate",
      releaseRequired: true,
      rejected: false,
      reason: "manual-recovery",
      desktopVersion: "0.2.0-rc.2",
      desktopTag: "desktop-v0.2.0-rc.2",
    });
  });

  it("rejects manual recovery dispatches for commits outside protected release branches", () => {
    const rejected = releasePlan.createDesktopReleasePlan({
      eventName: "workflow_dispatch",
      refName: "refs/heads/feature-branch",
      refOnProtectedBranch: true,
      changedFiles: ["desktop/main.cjs"],
      releaseTags: ["desktop-v0.2.0"],
      targetVersion: "0.2.0",
    });

    expect(rejected).toMatchObject({
      releaseRequired: false,
      rejected: true,
      reason: "manual-recovery-ref-not-on-protected-branch",
      desktopImpacting: true,
      desktopImpactingFiles: ["desktop/main.cjs"],
      desktopVersion: null,
      desktopTag: null,
      versionInjection: null,
    });
    expect(rejected.rejectionReason).toContain("release-candidate or master");
  });
});
