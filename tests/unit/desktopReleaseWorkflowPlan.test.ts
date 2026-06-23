import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

interface DesktopReleaseWorkflowPlan {
  releaseChannel: "candidate" | "stable" | null;
  prerelease: boolean;
  releaseRequired: boolean;
  rejected: boolean;
  rejectionReason: string | null;
  reason: string;
  targetVersion: string;
  desktopVersion: string | null;
  desktopTag: string | null;
  desktopImpactingFiles: string[];
  latestPublicDesktopReleaseTag: string | null;
  currentRefDesktopReleaseTag: string | null;
}

interface DesktopReleaseWorkflowPlanModule {
  createWorkflowPlan(env?: NodeJS.ProcessEnv): DesktopReleaseWorkflowPlan;
  writeWorkflowOutputs(
    plan: DesktopReleaseWorkflowPlan,
    outputFile?: string,
  ): void;
}

const require = createRequire(import.meta.url);
const workflowPlan = require(
  "../../scripts/desktop-release-workflow-plan.cjs",
) as DesktopReleaseWorkflowPlanModule;

function createTempFile(content: string): string {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "desktop-release-plan-"),
  );
  const filePath = path.join(directory, "input.txt");

  fs.writeFileSync(filePath, content);
  return filePath;
}

describe("Desktop release workflow plan wrapper", () => {
  it("reads CI file inputs and exposes GitHub Actions outputs for release-candidate pre-releases", () => {
    const changedFilesFile = createTempFile("desktop/main.cjs\nREADME.md\n");
    const releaseTagsFile = createTempFile(
      "desktop-v0.1.83\ndesktop-v0.2.0-rc.1\n",
    );
    const currentRefTagsFile = createTempFile("");
    const stateFile = createTempFile('{"targetVersion":"0.2.0"}\n');
    const outputFile = createTempFile("");

    const plan = workflowPlan.createWorkflowPlan({
      GITHUB_EVENT_NAME: "push",
      GITHUB_REF_NAME: "release-candidate",
      DESKTOP_RELEASE_CHANGED_FILES_FILE: changedFilesFile,
      DESKTOP_RELEASE_TAGS_FILE: releaseTagsFile,
      DESKTOP_RELEASE_CURRENT_REF_TAGS_FILE: currentRefTagsFile,
      DESKTOP_RELEASE_STATE_FILE: stateFile,
      DESKTOP_RELEASE_CANDIDATE_BRANCH: "release-candidate",
      DESKTOP_RELEASE_STABLE_BRANCH: "master",
    });

    expect(plan).toMatchObject({
      releaseChannel: "candidate",
      prerelease: true,
      releaseRequired: true,
      rejected: false,
      reason: "desktop-impacting-change",
      targetVersion: "0.2.0",
      desktopVersion: "0.2.0-rc.2",
      desktopTag: "desktop-v0.2.0-rc.2",
      desktopImpactingFiles: ["desktop/main.cjs"],
    });

    workflowPlan.writeWorkflowOutputs(plan, outputFile);
    const output = fs.readFileSync(outputFile, "utf8");

    expect(output).toContain("release-channel=candidate");
    expect(output).toContain("prerelease=true");
    expect(output).toContain("target-version=0.2.0");
    expect(output).toContain("desktop-tag=desktop-v0.2.0-rc.2");
  });

  it("resolves hotfix versions for stable master pushes", () => {
    const stateFile = createTempFile('{"targetVersion":"0.2.0"}\n');

    const plan = workflowPlan.createWorkflowPlan({
      GITHUB_EVENT_NAME: "push",
      GITHUB_REF_NAME: "master",
      DESKTOP_RELEASE_CHANGED_FILES: "desktop/main.cjs",
      DESKTOP_RELEASE_TAGS: "desktop-v0.2.0,desktop-v0.2.0-rc.2",
      DESKTOP_RELEASE_STATE_FILE: stateFile,
      DESKTOP_RELEASE_CANDIDATE_BRANCH: "release-candidate",
      DESKTOP_RELEASE_STABLE_BRANCH: "master",
    });

    expect(plan).toMatchObject({
      releaseChannel: "stable",
      prerelease: false,
      releaseRequired: true,
      rejected: false,
      reason: "hotfix",
      targetVersion: "0.2.0",
      desktopVersion: "0.2.1",
      desktopTag: "desktop-v0.2.1",
    });
  });

  it("passes through protected recovery dispatch validation", () => {
    const stateFile = createTempFile('{"targetVersion":"0.2.0"}\n');

    const plan = workflowPlan.createWorkflowPlan({
      GITHUB_EVENT_NAME: "workflow_dispatch",
      GITHUB_REF_NAME: "master",
      DESKTOP_RELEASE_REF_ON_PROTECTED_BRANCH: "true",
      DESKTOP_RELEASE_CHANGED_FILES: "",
      DESKTOP_RELEASE_TAGS: "desktop-v0.1.83",
      DESKTOP_RELEASE_STATE_FILE: stateFile,
      DESKTOP_RELEASE_CANDIDATE_BRANCH: "release-candidate",
      DESKTOP_RELEASE_STABLE_BRANCH: "master",
    });

    expect(plan).toMatchObject({
      releaseChannel: "stable",
      releaseRequired: true,
      rejected: false,
      reason: "manual-recovery",
      targetVersion: "0.2.0",
      desktopVersion: "0.2.0",
      desktopTag: "desktop-v0.2.0",
    });
  });
});
