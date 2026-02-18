# grimoire

AI-assisted codebase navigation. Analyzes any codebase (via AI or agent prompts), generates topic documentation, and serves it directly from `~/.grimoire`. Supports a public registry for sharing pre-built grimoires.

> **Note:** The directory may still be named `cli-gen/` on disk — the project has been renamed to `grimoire` in all source code, package.json, and CLI commands.

## Project Status

**Core redesign complete.** All commands work end-to-end with centralized `~/.grimoire` storage. Registry support (`add`) is in v1 form.

### Commands
- `grimoire search [query]` — browse and install from the registry (interactive prompt, or static with query)
- `grimoire add <name>` — pull pre-built grimoire from registry (e.g. `effect-atom`, `@effect/sql-pg`)
- `grimoire conjure [name] [--github owner/repo] [--path dir] [--mode agent|api] [--hint text]` — generate locally (name optional with `--github`)
- `grimoire list [project]` — list all projects or topics for a project
- `grimoire show <project> <topic>` — show a topic
- `grimoire incant <project>` — output agent instructions
- `grimoire remove <project>` — remove a project

### What's Remaining (Polish)
- `UpdateNotifier` service exists but isn't wired into CLI output
- Error handling could be more user-friendly (raw Effect errors leak in some cases)
- No tests
- `toolkit.ts` is a placeholder — the pipeline uses `generateObject` directly instead of tool-based interactions

## Directory Structure

```
~/.grimoire/
  projects/
    effect-atom/
      grimoire.json        # Project config (name, description, github, path, sourceType)
      topics/
        00-overview.md
        01-architecture.md
        ...
    @effect/
      sql-pg/
        grimoire.json
        topics/
    my-lib/
      grimoire.json
      topics/
```

Projects use npm-style naming: plain names (`effect-atom`) are stored flat, scoped names (`@scope/name`) are stored as `@scope/name/`. The grimoire `name` from grimoire.json is the canonical identifier everywhere.

No manifest — `list` and `show` read topic `.md` files directly, parsing frontmatter at runtime. Respects `GRIMOIRE_HOME` env var to override `~/.grimoire`.

## Registry

Git repo at `github.com/llm-grimoire/registry`, with packages named by grimoire name. Served via static API at [llm-grimoire.dev](https://llm-grimoire.dev).

```
registry/
  packages/
    effect-atom/
      grimoire.json
      topics/...
    @effect/
      sql-pg/
        grimoire.json
        topics/...
    @kontor/
      kontor-sdk/
        grimoire.json
        topics/...
```

- `grimoire search` — interactive browser for the registry
- `grimoire add <name>` — fetches from the registry API at llm-grimoire.dev

## Architecture

**Runtime**: Node.js (via tsx). **Framework**: Effect with `@effect/cli`.

### Key Patterns
- **Effect.Service class pattern** with `accessors: true` for all services
- **Layer composition** in `cli.ts`: BaseServices → DependentServices → ServiceLayer
- **`grimoire.json`** per project for config (name, description, github, path, sourceType)
- **Lazy AI loading** — `@effect/ai-anthropic`, `@effect/ai-openai`, and `@effect/ai-openrouter` are only imported when `--mode api` is used (whichever key is detected), so no API key needed for other commands

### Service Dependencies
```
CLI Commands
  ├── search    → GrimoireHome (interactive registry browser)
  ├── add       → GrimoireHome (fetches from registry)
  ├── conjure   → GrimoireHome, ProjectConfigService, AgentPromptGenerator | TopicWriter
  ├── list      → GrimoireHome, ProjectConfigService, TopicReader
  ├── show      → GrimoireHome, TopicReader
  ├── incant    → GrimoireHome, ProjectConfigService, TopicReader
  └── remove    → GrimoireHome, FileSystem

GrimoireHome → FileSystem (resolves ~/.grimoire path)
ProjectConfigService → GrimoireHome, FileSystem
TopicReader → GrimoireHome, FileSystem (frontmatter parsing)
AgentPromptGenerator → CodebaseReader → FileSystem
SourceResolver → pure function (resolveSource), handles git clone + path resolution
```

### Source Resolution
`src/services/source-resolver.ts` exports `resolveSource({ github?, path? })`:
- **github only**: `git clone --depth 1` to temp dir
- **github + path**: clone, narrow to subdir
- **path only**: resolve relative to cwd
- Returns `{ codebasePath, cleanup? }` — caller must invoke cleanup for temp dirs

### AI Pipeline (Direct Mode)
Three-phase pipeline using `LanguageModel.generateObject` with Effect Schema validation:
1. **Discovery** → `CodebaseOverview`
2. **Topic Planning** → `TopicProposalSet` (8-15 proposals)
3. **Topic Generation** → `GeneratedTopic` for each proposal

Provider layer is resolved in `src/ai/provider.ts` — auto-detects `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `OPENROUTER_API_KEY` (first found wins) and returns the corresponding `LanguageModel` layer.

## Development

```bash
npm install
npx tsx src/cli.ts --help        # run CLI directly
npm run typecheck                 # tsc --noEmit
```

### Testing end-to-end
```bash
# Browse / search registry
npx tsx src/cli.ts search
npx tsx src/cli.ts search effect

# Install from registry
npx tsx src/cli.ts add effect-atom

# Generate with GitHub source (name defaults to repo name)
npx tsx src/cli.ts conjure --github tim-smart/effect-atom

# Generate monorepo sub-package (name required)
npx tsx src/cli.ts conjure effect-sql --github effect-ts/effect --path packages/sql

# Generate from local path (name required)
npx tsx src/cli.ts conjure my-lib --path ./src

# List / show / remove
npx tsx src/cli.ts list
npx tsx src/cli.ts list effect-atom
npx tsx src/cli.ts show effect-atom overview
npx tsx src/cli.ts remove effect-atom
```

## File Layout

```
src/
  cli.ts                          # Root entry point, layer composition
  commands/                       # CLI command definitions (search, add, conjure, list, show, incant, remove)
  services/                       # Effect services (GrimoireHome, ProjectConfig, TopicReader, SourceResolver, etc.)
  schemas/                        # Effect Schema definitions (project-config, topic, analysis)
  ai/                             # AI pipeline (prompts, tools, pipeline orchestration)
  lib/                            # Utilities (render, gitignore, file-tree)
```

## Notes

- The `@effect/ai` API uses `Tool`, `Toolkit`, `LanguageModel` (not `AiTool`/`AiToolkit`/`AiLanguageModel`)
- `LanguageModel.generateObject()` returns `GenerateObjectResponse` — access `.value` for the parsed object
- `Options.optional` in `@effect/cli` returns `Option<T>` — use `Option.getOrElse` / `Option.getOrUndefined`
