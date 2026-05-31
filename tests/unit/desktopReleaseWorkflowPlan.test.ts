import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

interface DesktopReleaseWorkflowPlan {
  releaseRequired: boolean;
  rejected: boolean;
  rejectionReason: string | null;
  reason: string;
  nextDesktopVersion: string | null;
  desktopTag: string;
  desktopImpactingFiles: string[];
  latestDesktopReleaseTag: string | null;
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
  it("reads CI file inputs and exposes GitHub Actions outputs", () => {
    const changedFilesFile = createTempFile("desktop/main.cjs\nREADME.md\n");
    const releaseTagsFile = createTempFile("desktop-v0.1.0\nv9.9.9\n");
    const currentRefTagsFile = createTempFile("");
    const outputFile = createTempFile("");

    const plan = workflowPlan.createWorkflowPlan({
      GITHUB_EVENT_NAME: "push",
      GITHUB_REF_NAME: "master",
      DESKTOP_RELEASE_CHANGED_FILES_FILE: changedFilesFile,
      DESKTOP_RELEASE_TAGS_FILE: releaseTagsFile,
      DESKTOP_RELEASE_CURRENT_REF_TAGS_FILE: currentRefTagsFile,
    });

    expect(plan).toMatchObject({
      releaseRequired: true,
      rejected: false,
      reason: "desktop-impacting-change",
      nextDesktopVersion: "0.1.1",
      desktopTag: "desktop-v0.1.1",
      desktopImpactingFiles: ["desktop/main.cjs"],
    });

    workflowPlan.writeWorkflowOutputs(plan, outputFile);

    expect(fs.readFileSync(outputFile, "utf8")).toContain(
      "release-required=true",
    );
    expect(fs.readFileSync(outputFile, "utf8")).toContain(
      "desktop-tag=desktop-v0.1.1",
    );
  });

  it("passes through protected recovery dispatch validation", () => {
    const plan = workflowPlan.createWorkflowPlan({
      GITHUB_EVENT_NAME: "workflow_dispatch",
      GITHUB_REF_NAME: "master",
      DESKTOP_RELEASE_REF_ON_PROTECTED_MASTER: "true",
      DESKTOP_RELEASE_CHANGED_FILES: "",
      DESKTOP_RELEASE_TAGS: "desktop-v0.1.1",
    });

    expect(plan).toMatchObject({
      releaseRequired: true,
      rejected: false,
      reason: "manual-recovery",
      nextDesktopVersion: "0.1.2",
      desktopTag: "desktop-v0.1.2",
    });
  });
});
