# grimoire

AI-assisted codebase navigation. Analyzes any codebase (via AI or agent prompts), generates topic documentation, and serves it directly from `~/.grimoire`. Zero friction: `grimoire init` + `grimoire show`.

> **Note:** The directory may still be named `cli-gen/` on disk — the project has been renamed to `grimoire` in all source code, package.json, and CLI commands.

## Project Status

**Core redesign complete.** All commands work end-to-end with centralized `~/.grimoire` storage.

### Commands
- `grimoire init <name> [--target url|path] [--mode agent|api]` — create project + optional analysis
- `grimoire analyze <project> [--target path] [--mode agent|api]` — run/rerun analysis for a project
- `grimoire list` — list all projects
- `grimoire list <project>` — list topics for a project
- `grimoire show <project> <topic>` — show a topic
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
      grimoire.json          # Project config (name, description, source)
      topics/
        00-overview.md
        01-architecture.md
        ...
    another-project/
      grimoire.json
      topics/
```

No manifest — `list` and `show` read topic `.md` files directly, parsing frontmatter with gray-matter at runtime. Respects `GRIMOIRE_HOME` env var to override `~/.grimoire`.

## Architecture

**Runtime**: Node.js (via tsx). **Framework**: Effect with `@effect/cli`.

### Key Patterns
- **Effect.Service class pattern** with `accessors: true` for all services
- **Layer composition** in `cli.ts`: BaseServices → DependentServices → ServiceLayer
- **`grimoire.json`** per project for config (name, description, source)
- **Lazy AI loading** — `@effect/ai-openrouter` is only imported when `--mode api` is used, so no API key needed for other commands

### Service Dependencies
```
CLI Commands
  ├── init      → GrimoireHome, ProjectConfigService, AgentPromptGenerator | TopicWriter
  ├── analyze   → GrimoireHome, ProjectConfigService, AgentPromptGenerator | TopicWriter
  ├── list      → GrimoireHome, ProjectConfigService, TopicReader
  ├── show      → GrimoireHome, TopicReader
  └── remove    → GrimoireHome, FileSystem

GrimoireHome → FileSystem (resolves ~/.grimoire path)
ProjectConfigService → GrimoireHome, FileSystem
TopicReader → GrimoireHome, FileSystem (gray-matter parsing)
AgentPromptGenerator → CodebaseReader → FileSystem
```

### AI Pipeline (Direct Mode)
Three-phase pipeline using `LanguageModel.generateObject` with Effect Schema validation:
1. **Discovery** → `CodebaseOverview`
2. **Topic Planning** → `TopicProposalSet` (8-15 proposals)
3. **Topic Generation** → `GeneratedTopic` for each proposal

OpenRouter layer is composed inline in the init/analyze commands:
```
OpenRouterLanguageModel.layer() → OpenRouterClient.layerConfig() → FetchHttpClient.layer
```

## Development

```bash
npm install
npx tsx src/cli.ts --help        # run CLI directly
npm run typecheck                 # tsc --noEmit
```

### Testing end-to-end
```bash
npx tsx src/cli.ts init my-project
npx tsx src/cli.ts list                    # shows my-project
npx tsx src/cli.ts list my-project         # shows topics (empty until analyzed)
npx tsx src/cli.ts remove my-project       # clean up
```

## File Layout

```
src/
  cli.ts                          # Root entry point, layer composition
  commands/                       # CLI command definitions (init, analyze, list, show, remove)
  services/                       # Effect services (GrimoireHome, ProjectConfig, TopicReader, etc.)
  schemas/                        # Effect Schema definitions (project-config, topic, analysis)
  ai/                             # AI pipeline (prompts, tools, pipeline orchestration)
  lib/                            # Utilities (render, gitignore, file-tree)
```

## Notes

- The `@effect/ai` API uses `Tool`, `Toolkit`, `LanguageModel` (not `AiTool`/`AiToolkit`/`AiLanguageModel`)
- `LanguageModel.generateObject()` returns `GenerateObjectResponse` — access `.value` for the parsed object
- `Options.optional` in `@effect/cli` returns `Option<T>` — use `Option.getOrElse` / `Option.getOrUndefined`
