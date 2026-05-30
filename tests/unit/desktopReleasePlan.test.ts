import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

interface DesktopReleasePlanInput {
  changedFiles?: string[];
  eventName?: string;
  refName?: string;
  refOnProtectedMaster?: boolean;
  protectedBranch?: string;
  releaseTags?: string[];
}

interface VersionInjection {
  environment: Record<string, string>;
  commitPackageVersion: boolean;
}

interface DesktopReleasePlan {
  releaseRequired: boolean;
  rejected: boolean;
  rejectionReason: string | null;
  reason: string;
  desktopImpacting: boolean;
  desktopImpactingFiles: string[];
  latestDesktopReleaseTag: string | null;
  nextDesktopVersion: string | null;
  versionInjection: VersionInjection | null;
}

interface ParsedDesktopReleaseTag {
  tag: string;
  major: number;
  minor: number;
  patch: number;
}

interface DesktopReleasePlanModule {
  VERSION_ENV_VAR: string;
  computeNextDesktopVersion(tags: string[]): string;
  createDesktopReleasePlan(
    input?: DesktopReleasePlanInput,
  ): DesktopReleasePlan;
  findLatestDesktopReleaseTag(
    tags: string[],
  ): ParsedDesktopReleaseTag | null;
  isDesktopImpactingPath(filePath: string): boolean;
}

const require = createRequire(import.meta.url);
const releasePlan = require(
  "../../scripts/desktop-release-plan.cjs",
) as DesktopReleasePlanModule;

const createPushPlan = (
  overrides: DesktopReleasePlanInput = {},
): DesktopReleasePlan =>
  releasePlan.createDesktopReleasePlan({
    eventName: "push",
    refName: "master",
    changedFiles: [],
    releaseTags: [],
    ...overrides,
  });

describe("Desktop release planning", () => {
  it("does not require a release for unrelated docs, tests, or web-only deployment changes", () => {
    const plan = createPushPlan({
      changedFiles: [
        "README.md",
        "docs/prd/share-url.md",
        ".github/workflows/deploy.yml",
        "tests/unit/desktopReleasePlan.test.ts",
        "vite.config.ts",
      ],
    });

    expect(plan).toMatchObject({
      releaseRequired: false,
      rejected: false,
      reason: "no-desktop-impacting-change",
      desktopImpacting: false,
      desktopImpactingFiles: [],
      nextDesktopVersion: null,
      versionInjection: null,
    });
  });

  it("requires a release for Desktop shell and release automation changes", () => {
    const plan = createPushPlan({
      changedFiles: [
        "desktop/main.cjs",
        ".github/workflows/desktop-release.yml",
        "scripts/desktop-builder-config.cjs",
      ],
      releaseTags: ["desktop-v0.1.0"],
    });

    expect(plan).toMatchObject({
      releaseRequired: true,
      reason: "desktop-impacting-change",
      desktopImpacting: true,
      desktopImpactingFiles: [
        "desktop/main.cjs",
        ".github/workflows/desktop-release.yml",
        "scripts/desktop-builder-config.cjs",
      ],
      latestDesktopReleaseTag: "desktop-v0.1.0",
      nextDesktopVersion: "0.1.1",
    });
    expect(plan.versionInjection).toEqual({
      environment: {
        [releasePlan.VERSION_ENV_VAR]: "0.1.1",
      },
      commitPackageVersion: false,
    });
  });

  it("starts Desktop releases at 0.1.0 when no valid Desktop tag exists", () => {
    const plan = createPushPlan({
      changedFiles: ["electron-builder.config.cjs"],
      releaseTags: ["v1.0.0", "desktop-vnext"],
    });

    expect(plan).toMatchObject({
      releaseRequired: true,
      latestDesktopReleaseTag: null,
      nextDesktopVersion: "0.1.0",
    });
  });

  it("patch-bumps the highest valid Desktop release tag and ignores malformed or unrelated tags", () => {
    const tags = [
      "desktop-v0.1.8",
      "desktop-v0.1",
      "v5.0.0",
      "desktop-v0.2.4",
      "desktop-v0.2.4-beta.1",
      "desktop-release-0.3.0",
    ];

    expect(releasePlan.findLatestDesktopReleaseTag(tags)).toMatchObject({
      tag: "desktop-v0.2.4",
      major: 0,
      minor: 2,
      patch: 4,
    });
    expect(releasePlan.computeNextDesktopVersion(tags)).toBe("0.2.5");
  });

  it("treats shared renderer behavior as Desktop-impacting", () => {
    const plan = createPushPlan({
      changedFiles: ["src/App.tsx"],
      releaseTags: ["desktop-v0.2.5"],
    });

    expect(plan).toMatchObject({
      releaseRequired: true,
      desktopImpacting: true,
      desktopImpactingFiles: ["src/App.tsx"],
      nextDesktopVersion: "0.2.6",
    });
  });

  it("accepts manual recovery dispatches only for refs already on protected master", () => {
    const accepted = releasePlan.createDesktopReleasePlan({
      eventName: "workflow_dispatch",
      refName: "refs/heads/release-retry",
      refOnProtectedMaster: true,
      changedFiles: [],
      releaseTags: ["desktop-v0.2.6"],
    });

    expect(accepted).toMatchObject({
      releaseRequired: true,
      rejected: false,
      reason: "manual-recovery",
      nextDesktopVersion: "0.2.7",
    });
  });

  it("rejects manual recovery dispatches for refs outside protected master", () => {
    const rejected = releasePlan.createDesktopReleasePlan({
      eventName: "workflow_dispatch",
      refName: "refs/heads/feature-branch",
      refOnProtectedMaster: false,
      changedFiles: ["desktop/main.cjs"],
      releaseTags: ["desktop-v0.2.6"],
    });

    expect(rejected).toMatchObject({
      releaseRequired: false,
      rejected: true,
      reason: "manual-recovery-ref-not-on-protected-master",
      desktopImpacting: true,
      desktopImpactingFiles: ["desktop/main.cjs"],
      nextDesktopVersion: null,
      versionInjection: null,
    });
    expect(rejected.rejectionReason).toContain("protected master");
  });
});
