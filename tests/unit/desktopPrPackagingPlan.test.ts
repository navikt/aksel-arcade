import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface DesktopPrPackagingPlanInput {
  changedFiles?: string[];
  eventName?: string;
  refName?: string;
  releaseTags?: string[];
}

interface DesktopPrPackagePlatform {
  id: string;
  runner: string;
  command: string;
  expectedArtifacts: string[];
}

interface DesktopPrPackagingPlan {
  packageRequired: boolean;
  desktopImpactingFiles: string[];
  desktopVersion: string;
  versionEnvironment: Record<string, string>;
  platforms: DesktopPrPackagePlatform[];
  releasePlanReason: string;
}

interface DesktopPrPackagingPlanModule {
  VERSION_ENV_VAR: string;
  createDesktopPrPackagingPlan(
    input?: DesktopPrPackagingPlanInput,
  ): DesktopPrPackagingPlan;
  formatGithubOutputs(plan: DesktopPrPackagingPlan): string;
}

const require = createRequire(import.meta.url);
const prPackaging = require(
  "../../scripts/desktop-pr-packaging-plan.cjs",
) as DesktopPrPackagingPlanModule;

describe("Desktop PR packaging plan", () => {
  it("requires unsigned packaging for Desktop-impacting PR changes", () => {
    const plan = prPackaging.createDesktopPrPackagingPlan({
      changedFiles: [
        "src/App.tsx",
        ".github/workflows/desktop-pr-packaging.yml",
      ],
      eventName: "pull_request",
    });

    expect(plan).toMatchObject({
      packageRequired: true,
      desktopImpactingFiles: [
        "src/App.tsx",
        ".github/workflows/desktop-pr-packaging.yml",
      ],
      desktopVersion: "0.1.0",
      releasePlanReason: "desktop-impacting-change",
    });
    expect(plan.versionEnvironment).toEqual({
      [prPackaging.VERSION_ENV_VAR]: "0.1.0",
    });
    expect(plan.platforms).toEqual([
      {
        id: "mac",
        runner: "macos-latest",
        command: "npm run desktop:package:mac",
        expectedArtifacts: [
          "release/desktop/Aksel-Arcade-0.1.0-mac-arm64.dmg",
          "release/desktop/Aksel-Arcade-0.1.0-mac-x64.dmg",
        ],
      },
      {
        id: "windows",
        runner: "windows-latest",
        command: "npm run desktop:package:win",
        expectedArtifacts: [
          "release/desktop/Aksel-Arcade-0.1.0-windows-x64.exe",
        ],
      },
    ]);
  });

  it("skips unsigned packaging for non-Desktop-impacting PR changes", () => {
    const plan = prPackaging.createDesktopPrPackagingPlan({
      changedFiles: [
        "README.md",
        "docs/prd/desktop-download-ui.md",
        ".github/workflows/deploy.yml",
        "tests/unit/desktopPrPackagingPlan.test.ts",
      ],
      eventName: "pull_request",
    });

    expect(plan).toMatchObject({
      packageRequired: false,
      desktopImpactingFiles: [],
      desktopVersion: "0.1.0",
      platforms: [],
      releasePlanReason: "no-desktop-impacting-change",
    });
  });

  it("requires unsigned packaging when a renamed file previously had Desktop impact", () => {
    const plan = prPackaging.createDesktopPrPackagingPlan({
      changedFiles: ["archive/main.cjs", "desktop/main.cjs"],
      eventName: "pull_request",
    });

    expect(plan).toMatchObject({
      packageRequired: true,
      desktopImpactingFiles: ["desktop/main.cjs"],
      releasePlanReason: "desktop-impacting-change",
    });
  });

  it("writes only scalar GitHub step outputs", () => {
    const plan = prPackaging.createDesktopPrPackagingPlan({
      changedFiles: ["desktop/main.cjs"],
      eventName: "pull_request",
    });

    expect(prPackaging.formatGithubOutputs(plan)).toBe(
      "package-required=true\n" +
        "desktop-version=0.1.0\n" +
        "desktop-impacting-count=1\n",
    );
  });
});

describe("Desktop PR packaging workflow", () => {
  const workflow = readFileSync(
    resolve(process.cwd(), ".github/workflows/desktop-pr-packaging.yml"),
    "utf8",
  );

  it("runs only for pull requests with read-only repository permissions", () => {
    expect(workflow).toContain("pull_request:");
    expect(workflow).not.toContain("pull_request_target");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("pull-requests: read");
  });

  it("collects both new and previous filenames for renamed files", () => {
    expect(workflow).toContain(".previous_filename // empty");
  });

  it("runs unsigned packaging conditionally for the macOS and Windows targets", () => {
    expect(workflow).toContain(
      "if: needs.plan.outputs.package-required == 'true'",
    );
    expect(workflow).toContain("npm run desktop:pr-package-plan");
    expect(workflow).toContain("npm run desktop:package:mac");
    expect(workflow).toContain("npm run desktop:package:win");
    expect(workflow).toContain(
      "release/desktop/Aksel-Arcade-${AKSEL_ARCADE_DESKTOP_VERSION}-mac-arm64.dmg",
    );
    expect(workflow).toContain(
      "release/desktop/Aksel-Arcade-${AKSEL_ARCADE_DESKTOP_VERSION}-windows-x64.exe",
    );
  });

  it("does not publish installers or request Desktop release credentials", () => {
    expect(workflow).not.toContain("environment:");
    expect(workflow).not.toContain("desktop-release");
    expect(workflow).not.toContain("actions/upload-artifact");
    expect(workflow).not.toContain("actions/upload-release-asset");
    expect(workflow).not.toContain("softprops/action-gh-release");
    expect(workflow).not.toContain("gh release");
    expect(workflow).toContain("CSC_IDENTITY_AUTO_DISCOVERY: 'false'");
    expect(workflow).toContain("MAC_CERTIFICATE_P12_BASE64: ''");
    expect(workflow).not.toMatch(/MAC_CERTIFICATE_P12_BASE64:\s*\$\{\{/);
  });
});
