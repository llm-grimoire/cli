# grimoire

Instant codebase documentation for AI agents and humans. One command to analyze, one command to read.

```
$ grimoire init effect-atom --target https://github.com/tim-smart/effect-atom --mode api
$ grimoire show effect-atom overview
```

That's it. No scaffolding, no `npm install`, no separate project to manage. Everything lives in `~/.grimoire`.

## Why

AI agents waste context window exploring codebases — reading directory trees, opening files speculatively, rediscovering structure across sessions. Grimoire creates a curated reference that gives agents (and developers) the right information immediately.

## Install

Requires Node.js 20+.

```bash
npm install -g grimoire-gen
```

## Quick Start

```bash
# Analyze a GitHub repo with AI
grimoire init my-lib --target https://github.com/user/my-lib --mode api

# Analyze a local codebase
grimoire init my-lib --target ./path/to/my-lib --mode api

# Agent mode (default) — generates a prompt file for Claude Code
grimoire init my-lib --target https://github.com/user/my-lib

# Browse the results
grimoire list my-lib
grimoire show my-lib overview
```

API mode (`--mode api`) requires `OPENROUTER_API_KEY` set in the environment.

## Commands

| Command | Purpose |
|---------|---------|
| `grimoire init <name> [--target url\|path] [--mode agent\|api]` | Create project + optional analysis |
| `grimoire analyze <project> [--target path] [--mode agent\|api]` | Run/rerun analysis for a project |
| `grimoire list` | List all projects |
| `grimoire list <project>` | List topics for a project |
| `grimoire show <project> <topic>` | Show a topic |
| `grimoire remove <project>` | Remove a project |

### `grimoire init <name>`

Create a new project, optionally analyzing a codebase in the same step.

```bash
grimoire init effect-atom --target https://github.com/tim-smart/effect-atom --mode api
grimoire init my-project                          # create empty, analyze later
grimoire init my-project --target ./local/path     # agent mode (default)
```

### `grimoire analyze <project>`

Run or rerun analysis on an existing project. Target defaults to the `source` saved in `grimoire.json`.

```bash
grimoire analyze my-project --target ./my-codebase --mode api
grimoire analyze my-project                        # uses saved source
```

### `grimoire list`

```bash
grimoire list                  # all projects
grimoire list my-project       # topics in a project
```

### `grimoire show <project> <topic>`

```bash
grimoire show effect-atom overview
grimoire show effect-atom architecture
```

### `grimoire remove <project>`

```bash
grimoire remove my-project
```

## How It Works

1. `grimoire init` creates a project directory in `~/.grimoire/projects/<name>/`
2. Analysis reads the codebase (respecting `.gitignore`), then either generates a prompt for an AI agent or calls OpenRouter to produce topics directly
3. Topics are markdown files with YAML frontmatter, read directly at runtime — no build step
4. `list` and `show` parse frontmatter and render to the terminal

## Topic Format

```markdown
---
title: Error Handling
slug: error-handling
description: Error types, recovery patterns, and boundaries
order: 3
category: patterns
tags: [errors, recovery, boundaries]
relatedFiles: [src/errors.ts, src/middleware/error-handler.ts]
---

# Error Handling

Content here...
```

## Storage

Everything lives in `~/.grimoire` (override with `GRIMOIRE_HOME`):

```
~/.grimoire/
  projects/
    effect-atom/
      grimoire.json
      topics/
        00-overview.md
        01-architecture.md
        ...
```

## Built With

- [Effect](https://effect.website) + [@effect/cli](https://github.com/Effect-TS/effect/tree/main/packages/cli)
- [@effect/ai-openrouter](https://github.com/Effect-TS/effect/tree/main/packages/ai-openrouter) (optional, for `--mode api`)

## License

MIT
