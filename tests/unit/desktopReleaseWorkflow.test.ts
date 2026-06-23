import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = path.join(
  process.cwd(),
  ".github/workflows/desktop-release.yml",
);
const workflow = fs.readFileSync(workflowPath, "utf8");

describe("Desktop release workflow", () => {
  it("runs from protected release-candidate and master pushes plus guarded recovery dispatches", () => {
    expect(workflow).toContain("name: Desktop release");
    expect(workflow).toContain("push:");
    expect(workflow).toContain("- release-candidate");
    expect(workflow).toContain("- master");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("recovery_sha:");
    expect(workflow).toContain("git merge-base --is-ancestor");
    expect(workflow).toContain("DESKTOP_RELEASE_REF_ON_PROTECTED_BRANCH");
    expect(workflow).toContain("release-source:");
    expect(workflow).toContain("release-candidate-state.json");
  });

  it("builds signed macOS installers before publishing from one aggregation job", () => {
    expect(workflow).toContain("package-macos:");
    expect(workflow).toContain("publish:");
    expect(workflow).toContain("- package-macos");
    expect(workflow).toContain("AKSEL_ARCADE_DESKTOP_VERSION");
    expect(workflow).toContain("Aksel-Arcade-${DESKTOP_VERSION}-mac-arm64.dmg");
    expect(workflow).toContain("Aksel-Arcade-${DESKTOP_VERSION}-mac-x64.dmg");
    expect(workflow).toContain("Checkout trusted workflow ref");
    expect(workflow).toContain("Checkout verified release source");
    expect(workflow).toContain('git checkout --detach "$RELEASE_SOURCE"');
    expect(workflow).not.toContain("package-windows:");
    expect(workflow).not.toContain("windows-x64.exe");
  });

  it("publishes prereleases for RC builds, stable releases for master, and no partial public artifacts", () => {
    expect(workflow).toContain("DESKTOP_PRERELEASE");
    expect(workflow).toContain("## Release candidate");
    expect(workflow).toContain("prerelease_flag=(-F prerelease=true)");
    expect(workflow).toContain('-F prerelease=true');
    expect(workflow).toContain('-F prerelease=false');
    expect(workflow).toContain("-f make_latest=true");
    expect(workflow).toContain(
      'gh release delete "$DESKTOP_TAG" --repo "$GITHUB_REPOSITORY"',
    );
    expect(workflow).toContain(
      'gh release upload "$DESKTOP_TAG" --repo "$GITHUB_REPOSITORY"',
    );
    expect(workflow).toContain(
      'gh release view "$DESKTOP_TAG" --repo "$GITHUB_REPOSITORY"',
    );
    expect(workflow).toContain("stale_draft_release_ids");
    expect(workflow).toContain(
      'select(.tag_name == \\"${DESKTOP_TAG}\\" and .draft == true)',
    );
    expect(workflow).toContain(
      'repos/${GITHUB_REPOSITORY}/releases/${stale_release_id}',
    );
    expect(workflow).toContain(
      'repos/${GITHUB_REPOSITORY}/git/refs/tags/${DESKTOP_TAG}',
    );
    expect(workflow).toContain("releases/generate-notes");
    expect(workflow).toContain("## Download guide");
    expect(workflow).not.toMatch(/checksum|sha256/i);
  });
});
