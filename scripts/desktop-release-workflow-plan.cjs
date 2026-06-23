#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const {
  VERSION_ENV_VAR,
  createDesktopReleasePlan,
  readReleaseCandidateState,
} = require("./desktop-release-plan.cjs");

function splitList(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  return value
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readListFile(filePath) {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    return [];
  }

  return splitList(fs.readFileSync(filePath, "utf8"));
}

function readListInput(env, fileEnvName, valueEnvName) {
  const fileValue = env[fileEnvName];

  if (typeof fileValue === "string" && fileValue.trim() !== "") {
    return readListFile(fileValue);
  }

  return splitList(env[valueEnvName]);
}

function parseBoolean(value) {
  return /^(1|true|yes)$/i.test(String(value ?? ""));
}

function createWorkflowPlan(env = process.env) {
  const { targetVersion } = readReleaseCandidateState(
    env.DESKTOP_RELEASE_STATE_FILE,
  );
  const plan = createDesktopReleasePlan({
    changedFiles: readListInput(
      env,
      "DESKTOP_RELEASE_CHANGED_FILES_FILE",
      "DESKTOP_RELEASE_CHANGED_FILES",
    ),
    eventName: env.GITHUB_EVENT_NAME ?? "push",
    refName: env.GITHUB_REF_NAME ?? env.GITHUB_REF,
    refOnProtectedBranch: parseBoolean(
      env.DESKTOP_RELEASE_REF_ON_PROTECTED_BRANCH,
    ),
    stableBranch: env.DESKTOP_RELEASE_STABLE_BRANCH,
    releaseCandidateBranch: env.DESKTOP_RELEASE_CANDIDATE_BRANCH,
    releaseTags: readListInput(
      env,
      "DESKTOP_RELEASE_TAGS_FILE",
      "DESKTOP_RELEASE_TAGS",
    ),
    currentRefReleaseTags: readListInput(
      env,
      "DESKTOP_RELEASE_CURRENT_REF_TAGS_FILE",
      "DESKTOP_RELEASE_CURRENT_REF_TAGS",
    ),
    targetVersion,
  });

  return plan;
}

function appendGithubOutput(outputs, outputFile = process.env.GITHUB_OUTPUT) {
  if (typeof outputFile !== "string" || outputFile.trim() === "") {
    return;
  }

  const lines = Object.entries(outputs).map(
    ([key, value]) => `${key}=${String(value ?? "")}`,
  );

  fs.appendFileSync(outputFile, `${lines.join("\n")}\n`);
}

function writeWorkflowOutputs(plan, outputFile = process.env.GITHUB_OUTPUT) {
  appendGithubOutput(
    {
      rejected: plan.rejected,
      "rejection-reason": plan.rejectionReason ?? "",
      "release-required": plan.releaseRequired,
      reason: plan.reason,
      "release-channel": plan.releaseChannel ?? "",
      prerelease: plan.prerelease,
      "target-version": plan.targetVersion ?? "",
      "desktop-version": plan.desktopVersion ?? "",
      "desktop-tag": plan.desktopTag ?? "",
      "desktop-impacting-count": plan.desktopImpactingFiles.length,
      "latest-public-desktop-release-tag":
        plan.latestPublicDesktopReleaseTag ?? "",
      "latest-release-candidate-tag": plan.latestReleaseCandidateTag ?? "",
      "current-ref-desktop-release-tag":
        plan.currentRefDesktopReleaseTag ?? "",
      "version-env-var": VERSION_ENV_VAR,
    },
    outputFile,
  );
}

if (require.main === module) {
  const plan = createWorkflowPlan();

  writeWorkflowOutputs(plan);
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);

  if (plan.rejected) {
    process.exitCode = 1;
  }
}

module.exports = {
  createWorkflowPlan,
  readListFile,
  readListInput,
  splitList,
  writeWorkflowOutputs,
};
