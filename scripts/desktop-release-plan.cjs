#!/usr/bin/env node
"use strict";

const FIRST_DESKTOP_VERSION = "0.1.0";
const PROTECTED_BRANCH = "master";
const VERSION_ENV_VAR = "AKSEL_ARCADE_DESKTOP_VERSION";
const DESKTOP_TAG_PATTERN = /^desktop-v(\d+)\.(\d+)\.(\d+)$/;

const EXACT_DESKTOP_IMPACTING_PATHS = new Set([
  "electron-builder.config.cjs",
  "index.html",
  "package-lock.json",
  "package.json",
  "vite.config.ts",
  "vite.desktop.config.ts",
  "docs/desktop-release.md",
  "docs/adr/0009-desktop-arcade-release-pipeline.md",
]);

const DESKTOP_IMPACTING_PREFIXES = [
  "build/desktop/",
  "desktop/",
  "public/",
  "src/",
];

const DESKTOP_SCRIPT_PATTERN =
  /^scripts\/(?:desktop[-\w]*|build-sandbox|generate-desktop-icons)\.(?:cjs|js|mjs|ts)$/;
const DESKTOP_WORKFLOW_PATTERN =
  /^\.github\/workflows\/.*(?:desktop|release).*\.(?:yml|yaml)$/;

function normalizePath(filePath) {
  if (typeof filePath !== "string") {
    return "";
  }

  return filePath.trim().replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function normalizeRefName(refName) {
  if (typeof refName !== "string" || refName.trim() === "") {
    return PROTECTED_BRANCH;
  }

  return refName.trim().replace(/^refs\/heads\//, "");
}

function isDesktopImpactingPath(filePath) {
  const path = normalizePath(filePath);

  if (path === "") {
    return false;
  }

  if (path.startsWith("tests/")) {
    return false;
  }

  if (path.startsWith(".github/workflows/")) {
    return DESKTOP_WORKFLOW_PATTERN.test(path);
  }

  if (path.startsWith("docs/") && !EXACT_DESKTOP_IMPACTING_PATHS.has(path)) {
    return false;
  }

  if (EXACT_DESKTOP_IMPACTING_PATHS.has(path)) {
    return true;
  }

  if (DESKTOP_SCRIPT_PATTERN.test(path)) {
    return true;
  }

  return DESKTOP_IMPACTING_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function getDesktopImpactingFiles(changedFiles) {
  if (!Array.isArray(changedFiles)) {
    return [];
  }

  return changedFiles
    .map((filePath) => normalizePath(filePath))
    .filter((filePath) => isDesktopImpactingPath(filePath));
}

function parseDesktopReleaseTag(tag) {
  if (typeof tag !== "string") {
    return null;
  }

  const match = DESKTOP_TAG_PATTERN.exec(tag.trim());

  if (!match) {
    return null;
  }

  const [, major, minor, patch] = match;

  return {
    tag: tag.trim(),
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
  };
}

function compareDesktopReleaseTags(left, right) {
  return (
    left.major - right.major ||
    left.minor - right.minor ||
    left.patch - right.patch
  );
}

function findLatestDesktopReleaseTag(tags) {
  if (!Array.isArray(tags)) {
    return null;
  }

  return tags
    .map((tag) => parseDesktopReleaseTag(tag))
    .filter((tag) => tag !== null)
    .sort(compareDesktopReleaseTags)
    .at(-1) ?? null;
}

function computeNextDesktopVersion(tags) {
  const latestTag = findLatestDesktopReleaseTag(tags);

  if (!latestTag) {
    return FIRST_DESKTOP_VERSION;
  }

  return `${latestTag.major}.${latestTag.minor}.${latestTag.patch + 1}`;
}

function createVersionInjection(version) {
  return {
    environment: {
      [VERSION_ENV_VAR]: version,
    },
    commitPackageVersion: false,
  };
}

function validateManualRecoveryDispatch({
  eventName = "push",
  refOnProtectedMaster = false,
  protectedBranch = PROTECTED_BRANCH,
} = {}) {
  if (eventName !== "workflow_dispatch") {
    return {
      accepted: true,
      manualRecovery: false,
      rejectionReason: null,
    };
  }

  if (refOnProtectedMaster !== true) {
    return {
      accepted: false,
      manualRecovery: true,
      rejectionReason: `Manual Desktop release recovery requires a commit that is already on protected ${protectedBranch}.`,
    };
  }

  return {
    accepted: true,
    manualRecovery: true,
    rejectionReason: null,
  };
}

function createDesktopReleasePlan({
  changedFiles = [],
  eventName = "push",
  refName = PROTECTED_BRANCH,
  refOnProtectedMaster = false,
  protectedBranch = PROTECTED_BRANCH,
  releaseTags = [],
  currentRefReleaseTags = [],
} = {}) {
  const normalizedRefName = normalizeRefName(refName);
  const desktopImpactingFiles = getDesktopImpactingFiles(changedFiles);
  const manualRecovery = validateManualRecoveryDispatch({
    eventName,
    refOnProtectedMaster,
    protectedBranch,
  });

  if (!manualRecovery.accepted) {
    return {
      eventName,
      protectedBranch,
      refName: normalizedRefName,
      releaseRequired: false,
      rejected: true,
      rejectionReason: manualRecovery.rejectionReason,
      reason: "manual-recovery-ref-not-on-protected-master",
      desktopImpacting: desktopImpactingFiles.length > 0,
      desktopImpactingFiles,
      latestDesktopReleaseTag: null,
      currentRefDesktopReleaseTag: null,
      nextDesktopVersion: null,
      versionInjection: null,
    };
  }

  if (eventName === "push" && normalizedRefName !== protectedBranch) {
    return {
      eventName,
      protectedBranch,
      refName: normalizedRefName,
      releaseRequired: false,
      rejected: false,
      rejectionReason: null,
      reason: "not-protected-master",
      desktopImpacting: desktopImpactingFiles.length > 0,
      desktopImpactingFiles,
      latestDesktopReleaseTag: null,
      currentRefDesktopReleaseTag: null,
      nextDesktopVersion: null,
      versionInjection: null,
    };
  }

  const latestDesktopReleaseTag = findLatestDesktopReleaseTag(releaseTags);
  const currentRefDesktopReleaseTag =
    findLatestDesktopReleaseTag(currentRefReleaseTags);
  if (currentRefDesktopReleaseTag) {
    return {
      eventName,
      protectedBranch,
      refName: normalizedRefName,
      releaseRequired: false,
      rejected: false,
      rejectionReason: null,
      reason: "current-ref-already-released",
      desktopImpacting: desktopImpactingFiles.length > 0,
      desktopImpactingFiles,
      latestDesktopReleaseTag: latestDesktopReleaseTag?.tag ?? null,
      currentRefDesktopReleaseTag: currentRefDesktopReleaseTag.tag,
      nextDesktopVersion: null,
      versionInjection: null,
    };
  }

  const releaseRequired =
    manualRecovery.manualRecovery || desktopImpactingFiles.length > 0;
  const nextDesktopVersion = releaseRequired
    ? computeNextDesktopVersion(releaseTags)
    : null;

  return {
    eventName,
    protectedBranch,
    refName: normalizedRefName,
    releaseRequired,
    rejected: false,
    rejectionReason: null,
    reason: releaseRequired
      ? manualRecovery.manualRecovery
        ? "manual-recovery"
        : "desktop-impacting-change"
      : "no-desktop-impacting-change",
    desktopImpacting: desktopImpactingFiles.length > 0,
    desktopImpactingFiles,
    latestDesktopReleaseTag: latestDesktopReleaseTag?.tag ?? null,
    currentRefDesktopReleaseTag: null,
    nextDesktopVersion,
    versionInjection: nextDesktopVersion
      ? createVersionInjection(nextDesktopVersion)
      : null,
  };
}

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

function parseBoolean(value) {
  return /^(1|true|yes)$/i.test(String(value ?? ""));
}

function createDesktopReleasePlanFromEnv(env = process.env) {
  return createDesktopReleasePlan({
    changedFiles: splitList(env.DESKTOP_RELEASE_CHANGED_FILES),
    eventName: env.GITHUB_EVENT_NAME ?? "push",
    refName: env.GITHUB_REF_NAME ?? env.GITHUB_REF ?? PROTECTED_BRANCH,
    refOnProtectedMaster: parseBoolean(
      env.DESKTOP_RELEASE_REF_ON_PROTECTED_MASTER,
    ),
    protectedBranch: env.DESKTOP_RELEASE_PROTECTED_BRANCH ?? PROTECTED_BRANCH,
    releaseTags: splitList(env.DESKTOP_RELEASE_TAGS),
    currentRefReleaseTags: splitList(env.DESKTOP_RELEASE_CURRENT_REF_TAGS),
  });
}

if (require.main === module) {
  const plan = createDesktopReleasePlanFromEnv();

  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);

  if (plan.rejected) {
    process.exitCode = 1;
  }
}

module.exports = {
  FIRST_DESKTOP_VERSION,
  PROTECTED_BRANCH,
  VERSION_ENV_VAR,
  computeNextDesktopVersion,
  createDesktopReleasePlan,
  createDesktopReleasePlanFromEnv,
  createVersionInjection,
  findLatestDesktopReleaseTag,
  getDesktopImpactingFiles,
  isDesktopImpactingPath,
  parseDesktopReleaseTag,
  validateManualRecoveryDispatch,
};
