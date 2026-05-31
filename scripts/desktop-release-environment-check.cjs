#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");

const DEFAULT_REPOSITORY = "navikt/aksel-arcade";
const ENVIRONMENT_NAME = "desktop-release";
const PROTECTED_BRANCH = "master";
const INSUFFICIENT_PERMISSION_EXIT_CODE = 2;

const REQUIRED_SECRET_NAMES = Object.freeze([
  "MAC_CERTIFICATE_P12_BASE64",
  "MAC_CERTIFICATE_PASSWORD",
  "APPLE_API_KEY_BASE64",
  "APPLE_API_KEY_ID",
  "APPLE_API_ISSUER_ID",
  "APPLE_TEAM_ID",
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getEnvironmentProtectionRules(environment) {
  return asArray(environment?.protection_rules);
}

function getEnvironmentReviewers(environment) {
  return asArray(environment?.reviewers);
}

function hasProtectionRule(environment, type) {
  return getEnvironmentProtectionRules(environment).some(
    (rule) => rule?.type === type,
  );
}

function hasNoManualApproval(environment) {
  const waitTimer = Number(environment?.wait_timer ?? 0);

  return (
    waitTimer === 0 &&
    getEnvironmentReviewers(environment).length === 0 &&
    !hasProtectionRule(environment, "required_reviewers") &&
    !hasProtectionRule(environment, "wait_timer")
  );
}

function getBranchPolicies(branchPolicies) {
  return asArray(
    branchPolicies?.branch_policies ??
      branchPolicies?.deployment_branch_policies,
  );
}

function getSecretNames(secrets) {
  return asArray(secrets?.secrets)
    .map((secret) => secret?.name)
    .filter((name) => typeof name === "string");
}

function getMissingSecretNames(secrets) {
  const configuredSecretNames = new Set(getSecretNames(secrets));

  return REQUIRED_SECRET_NAMES.filter(
    (secretName) => !configuredSecretNames.has(secretName),
  );
}

function hasMasterOnlyBranchPolicy(environment, branchPolicies) {
  const deploymentBranchPolicy = environment?.deployment_branch_policy;

  if (
    deploymentBranchPolicy?.protected_branches !== false ||
    deploymentBranchPolicy?.custom_branch_policies !== true
  ) {
    return false;
  }

  const policies = getBranchPolicies(branchPolicies);

  return (
    policies.length === 1 &&
    policies[0]?.name === PROTECTED_BRANCH &&
    policies[0]?.type === "branch"
  );
}

function createCheck(id, ok, message) {
  return {
    id,
    ok,
    message,
  };
}

function createDesktopReleaseEnvironmentReadiness({
  environment = null,
  branchPolicies = null,
  masterBranch = null,
  secrets = null,
  secretsAccessError = null,
} = {}) {
  const environmentExists = environment?.name === ENVIRONMENT_NAME;
  const missingSecretNames = secretsAccessError
    ? REQUIRED_SECRET_NAMES
    : getMissingSecretNames(secrets);
  const checks = [
    createCheck(
      "environment-exists",
      environmentExists,
      environmentExists
        ? "`desktop-release` environment exists."
        : "`desktop-release` environment is missing.",
    ),
  ];

  if (environmentExists) {
    const noManualApproval = hasNoManualApproval(environment);
    const masterBranchProtected = masterBranch?.protected === true;
    const masterOnlyBranchPolicy = hasMasterOnlyBranchPolicy(
      environment,
      branchPolicies,
    );

    checks.push(
      createCheck(
        "no-manual-approval",
        noManualApproval,
        noManualApproval
          ? "Environment has no wait timer or required reviewers."
          : "Environment has a wait timer or required reviewers configured.",
      ),
      createCheck(
        "master-branch-protected",
        masterBranchProtected,
        masterBranchProtected
          ? "`master` is protected before Desktop release credentials can be used."
          : "`master` is not protected before Desktop release credentials can be used.",
      ),
      createCheck(
        "master-only-branch-policy",
        masterOnlyBranchPolicy,
        masterOnlyBranchPolicy
          ? "Environment branch policy allows only the `master` branch."
          : "Environment branch policy must allow only the `master` branch.",
      ),
      createCheck(
        "secret-names-readable",
        secretsAccessError === null,
        secretsAccessError
          ? `Cannot verify environment secret names: ${secretsAccessError.message}`
          : "Environment secret names are readable.",
      ),
    );

    if (!secretsAccessError) {
      checks.push(
        createCheck(
          "required-secret-names",
          missingSecretNames.length === 0,
          missingSecretNames.length === 0
            ? "All required Desktop release credential names are present."
            : `Missing Desktop release credential names: ${missingSecretNames.join(
                ", ",
              )}`,
        ),
      );
    }
  }

  return {
    ready: checks.every((check) => check.ok),
    insufficientPermission: secretsAccessError?.status === 403,
    missingSecretNames,
    checks,
  };
}

function formatDesktopReleaseEnvironmentReadiness(readiness) {
  const lines = [
    readiness.ready
      ? "Desktop release environment is ready for CI signing/notarization."
      : "Desktop release environment is not ready for CI signing/notarization.",
    "",
    ...readiness.checks.map(
      (check) => `${check.ok ? "PASS" : "FAIL"} ${check.message}`,
    ),
    "",
  ];

  return `${lines.join("\n")}`;
}

function extractHttpStatus(output) {
  const match = /\bHTTP\s+(\d{3})\b/.exec(output);

  return match ? Number(match[1]) : null;
}

function runGhApiJson(path) {
  const result = spawnSync("gh", ["api", path], {
    encoding: "utf8",
  });

  if (result.error) {
    return {
      ok: false,
      status: null,
      message: result.error.message,
      data: null,
    };
  }

  if (result.status !== 0) {
    const output = `${result.stderr ?? ""}${result.stdout ?? ""}`.trim();

    return {
      ok: false,
      status: extractHttpStatus(output),
      message: output || `gh api exited with status ${result.status}.`,
      data: null,
    };
  }

  try {
    return {
      ok: true,
      status: 200,
      message: null,
      data: JSON.parse(result.stdout),
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      message: `Failed to parse gh api JSON: ${error.message}`,
      data: null,
    };
  }
}

function requireGhApiJson(path) {
  const result = runGhApiJson(path);

  if (!result.ok) {
    throw new Error(result.message);
  }

  return result.data;
}

function getRepositoryFromEnv(env = process.env) {
  return (
    env.DESKTOP_RELEASE_REPOSITORY ?? env.GITHUB_REPOSITORY ?? DEFAULT_REPOSITORY
  );
}

function readDesktopReleaseEnvironmentState(repository) {
  const environmentPath = `repos/${repository}/environments/${ENVIRONMENT_NAME}`;
  const environmentResult = runGhApiJson(environmentPath);

  if (!environmentResult.ok) {
    if (environmentResult.status === 404) {
      return {
        environment: null,
        branchPolicies: null,
        masterBranch: null,
        secrets: null,
        secretsAccessError: null,
      };
    }

    throw new Error(environmentResult.message);
  }

  const secretsPath = `${environmentPath}/secrets`;
  const secretsResult = runGhApiJson(secretsPath);

  return {
    environment: environmentResult.data,
    branchPolicies: requireGhApiJson(
      `${environmentPath}/deployment-branch-policies`,
    ),
    masterBranch: requireGhApiJson(
      `repos/${repository}/branches/${PROTECTED_BRANCH}`,
    ),
    secrets: secretsResult.ok ? secretsResult.data : null,
    secretsAccessError: secretsResult.ok
      ? null
      : {
          status: secretsResult.status,
          message:
            secretsResult.status === 403
              ? "token lacks permission to read environment secret names; run as a repository admin or with secrets:read permission."
              : secretsResult.message,
        },
  };
}

if (require.main === module) {
  try {
    const readiness = createDesktopReleaseEnvironmentReadiness(
      readDesktopReleaseEnvironmentState(getRepositoryFromEnv()),
    );

    process.stdout.write(formatDesktopReleaseEnvironmentReadiness(readiness));

    if (!readiness.ready) {
      process.exitCode = readiness.insufficientPermission
        ? INSUFFICIENT_PERMISSION_EXIT_CODE
        : 1;
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  ENVIRONMENT_NAME,
  INSUFFICIENT_PERMISSION_EXIT_CODE,
  PROTECTED_BRANCH,
  REQUIRED_SECRET_NAMES,
  createDesktopReleaseEnvironmentReadiness,
  formatDesktopReleaseEnvironmentReadiness,
  getMissingSecretNames,
  hasMasterOnlyBranchPolicy,
  hasNoManualApproval,
};
