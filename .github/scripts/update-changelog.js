#!/usr/bin/env node
// Bumps patch version, updates CHANGELOG.md and public/changelog.json
// Runs in GitHub Actions on push to main

import fs from 'fs'
import { execSync } from 'child_process'

// --- Version bump ---
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
const [major, minor, patch] = pkg.version.split('.').map(Number)
const newVersion = `${major}.${minor}.${patch + 1}`
pkg.version = newVersion
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')

// --- Collect recent commits (exclude bot/skip-ci commits) ---
const rawCommits = execSync('git log --no-merges --pretty=format:"%s" -20')
  .toString()
  .split('\n')
  .map(s => s.trim())
  .filter(s => s && !s.includes('[skip ci]') && !s.startsWith('chore: v'))
  .slice(0, 10)

const now = new Date()
const date = now.toISOString().split('T')[0]
const time = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })

// --- Update CHANGELOG.md ---
const newSection =
  `## [${newVersion}] – ${date}\n\n` +
  rawCommits.map(c => `- ${c}`).join('\n') +
  '\n'

let changelog = fs.existsSync('CHANGELOG.md')
  ? fs.readFileSync('CHANGELOG.md', 'utf8')
  : '# Changelog\n\n'

// Insert new section right after the header line
changelog = changelog.replace(/^(# Changelog\n+)/, `$1${newSection}\n`)
fs.writeFileSync('CHANGELOG.md', changelog)

// --- Update frontend/public/changelog.json ---
const changelogJsonPath = 'frontend/public/changelog.json'
let data = { version: newVersion, entries: [] }
if (fs.existsSync(changelogJsonPath)) {
  try { data = JSON.parse(fs.readFileSync(changelogJsonPath, 'utf8')) } catch {}
}
data.version = newVersion
data.lastUpdated = { date, time }
data.entries = [{ version: newVersion, date, changes: rawCommits }, ...data.entries].slice(0, 30)
fs.writeFileSync(changelogJsonPath, JSON.stringify(data, null, 2) + '\n')

console.log(`✅ Version bumped to ${newVersion}`)
