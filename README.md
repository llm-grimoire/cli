# grimoire

Generate navigable documentation CLIs for any codebase. Grimoire analyzes a project, produces curated topic guides, and scaffolds a standalone CLI that AI agents (or humans) can use to look things up fast.

```
$ grimoire init my-project
$ grimoire analyze --mode agent ./path/to/codebase
$ grimoire build
```

The output is a self-contained CLI:

```
$ my-project-solutions list

my-project Solutions
Available topics:

  overview            What my-project is and how the packages fit together
  architecture        Service layer design and dependency injection
  error-handling      Error types, recovery patterns, and boundaries
  ...

$ my-project-solutions show architecture
```

## Why

AI agents waste context window exploring codebases — reading directory trees, opening files speculatively, rediscovering structure across sessions. Grimoire creates a curated reference that gives agents (and developers) the right information immediately.

## Install

```bash
bun install -g grimoire-gen
```

Requires [Bun](https://bun.sh).

## Commands

### `grimoire init [name]`

Scaffold a new solutions CLI project.

```bash
grimoire init my-project
cd my-project-solutions
bun install
bun run src/cli.ts list
```

Creates a complete `@effect/cli` project with `list`, `show <topic>`, and `setup` commands, plus a starter overview topic.

Options:
- `-d, --description` — Project description
- `-t, --target-repo` — Target repository URL

### `grimoire analyze [path]`

Analyze a codebase and generate topic documentation.

**Agent mode** (default) — generates a structured prompt file you feed to Claude Code or another AI:

```bash
grimoire analyze --mode agent ./my-codebase
# Writes my-codebase-analysis-prompt.md
```

**API mode** — calls the Anthropic API directly to generate topics:

```bash
ANTHROPIC_API_KEY=sk-... grimoire analyze --mode api ./my-codebase
```

The API pipeline runs three phases: discovery (codebase overview), topic planning (8-15 proposals), and topic generation (full markdown for each).

Options:
- `--mode agent|api` — Analysis mode (default: agent)
- `-o, --output` — Output path
- `-n, --name` — Project name

### `grimoire add <topic>`

Add a topic manually.

```bash
grimoire add error-handling
grimoire add architecture --title "System Architecture" --category architecture
```

Creates a markdown file in `topics/` with YAML frontmatter. Edit it, then rebuild.

### `grimoire build`

Build the scaffolded CLI.

```bash
grimoire build              # manifest + bundle
grimoire build --publishable  # + cross-platform binaries
```

Generates `docs-manifest.ts` from topic files, then bundles everything with Bun.

### `grimoire dev <args>`

Run the scaffolded CLI in development mode (regenerates manifest first).

```bash
grimoire dev list
grimoire dev show architecture
```

## Topic Format

Topics are markdown files with YAML frontmatter in the `topics/` directory:

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

## Overview
How errors flow through the system...

## Key Concepts
...

## Code Examples
...
```

## How It Works

1. **`grimoire init`** scaffolds a project from TypeScript template functions (not string templates — they're type-checked and ship inside the binary)
2. **Topics** are markdown files with frontmatter, compiled into a typed `docs-manifest.ts` registry
3. **`grimoire analyze`** reads a codebase (respecting `.gitignore`), then either generates a prompt for an AI agent or calls the Anthropic API to produce topics directly
4. **The output CLI** is a standalone `@effect/cli` project — `list` shows topics, `show <topic>` renders them

## Configuration

`grimoire.json` in the scaffolded project root:

```json
{
  "name": "my-project",
  "cliName": "my-project-solutions",
  "description": "A codebase navigation CLI",
  "version": "0.1.0",
  "topicsDir": "topics",
  "outputDir": "dist"
}
```

## Built With

- [Effect](https://effect.website) — typed functional programming for TypeScript
- [@effect/cli](https://github.com/Effect-TS/effect/tree/main/packages/cli) — type-safe CLI framework
- [@effect/ai-anthropic](https://github.com/Effect-TS/effect/tree/main/packages/ai-anthropic) — Anthropic API client (optional, for `--mode api`)
- [Bun](https://bun.sh) — runtime, bundler, and binary compilation

## License

MIT
