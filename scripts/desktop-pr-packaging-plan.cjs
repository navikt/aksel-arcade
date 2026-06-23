#!/usr/bin/env node
"use strict";

const { appendFileSync, readFileSync } = require("node:fs");
const {
  VERSION_ENV_VAR,
  createVersionInjection,
  getDesktopImpactingFiles,
  parseTargetVersion,
  readReleaseCandidateState,
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
      artifact.replace("${version}", desktopVersion),
    ),
  };
}

function createDesktopPrPackagingPlan({
  changedFiles = [],
  targetVersion,
} = {}) {
  const desktopImpactingFiles = getDesktopImpactingFiles(changedFiles);
  const packageRequired = desktopImpactingFiles.length > 0;
  const desktopVersion = parseTargetVersion(targetVersion).version;

  return {
    packageRequired,
    desktopImpactingFiles,
    desktopVersion,
    versionEnvironment: createVersionInjection(desktopVersion).environment,
    platforms: packageRequired
      ? UNSIGNED_PACKAGE_PLATFORMS.map((platform) =>
          createPlatformPlan(platform, desktopVersion),
        )
      : [],
    releasePlanReason: packageRequired
      ? "desktop-impacting-change"
      : "no-desktop-impacting-change",
  };
}

function createDesktopPrPackagingPlanFromEnv(env = process.env) {
  const { targetVersion } = readReleaseCandidateState(
    env.DESKTOP_RELEASE_STATE_FILE,
  );

  return createDesktopPrPackagingPlan({
    changedFiles: readChangedFilesFromEnv(env),
    targetVersion,
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
