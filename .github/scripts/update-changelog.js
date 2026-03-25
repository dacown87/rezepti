#!/usr/bin/env node
// Bumps patch version, updates CHANGELOG.md and public/changelog.json
// Runs in GitHub Actions on push to main

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'

// --- Version bump ---
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const [major, minor, patch] = pkg.version.split('.').map(Number)
const newVersion = `${major}.${minor}.${patch + 1}`
pkg.version = newVersion
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')

// --- Collect recent commits (exclude bot/skip-ci commits) ---
const rawCommits = execSync('git log --no-merges --pretty=format:"%s" -20')
  .toString()
  .split('\n')
  .map(s => s.trim())
  .filter(s => s && !s.includes('[skip ci]') && !s.startsWith('chore: v'))
  .slice(0, 10)

const now = new Date()
const date = now.toISOString().split('T')[0]
const time = now.toISOString().split('T')[1].slice(0, 5) // HH:MM UTC

// --- Update CHANGELOG.md ---
const newSection =
  `## [${newVersion}] – ${date}\n\n` +
  rawCommits.map(c => `- ${c}`).join('\n') +
  '\n'

let changelog = existsSync('CHANGELOG.md')
  ? readFileSync('CHANGELOG.md', 'utf8')
  : '# Changelog\n\n'

changelog = changelog.replace(/^(# Changelog\n+)/, `$1${newSection}\n`)
writeFileSync('CHANGELOG.md', changelog)

// --- Update public/changelog.json ---
const changelogJsonPath = 'frontend/public/changelog.json'
let data = { version: newVersion, entries: [] }
if (existsSync(changelogJsonPath)) {
  try { data = JSON.parse(readFileSync(changelogJsonPath, 'utf8')) } catch {}
}
data.version = newVersion
data.entries = [{ version: newVersion, date, time, changes: rawCommits }, ...data.entries].slice(0, 30)
writeFileSync(changelogJsonPath, JSON.stringify(data, null, 2) + '\n')

console.log(`✅ Version bumped to ${newVersion}`)
