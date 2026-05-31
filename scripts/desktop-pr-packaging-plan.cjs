#!/usr/bin/env node
"use strict";

const { appendFileSync, readFileSync } = require("node:fs");
const {
  FIRST_DESKTOP_VERSION,
  VERSION_ENV_VAR,
  createDesktopReleasePlan,
} = require("./desktop-release-plan.cjs");

const UNSIGNED_PACKAGE_PLATFORMS = Object.freeze([
  Object.freeze({
    id: "mac",
    runner: "macos-latest",
    command: "npm run desktop:package:mac",
    expectedArtifacts: Object.freeze([
      "release/desktop/Aksel-Arcade-${version}-mac-arm64.dmg",
      "release/desktop/Aksel-Arcade-${version}-mac-x64.dmg",
    ]),
  }),
  Object.freeze({
    id: "windows",
    runner: "windows-latest",
    command: "npm run desktop:package:win",
    expectedArtifacts: Object.freeze([
      "release/desktop/Aksel-Arcade-${version}-windows-x64.exe",
    ]),
  }),
]);

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

function readChangedFilesFromEnv(env = process.env) {
  if (typeof env.DESKTOP_RELEASE_CHANGED_FILES_FILE === "string") {
    return splitList(readFileSync(env.DESKTOP_RELEASE_CHANGED_FILES_FILE, "utf8"));
  }

  return splitList(env.DESKTOP_RELEASE_CHANGED_FILES);
}

function createPlatformPlan(platform, desktopVersion) {
  return {
    id: platform.id,
    runner: platform.runner,
    command: platform.command,
    expectedArtifacts: platform.expectedArtifacts.map((artifact) =>
      artifact.replace("${version}", desktopVersion)
    ),
  };
}

function createDesktopPrPackagingPlan({
  changedFiles = [],
  eventName = "pull_request",
  refName = "master",
  releaseTags = [],
} = {}) {
  const releasePlan = createDesktopReleasePlan({
    changedFiles,
    eventName,
    refName,
    releaseTags,
  });
  const packageRequired = releasePlan.desktopImpacting;
  const desktopVersion = releasePlan.nextDesktopVersion ?? FIRST_DESKTOP_VERSION;

  return {
    packageRequired,
    desktopImpactingFiles: releasePlan.desktopImpactingFiles,
    desktopVersion,
    versionEnvironment: {
      [VERSION_ENV_VAR]: desktopVersion,
    },
    platforms: packageRequired
      ? UNSIGNED_PACKAGE_PLATFORMS.map((platform) =>
          createPlatformPlan(platform, desktopVersion)
        )
      : [],
    releasePlanReason: releasePlan.reason,
  };
}

function createDesktopPrPackagingPlanFromEnv(env = process.env) {
  return createDesktopPrPackagingPlan({
    changedFiles: readChangedFilesFromEnv(env),
    eventName: env.GITHUB_EVENT_NAME ?? "pull_request",
    refName: env.GITHUB_BASE_REF ?? env.GITHUB_REF_NAME ?? "master",
    releaseTags: [],
  });
}

function formatGithubOutputs(plan) {
  return [
    `package-required=${plan.packageRequired}`,
    `desktop-version=${plan.desktopVersion}`,
    `desktop-impacting-count=${plan.desktopImpactingFiles.length}`,
    "",
  ].join("\n");
}

function writeGithubOutputs(outputPath, plan) {
  appendFileSync(outputPath, formatGithubOutputs(plan));
}

if (require.main === module) {
  const plan = createDesktopPrPackagingPlanFromEnv();

  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);

  if (process.env.GITHUB_OUTPUT) {
    writeGithubOutputs(process.env.GITHUB_OUTPUT, plan);
  }
}

module.exports = {
  UNSIGNED_PACKAGE_PLATFORMS,
  VERSION_ENV_VAR,
  createDesktopPrPackagingPlan,
  createDesktopPrPackagingPlanFromEnv,
  formatGithubOutputs,
  readChangedFilesFromEnv,
  splitList,
  writeGithubOutputs,
};
