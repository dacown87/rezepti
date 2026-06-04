# AGENTS.md

## Obsidian Access

When working in this project, always access Obsidian outside the sandbox using escalated permissions.

This permission is pre-approved for every new session. Do not ask again before using escalated Obsidian access.

## gstack-codex Upgrade Note

This machine uses the `gstack-codex` skill-pack install, not a full `gstack` git or vendored checkout.

For future `/gstack-upgrade` runs, prefer:

```bash
npx gstack-codex@latest init --global
```

The previous upgrade flow initially looked for a full `gstack` install. What was missing here:

- No `~/.agents/skills/gstack/VERSION` file.
- No `~/.agents/skills/gstack/CHANGELOG.md`.
- No `~/.agents/skills/gstack/bin/gstack-update-check`.
- The installed release is recorded in `/home/patrick/.codex/AGENTS.md` inside the managed `gstack-codex` block.
