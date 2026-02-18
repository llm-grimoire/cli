# grimoire

AI-assisted codebase navigation. Analyzes any codebase (via AI or agent prompts), generates topic documentation, and serves it directly from `~/.grimoire`. Supports a public registry for sharing pre-built grimoires.

> **Note:** The directory may still be named `cli-gen/` on disk — the project has been renamed to `grimoire` in all source code, package.json, and CLI commands.

## Project Status

**Core redesign complete.** All commands work end-to-end with centralized `~/.grimoire` storage. Registry support (`add`/`push`) is in v1 form.

### Commands
- `grimoire add <name>` — pull pre-built grimoire from registry
- `grimoire conjure <name> [--github owner/repo] [--path dir] [--mode agent|api]` — generate locally (creates project if needed)
- `grimoire push <name>` — contribute local grimoire to registry (outputs instructions for PR)
- `grimoire list [project]` — list all projects or topics for a project
- `grimoire show <project> <topic>` — show a topic
- `grimoire incant <project>` — output agent instructions
- `grimoire remove <project>` — remove a project

### What's Remaining (Polish)
- `UpdateNotifier` service exists but isn't wired into CLI output
- Error handling could be more user-friendly (raw Effect errors leak in some cases)
- No tests
- `toolkit.ts` is a placeholder — the pipeline uses `generateObject` directly instead of tool-based interactions
- `push` outputs manual instructions — could automate fork/PR via `gh`

## Directory Structure

```
~/.grimoire/
  projects/
    effect-atom/
      grimoire.json          # Project config (name, description, github, path, sourceType)
      topics/
        00-overview.md
        01-architecture.md
        ...
    another-project/
      grimoire.json
      topics/
```

No manifest — `list` and `show` read topic `.md` files directly, parsing frontmatter at runtime. Respects `GRIMOIRE_HOME` env var to override `~/.grimoire`.

## Registry

Git repo at `github.com/grimoire-registry/registry`, namespaced by GitHub owner/repo:

```
registry/
  tim-smart/
    effect-atom/
      grimoire.json
      topics/...
  effect-ts/
    effect/
      sql/              # monorepo sub-package
        grimoire.json
        topics/...
```

- `grimoire add owner/repo` fetches from registry via raw GitHub URLs
- `grimoire push name` outputs instructions for contributing via PR

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
  ├── add       → GrimoireHome (fetches from registry)
  ├── conjure   → GrimoireHome, ProjectConfigService, AgentPromptGenerator | TopicWriter
  ├── push      → GrimoireHome, ProjectConfigService, TopicReader
  ├── list      → GrimoireHome, ProjectConfigService, TopicReader
  ├── show      → GrimoireHome, TopicReader
  ├── incant   → GrimoireHome, ProjectConfigService, TopicReader
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
# Analyze with GitHub source
npx tsx src/cli.ts analyze effect-atom --github tim-smart/effect-atom

# Analyze monorepo sub-package
npx tsx src/cli.ts analyze effect-sql --github effect-ts/effect --path packages/sql

# Analyze local path
npx tsx src/cli.ts analyze my-lib --path ./src

# Re-analyze (uses stored config)
npx tsx src/cli.ts analyze effect-atom

# List / show / remove
npx tsx src/cli.ts list
npx tsx src/cli.ts list effect-atom
npx tsx src/cli.ts remove effect-atom
```

## File Layout

```
src/
  cli.ts                          # Root entry point, layer composition
  commands/                       # CLI command definitions (add, conjure, push, list, show, incant, remove)
  services/                       # Effect services (GrimoireHome, ProjectConfig, TopicReader, SourceResolver, etc.)
  schemas/                        # Effect Schema definitions (project-config, topic, analysis)
  ai/                             # AI pipeline (prompts, tools, pipeline orchestration)
  lib/                            # Utilities (render, gitignore, file-tree)
```

## Notes

- The `@effect/ai` API uses `Tool`, `Toolkit`, `LanguageModel` (not `AiTool`/`AiToolkit`/`AiLanguageModel`)
- `LanguageModel.generateObject()` returns `GenerateObjectResponse` — access `.value` for the parsed object
- `Options.optional` in `@effect/cli` returns `Option<T>` — use `Option.getOrElse` / `Option.getOrUndefined`
