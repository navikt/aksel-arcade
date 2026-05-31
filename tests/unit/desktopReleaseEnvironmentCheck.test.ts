import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

interface DesktopReleaseEnvironment {
  name: string;
  wait_timer?: number;
  reviewers?: unknown[];
  protection_rules?: Array<{ type?: string }>;
  deployment_branch_policy?: {
    protected_branches?: boolean;
    custom_branch_policies?: boolean;
  };
}

interface BranchPolicies {
  branch_policies: Array<{
    name: string;
    type: string;
  }>;
}

interface Branch {
  name: string;
  protected: boolean;
}

interface EnvironmentSecrets {
  secrets: Array<{
    name: string;
  }>;
}

interface AccessError {
  status: number | null;
  message: string;
}

interface ReadinessInput {
  environment?: DesktopReleaseEnvironment | null;
  branchPolicies?: BranchPolicies | null;
  masterBranch?: Branch | null;
  secrets?: EnvironmentSecrets | null;
  secretsAccessError?: AccessError | null;
}

interface ReadinessCheck {
  id: string;
  ok: boolean;
  message: string;
}

interface Readiness {
  ready: boolean;
  insufficientPermission: boolean;
  missingSecretNames: string[];
  checks: ReadinessCheck[];
}

interface DesktopReleaseEnvironmentCheckModule {
  INSUFFICIENT_PERMISSION_EXIT_CODE: number;
  REQUIRED_SECRET_NAMES: string[];
  createDesktopReleaseEnvironmentReadiness(input?: ReadinessInput): Readiness;
  formatDesktopReleaseEnvironmentReadiness(readiness: Readiness): string;
}

const require = createRequire(import.meta.url);
const environmentCheck = require(
  "../../scripts/desktop-release-environment-check.cjs",
) as DesktopReleaseEnvironmentCheckModule;

const readyEnvironment: DesktopReleaseEnvironment = {
  name: "desktop-release",
  wait_timer: 0,
  reviewers: [],
  protection_rules: [{ type: "branch_policy" }],
  deployment_branch_policy: {
    protected_branches: false,
    custom_branch_policies: true,
  },
};

const masterOnlyBranchPolicies: BranchPolicies = {
  branch_policies: [{ name: "master", type: "branch" }],
};

const protectedMasterBranch: Branch = {
  name: "master",
  protected: true,
};

const createSecrets = (secretNames = environmentCheck.REQUIRED_SECRET_NAMES) => ({
  secrets: secretNames.map((name) => ({ name })),
});

const createReadyReadiness = (
  overrides: ReadinessInput = {},
): Readiness =>
  environmentCheck.createDesktopReleaseEnvironmentReadiness({
    environment: readyEnvironment,
    branchPolicies: masterOnlyBranchPolicies,
    masterBranch: protectedMasterBranch,
    secrets: createSecrets(),
    ...overrides,
  });

const findCheck = (readiness: Readiness, checkId: string): ReadinessCheck => {
  const check = readiness.checks.find(({ id }) => id === checkId);

  if (!check) {
    throw new Error(`Missing readiness check ${checkId}.`);
  }

  return check;
};

describe("Desktop release environment check", () => {
  it("accepts a no-approval desktop-release environment limited to protected master with all secret names present", () => {
    const readiness = createReadyReadiness();

    expect(readiness.ready).toBe(true);
    expect(readiness.missingSecretNames).toEqual([]);
    expect(
      environmentCheck.formatDesktopReleaseEnvironmentReadiness(readiness),
    ).toContain(
      "Desktop release environment is ready for CI signing/notarization.",
    );
  });

  it("rejects missing desktop-release environment metadata", () => {
    const readiness = environmentCheck.createDesktopReleaseEnvironmentReadiness();

    expect(readiness.ready).toBe(false);
    expect(findCheck(readiness, "environment-exists")).toMatchObject({
      ok: false,
      message: "`desktop-release` environment is missing.",
    });
  });

  it("rejects manual approvals or wait timers on ordinary releases", () => {
    const readiness = createReadyReadiness({
      environment: {
        ...readyEnvironment,
        wait_timer: 5,
        reviewers: [{ type: "User", id: 123 }],
        protection_rules: [
          { type: "required_reviewers" },
          { type: "wait_timer" },
          { type: "branch_policy" },
        ],
      },
    });

    expect(readiness.ready).toBe(false);
    expect(findCheck(readiness, "no-manual-approval")).toMatchObject({
      ok: false,
      message: "Environment has a wait timer or required reviewers configured.",
    });
  });

  it("rejects broad protected-branch policies because Desktop release credentials are master-only", () => {
    const readiness = createReadyReadiness({
      environment: {
        ...readyEnvironment,
        deployment_branch_policy: {
          protected_branches: true,
          custom_branch_policies: false,
        },
      },
    });

    expect(readiness.ready).toBe(false);
    expect(findCheck(readiness, "master-only-branch-policy")).toMatchObject({
      ok: false,
      message: "Environment branch policy must allow only the `master` branch.",
    });
  });

  it("rejects non-master environment branch policies", () => {
    const readiness = createReadyReadiness({
      branchPolicies: {
        branch_policies: [
          { name: "master", type: "branch" },
          { name: "release/*", type: "branch" },
        ],
      },
    });

    expect(readiness.ready).toBe(false);
    expect(findCheck(readiness, "master-only-branch-policy")).toMatchObject({
      ok: false,
      message: "Environment branch policy must allow only the `master` branch.",
    });
  });

  it("rejects the setup when master branch protection cannot be confirmed", () => {
    const readiness = createReadyReadiness({
      masterBranch: {
        name: "master",
        protected: false,
      },
    });

    expect(readiness.ready).toBe(false);
    expect(findCheck(readiness, "master-branch-protected")).toMatchObject({
      ok: false,
      message:
        "`master` is not protected before Desktop release credentials can be used.",
    });
  });

  it("reports missing Desktop release credential names without reading secret values", () => {
    const readiness = createReadyReadiness({
      secrets: createSecrets(
        environmentCheck.REQUIRED_SECRET_NAMES.filter(
          (name) => name !== "APPLE_TEAM_ID",
        ),
      ),
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.missingSecretNames).toEqual(["APPLE_TEAM_ID"]);
    expect(findCheck(readiness, "required-secret-names").message).toContain(
      "APPLE_TEAM_ID",
    );
  });

  it("fails closed when the token cannot read environment secret names", () => {
    const readiness = createReadyReadiness({
      secrets: null,
      secretsAccessError: {
        status: 403,
        message:
          "token lacks permission to read environment secret names; run as a repository admin.",
      },
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.insufficientPermission).toBe(true);
    expect(findCheck(readiness, "secret-names-readable")).toMatchObject({
      ok: false,
    });
    expect(readiness.checks.map(({ id }) => id)).not.toContain(
      "required-secret-names",
    );
    expect(environmentCheck.INSUFFICIENT_PERMISSION_EXIT_CODE).toBe(2);
  });

  it("does not report unexpected CLI failures as insufficient permissions", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/desktop-release-environment-check.cjs"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: "/nonexistent",
        },
      },
    );

    expect(result.status).toBe(1);
    expect(result.status).not.toBe(
      environmentCheck.INSUFFICIENT_PERMISSION_EXIT_CODE,
    );
    expect(result.stderr).toContain("spawnSync gh ENOENT");
  });
});
