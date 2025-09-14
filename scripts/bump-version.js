#!/usr/bin/env node

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const versionArg = args[0];
const shouldTag = args.includes("--tag");
const shouldPush = args.includes("--push");

if (!versionArg || args.includes("--help")) {
  console.log(`
Usage: bun run version <version> [--tag] [--push]

Arguments:
  version    The new version (e.g., 0.0.3, patch, minor, major)
  --tag      Create a git tag after bumping
  --push     Push the tag to origin (requires --tag)

Examples:
  bun run version 0.0.3
  bun run version patch --tag
  bun run version minor --tag --push
`);
  process.exit(0);
}

// Parse version bump type
const versionRegex = /^\d+\.\d+\.\d+$/;

function bumpVersion(current, type) {
  const [major, minor, patch] = current.split(".").map(Number);

  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default: {
      // Assume it's an explicit version
      if (!versionRegex.test(type)) {
        throw new Error(`Invalid version format: ${type}`);
      }
      return type;
    }
  }
}

try {
  // Read current versions
  const tauriConfigPath = join(process.cwd(), "src-tauri", "tauri.conf.json");
  const cargoTomlPath = join(process.cwd(), "src-tauri", "Cargo.toml");

  const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, "utf8"));
  const cargoToml = readFileSync(cargoTomlPath, "utf8");

  const currentVersion = tauriConfig.version;
  const newVersion = bumpVersion(currentVersion, versionArg);

  console.log(`Bumping version from ${currentVersion} to ${newVersion}`);

  // Update tauri.conf.json
  tauriConfig.version = newVersion;
  writeFileSync(tauriConfigPath, `${JSON.stringify(tauriConfig, null, 2)}\n`);
  console.log("✓ Updated src-tauri/tauri.conf.json");

  // Update Cargo.toml
  const updatedCargoToml = cargoToml.replace(
    /^version = ".*"$/m,
    `version = "${newVersion}"`
  );
  writeFileSync(cargoTomlPath, updatedCargoToml);
  console.log("✓ Updated src-tauri/Cargo.toml");

  // Optionally create git tag
  if (shouldTag) {
    const tagName = `v${newVersion}`;

    // Check if tag already exists
    try {
      execSync(`git rev-parse ${tagName}`, { stdio: "ignore" });
      console.error(`Error: Tag ${tagName} already exists`);
      process.exit(1);
    } catch {
      // Tag doesn't exist, we can create it
    }

    // Create the tag
    execSync(`git add ${tauriConfigPath} ${cargoTomlPath}`);
    execSync(`git commit -m "chore: bump version to ${newVersion}"`);
    execSync(`git tag ${tagName}`);
    console.log(`✓ Created git tag ${tagName}`);

    if (shouldPush) {
      execSync(`git push origin ${tagName}`);
      console.log(`✓ Pushed tag ${tagName} to origin`);
      console.log("\n🚀 GitHub Actions will now build and release your app!");
    } else {
      console.log(`\nTo push the tag, run: git push origin ${tagName}`);
    }
  } else {
    console.log("\n✓ Version bumped successfully!");
    console.log("Next steps:");
    console.log(
      `  1. Commit the changes: git add -A && git commit -m "chore: bump version to ${newVersion}"`
    );
    console.log(`  2. Create a tag: git tag v${newVersion}`);
    console.log(`  3. Push the tag: git push origin v${newVersion}`);
  }
} catch (error) {
  console.error("Error:", error.message);
  process.exit(1);
}
