#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const args = new Set(process.argv.slice(2));
const stagedOnly = args.has("--staged");

const allowedPlaceholderFragments = [
  "<password>",
  "[pw]",
  "xxxx",
  "xxxx-staging",
  "[ref]",
  "example.com",
  "localhost",
  "127.0.0.1",
];

const ignoredPathPrefixes = [
  ".git/",
  "node_modules/",
  "mobile/node_modules/",
  "dist/",
  "frontend/dist/",
];

const secretPatterns = [
  {
    name: "hardcoded Postgres URL",
    regex: /postgres(?:ql)?:\/\/[^:\s"'`]+:[^@\s"'`]+@[^)\s"'`]+/g,
  },
  {
    name: "Supabase service-role JWT",
    regex: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  },
  {
    name: "OpenAI-style API key",
    regex: /sk-[A-Za-z0-9_-]{20,}/g,
  },
];

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).trim();
}

function trackedFiles() {
  const output = stagedOnly
    ? git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"])
    : git(["ls-files"]);
  return output.split("\n").map((line) => line.trim()).filter(Boolean);
}

function stagedContent(path) {
  try {
    return execFileSync("git", ["show", `:${path}`], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return existsSync(path) ? readFileSync(path, "utf8") : "";
  }
}

function fileContent(path) {
  return stagedOnly ? stagedContent(path) : readFileSync(path, "utf8");
}

function isIgnoredPath(path) {
  return ignoredPathPrefixes.some((prefix) => path.startsWith(prefix));
}

function isAllowedPlaceholder(match) {
  return allowedPlaceholderFragments.some((fragment) => match.includes(fragment));
}

const findings = [];

for (const path of trackedFiles()) {
  if (isIgnoredPath(path) || !existsSync(path)) continue;

  let content;
  try {
    content = fileContent(path);
  } catch {
    continue;
  }

  for (const pattern of secretPatterns) {
    for (const match of content.matchAll(pattern.regex)) {
      const value = match[0];
      if (isAllowedPlaceholder(value)) continue;

      const line = content.slice(0, match.index).split("\n").length;
      findings.push({ path, line, type: pattern.name });
    }
  }
}

if (findings.length > 0) {
  console.error("\n[secret-scan] Possible committed secret detected:\n");
  for (const finding of findings) {
    console.error(`  - ${finding.path}:${finding.line} (${finding.type})`);
  }
  console.error("\nMove real credentials to .env or a secret manager, then retry.\n");
  process.exit(1);
}
