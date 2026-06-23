#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const FIRST_DESKTOP_VERSION = "0.1.0";
const STABLE_BRANCH = "master";
const RELEASE_CANDIDATE_BRANCH = "release-candidate";
const DEFAULT_RELEASE_CANDIDATE_STATE_FILE = ".github/release-candidate.json";
const VERSION_ENV_VAR = "AKSEL_ARCADE_DESKTOP_VERSION";
const TARGET_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const PUBLIC_DESKTOP_TAG_PATTERN = /^desktop-v(\d+)\.(\d+)\.(\d+)$/;
const RC_DESKTOP_TAG_PATTERN = /^desktop-v(\d+)\.(\d+)\.(\d+)-rc\.(\d+)$/;

const EXACT_DESKTOP_IMPACTING_PATHS = new Set([
  ".github/release-candidate.json",
  "electron-builder.config.cjs",
  "index.html",
  "package-lock.json",
  "package.json",
  "vite.config.ts",
  "vite.desktop.config.ts",
  "docs/desktop-release.md",
  "docs/adr/0009-desktop-arcade-release-pipeline.md",
  "docs/adr/0019-two-line-desktop-release-flow.md",
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
    return STABLE_BRANCH;
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

function parseTargetVersion(version, label = "Desktop release targetVersion") {
  if (typeof version !== "string" || !TARGET_VERSION_PATTERN.test(version.trim())) {
    throw new Error(`${label} must be a plain SemVer version like 0.2.0.`);
  }

  const [major, minor, patch] = version.trim().split(".").map(Number);

  return {
    version: `${major}.${minor}.${patch}`,
    major,
    minor,
    patch,
  };
}

function compareVersions(left, right) {
  return (
    left.major - right.major ||
    left.minor - right.minor ||
    left.patch - right.patch
  );
}

function formatVersion(version) {
  return `${version.major}.${version.minor}.${version.patch}`;
}

function incrementPatchVersion(version) {
  const parsedVersion = parseTargetVersion(version);

  return formatVersion({
    major: parsedVersion.major,
    minor: parsedVersion.minor,
    patch: parsedVersion.patch + 1,
  });
}

function parsePublicDesktopReleaseTag(tag) {
  if (typeof tag !== "string") {
    return null;
  }

  const match = PUBLIC_DESKTOP_TAG_PATTERN.exec(tag.trim());

  if (!match) {
    return null;
  }

  const [, major, minor, patch] = match;

  return {
    tag: tag.trim(),
    version: `${major}.${minor}.${patch}`,
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
  };
}

function parseDesktopReleaseCandidateTag(tag) {
  if (typeof tag !== "string") {
    return null;
  }

  const match = RC_DESKTOP_TAG_PATTERN.exec(tag.trim());

  if (!match) {
    return null;
  }

  const [, major, minor, patch, rcNumber] = match;

  return {
    tag: tag.trim(),
    targetVersion: `${major}.${minor}.${patch}`,
    version: `${major}.${minor}.${patch}-rc.${rcNumber}`,
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    rcNumber: Number(rcNumber),
  };
}

function compareDesktopReleaseCandidateTags(left, right) {
  return (
    compareVersions(left, right) || left.rcNumber - right.rcNumber
  );
}

function findLatestDesktopReleaseTag(tags) {
  if (!Array.isArray(tags)) {
    return null;
  }

  return tags
    .map((tag) => parsePublicDesktopReleaseTag(tag))
    .filter((tag) => tag !== null)
    .sort(compareVersions)
    .at(-1) ?? null;
}

function findLatestReleaseCandidateTag(tags, targetVersion) {
  if (!Array.isArray(tags)) {
    return null;
  }

  const normalizedTargetVersion = parseTargetVersion(targetVersion).version;

  return tags
    .map((tag) => parseDesktopReleaseCandidateTag(tag))
    .filter(
      (tag) => tag !== null && tag.targetVersion === normalizedTargetVersion,
    )
    .sort(compareDesktopReleaseCandidateTags)
    .at(-1) ?? null;
}

function computeNextDesktopVersion(tags) {
  const latestPublicReleaseTag = findLatestDesktopReleaseTag(tags);

  if (!latestPublicReleaseTag) {
    return FIRST_DESKTOP_VERSION;
  }

  return incrementPatchVersion(latestPublicReleaseTag.version);
}

function createVersionInjection(version) {
  return {
    environment: {
      [VERSION_ENV_VAR]: version,
    },
    commitPackageVersion: false,
  };
}

function parseReleaseCandidateState(rawState) {
  let parsedState;

  try {
    parsedState = JSON.parse(rawState);
  } catch (error) {
    throw new Error(
      `Desktop release candidate state must be valid JSON: ${error.message}`,
    );
  }

  if (!parsedState || typeof parsedState !== "object") {
    throw new Error("Desktop release candidate state must be a JSON object.");
  }

  const targetVersion = parseTargetVersion(
    parsedState.targetVersion,
    "Desktop release candidate targetVersion",
  ).version;

  return {
    targetVersion,
  };
}

function readReleaseCandidateState(
  filePath = DEFAULT_RELEASE_CANDIDATE_STATE_FILE,
) {
  return parseReleaseCandidateState(fs.readFileSync(filePath, "utf8"));
}

function validateManualRecoveryDispatch({
  eventName = "push",
  refName = STABLE_BRANCH,
  refOnProtectedBranch = false,
  stableBranch = STABLE_BRANCH,
  releaseCandidateBranch = RELEASE_CANDIDATE_BRANCH,
} = {}) {
  if (eventName !== "workflow_dispatch") {
    return {
      accepted: true,
      manualRecovery: false,
      rejectionReason: null,
    };
  }

  const normalizedRefName = normalizeRefName(refName);
  const allowedBranches = new Set([stableBranch, releaseCandidateBranch]);

  if (!allowedBranches.has(normalizedRefName)) {
    return {
      accepted: false,
      manualRecovery: true,
      rejectionReason: `Manual Desktop release recovery must be dispatched from protected ${releaseCandidateBranch} or ${stableBranch}.`,
    };
  }

  if (refOnProtectedBranch !== true) {
    return {
      accepted: false,
      manualRecovery: true,
      rejectionReason: `Manual Desktop release recovery requires a commit that is already on protected ${normalizedRefName}.`,
    };
  }

  return {
    accepted: true,
    manualRecovery: true,
    rejectionReason: null,
  };
}

function resolveStableDesktopVersion({
  releaseTags = [],
  targetVersion,
} = {}) {
  const latestPublicReleaseTag = findLatestDesktopReleaseTag(releaseTags);
  const normalizedTargetVersion = parseTargetVersion(targetVersion).version;

  if (
    !latestPublicReleaseTag ||
    compareVersions(
      parseTargetVersion(normalizedTargetVersion),
      latestPublicReleaseTag,
    ) > 0
  ) {
    return normalizedTargetVersion;
  }

  return incrementPatchVersion(latestPublicReleaseTag.version);
}

function createNoReleasePlan({
  eventName,
  stableBranch,
  releaseCandidateBranch,
  refName,
  reason,
  releaseChannel,
  targetVersion,
  desktopImpactingFiles,
  latestPublicDesktopReleaseTag,
  latestReleaseCandidateTag,
  currentRefDesktopReleaseTag,
  rejected = false,
  rejectionReason = null,
} = {}) {
  return {
    eventName,
    stableBranch,
    releaseCandidateBranch,
    refName,
    releaseChannel,
    prerelease: releaseChannel === "candidate",
    targetVersion,
    releaseRequired: false,
    rejected,
    rejectionReason,
    reason,
    desktopImpacting: desktopImpactingFiles.length > 0,
    desktopImpactingFiles,
    latestPublicDesktopReleaseTag,
    latestReleaseCandidateTag,
    currentRefDesktopReleaseTag,
    desktopVersion: null,
    desktopTag: null,
    versionInjection: null,
  };
}

function createDesktopReleasePlan({
  changedFiles = [],
  eventName = "push",
  refName = STABLE_BRANCH,
  refOnProtectedBranch = false,
  stableBranch = STABLE_BRANCH,
  releaseCandidateBranch = RELEASE_CANDIDATE_BRANCH,
  releaseTags = [],
  currentRefReleaseTags = [],
  targetVersion,
} = {}) {
  const normalizedRefName = normalizeRefName(refName);
  const normalizedTargetVersion = parseTargetVersion(targetVersion).version;
  const desktopImpactingFiles = getDesktopImpactingFiles(changedFiles);
  const latestPublicDesktopReleaseTag = findLatestDesktopReleaseTag(releaseTags);
  const latestReleaseCandidateTag = findLatestReleaseCandidateTag(
    releaseTags,
    normalizedTargetVersion,
  );
  const manualRecovery = validateManualRecoveryDispatch({
    eventName,
    refName: normalizedRefName,
    refOnProtectedBranch,
    stableBranch,
    releaseCandidateBranch,
  });

  if (!manualRecovery.accepted) {
    return createNoReleasePlan({
      eventName,
      stableBranch,
      releaseCandidateBranch,
      refName: normalizedRefName,
      reason: "manual-recovery-ref-not-on-protected-branch",
      releaseChannel: null,
      targetVersion: normalizedTargetVersion,
      desktopImpactingFiles,
      latestPublicDesktopReleaseTag: latestPublicDesktopReleaseTag?.tag ?? null,
      latestReleaseCandidateTag: latestReleaseCandidateTag?.tag ?? null,
      currentRefDesktopReleaseTag: null,
      rejected: true,
      rejectionReason: manualRecovery.rejectionReason,
    });
  }

  if (
    normalizedRefName !== stableBranch &&
    normalizedRefName !== releaseCandidateBranch
  ) {
    return createNoReleasePlan({
      eventName,
      stableBranch,
      releaseCandidateBranch,
      refName: normalizedRefName,
      reason: "not-release-branch",
      releaseChannel: null,
      targetVersion: normalizedTargetVersion,
      desktopImpactingFiles,
      latestPublicDesktopReleaseTag: latestPublicDesktopReleaseTag?.tag ?? null,
      latestReleaseCandidateTag: latestReleaseCandidateTag?.tag ?? null,
      currentRefDesktopReleaseTag: null,
    });
  }

  const releaseChannel =
    normalizedRefName === releaseCandidateBranch ? "candidate" : "stable";
  const currentRefDesktopReleaseTag =
    releaseChannel === "candidate"
      ? findLatestReleaseCandidateTag(
          currentRefReleaseTags,
          normalizedTargetVersion,
        )?.tag ?? null
      : findLatestDesktopReleaseTag(currentRefReleaseTags)?.tag ?? null;

  if (currentRefDesktopReleaseTag) {
    return createNoReleasePlan({
      eventName,
      stableBranch,
      releaseCandidateBranch,
      refName: normalizedRefName,
      reason: "current-ref-already-released",
      releaseChannel,
      targetVersion: normalizedTargetVersion,
      desktopImpactingFiles,
      latestPublicDesktopReleaseTag: latestPublicDesktopReleaseTag?.tag ?? null,
      latestReleaseCandidateTag: latestReleaseCandidateTag?.tag ?? null,
      currentRefDesktopReleaseTag,
    });
  }

  const releaseRequired =
    manualRecovery.manualRecovery || desktopImpactingFiles.length > 0;
  if (!releaseRequired) {
    return createNoReleasePlan({
      eventName,
      stableBranch,
      releaseCandidateBranch,
      refName: normalizedRefName,
      reason: "no-desktop-impacting-change",
      releaseChannel,
      targetVersion: normalizedTargetVersion,
      desktopImpactingFiles,
      latestPublicDesktopReleaseTag: latestPublicDesktopReleaseTag?.tag ?? null,
      latestReleaseCandidateTag: latestReleaseCandidateTag?.tag ?? null,
      currentRefDesktopReleaseTag: null,
    });
  }

  if (
    releaseChannel === "candidate" &&
    latestPublicDesktopReleaseTag &&
    compareVersions(
      parseTargetVersion(normalizedTargetVersion),
      latestPublicDesktopReleaseTag,
    ) <= 0
  ) {
    return createNoReleasePlan({
      eventName,
      stableBranch,
      releaseCandidateBranch,
      refName: normalizedRefName,
      reason: "target-version-already-released",
      releaseChannel,
      targetVersion: normalizedTargetVersion,
      desktopImpactingFiles,
      latestPublicDesktopReleaseTag: latestPublicDesktopReleaseTag.tag,
      latestReleaseCandidateTag: latestReleaseCandidateTag?.tag ?? null,
      currentRefDesktopReleaseTag: null,
    });
  }

  if (releaseChannel === "candidate") {
    const nextRcNumber = (latestReleaseCandidateTag?.rcNumber ?? 0) + 1;
    const desktopVersion = `${normalizedTargetVersion}-rc.${nextRcNumber}`;

    return {
      eventName,
      stableBranch,
      releaseCandidateBranch,
      refName: normalizedRefName,
      releaseChannel,
      prerelease: true,
      targetVersion: normalizedTargetVersion,
      releaseRequired: true,
      rejected: false,
      rejectionReason: null,
      reason: manualRecovery.manualRecovery
        ? "manual-recovery"
        : "desktop-impacting-change",
      desktopImpacting: desktopImpactingFiles.length > 0,
      desktopImpactingFiles,
      latestPublicDesktopReleaseTag: latestPublicDesktopReleaseTag?.tag ?? null,
      latestReleaseCandidateTag: latestReleaseCandidateTag?.tag ?? null,
      currentRefDesktopReleaseTag: null,
      desktopVersion,
      desktopTag: `desktop-v${desktopVersion}`,
      versionInjection: createVersionInjection(desktopVersion),
    };
  }

  const desktopVersion = resolveStableDesktopVersion({
    releaseTags,
    targetVersion: normalizedTargetVersion,
  });
  const stableReason = manualRecovery.manualRecovery
    ? "manual-recovery"
    : latestPublicDesktopReleaseTag &&
        compareVersions(
          parseTargetVersion(normalizedTargetVersion),
          latestPublicDesktopReleaseTag,
        ) <= 0
      ? "hotfix"
      : "release-promotion";

  return {
    eventName,
    stableBranch,
    releaseCandidateBranch,
    refName: normalizedRefName,
    releaseChannel,
    prerelease: false,
    targetVersion: normalizedTargetVersion,
    releaseRequired: true,
    rejected: false,
    rejectionReason: null,
    reason: stableReason,
    desktopImpacting: desktopImpactingFiles.length > 0,
    desktopImpactingFiles,
    latestPublicDesktopReleaseTag: latestPublicDesktopReleaseTag?.tag ?? null,
    latestReleaseCandidateTag: latestReleaseCandidateTag?.tag ?? null,
    currentRefDesktopReleaseTag: null,
    desktopVersion,
    desktopTag: `desktop-v${desktopVersion}`,
    versionInjection: createVersionInjection(desktopVersion),
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
  const { targetVersion } = readReleaseCandidateState(
    env.DESKTOP_RELEASE_STATE_FILE ?? DEFAULT_RELEASE_CANDIDATE_STATE_FILE,
  );

  return createDesktopReleasePlan({
    changedFiles: splitList(env.DESKTOP_RELEASE_CHANGED_FILES),
    eventName: env.GITHUB_EVENT_NAME ?? "push",
    refName: env.GITHUB_REF_NAME ?? env.GITHUB_REF ?? STABLE_BRANCH,
    refOnProtectedBranch: parseBoolean(
      env.DESKTOP_RELEASE_REF_ON_PROTECTED_BRANCH,
    ),
    stableBranch: env.DESKTOP_RELEASE_STABLE_BRANCH ?? STABLE_BRANCH,
    releaseCandidateBranch:
      env.DESKTOP_RELEASE_CANDIDATE_BRANCH ?? RELEASE_CANDIDATE_BRANCH,
    releaseTags: splitList(env.DESKTOP_RELEASE_TAGS),
    currentRefReleaseTags: splitList(env.DESKTOP_RELEASE_CURRENT_REF_TAGS),
    targetVersion,
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
  DEFAULT_RELEASE_CANDIDATE_STATE_FILE,
  FIRST_DESKTOP_VERSION,
  RELEASE_CANDIDATE_BRANCH,
  STABLE_BRANCH,
  VERSION_ENV_VAR,
  computeNextDesktopVersion,
  createDesktopReleasePlan,
  createDesktopReleasePlanFromEnv,
  createVersionInjection,
  findLatestDesktopReleaseTag,
  findLatestReleaseCandidateTag,
  getDesktopImpactingFiles,
  incrementPatchVersion,
  isDesktopImpactingPath,
  parseDesktopReleaseCandidateTag,
  parsePublicDesktopReleaseTag,
  parseReleaseCandidateState,
  parseTargetVersion,
  readReleaseCandidateState,
  resolveStableDesktopVersion,
  validateManualRecoveryDispatch,
};
