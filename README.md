# grimoire

Instant codebase documentation for AI agents and humans. Generate locally, pull from a shared registry, or contribute your own.

## Why

AI agents waste context window exploring codebases — reading directory trees, opening files speculatively, rediscovering structure across sessions. Grimoire creates a curated reference that gives agents (and developers) the right information immediately.

## Install

Requires Node.js 20+.

```bash
npm install -g @llm-grimoire/cli
```

## Three Flows

### Flow 1: Registry (instant)

Pull pre-built documentation from the public registry — no AI tokens needed:

```bash
grimoire add tim-smart/effect-atom
grimoire show tim-smart/effect-atom overview
```

### Flow 2: Agent Mode (default)

Grimoire reads a codebase and emits a detailed prompt to stdout. Pipe it straight to your agent:

```bash
# GitHub repo — name defaults to owner/repo
grimoire conjure --github tim-smart/effect-atom | claude

# Monorepo sub-package — name is required
grimoire conjure effect-sql --github effect-ts/effect --path packages/sql | claude

# Local path — name is required
grimoire conjure my-lib --path ./src | claude
```

Use `--hint` to guide the AI with additional context:

```bash
grimoire conjure --github owner/repo --hint "This repo has exercises organized by topic"
```

The prompt includes the codebase structure, key source files, and instructions for writing each topic. The agent writes directly to `~/.grimoire/projects/<name>/topics/`. Status messages go to stderr so piping works cleanly.

Best for: deep, high-quality documentation — the agent can read additional files and make judgement calls as it writes.

### Flow 3: API Mode

Grimoire calls an AI provider directly. No agent needed — topics are generated automatically.

Set any one of these keys (checked in this order):

```bash
export ANTHROPIC_API_KEY=sk-...    # uses claude-sonnet-4-5
export OPENAI_API_KEY=sk-...       # uses gpt-4o
export OPENROUTER_API_KEY=sk-...   # uses anthropic/claude-opus-4.5
```

Then run:

```bash
grimoire conjure --github tim-smart/effect-atom --mode api
grimoire conjure effect-sql --github effect-ts/effect --path packages/sql --mode api
grimoire conjure my-lib --path ./src --mode api
```

Best for: quick results without manual steps.

## Reading the Docs

```bash
grimoire list                                # all projects
grimoire list tim-smart/effect-atom          # topics in a project
grimoire show tim-smart/effect-atom overview # read a topic
grimoire incant tim-smart/effect-atom        # markdown snippet for agent instructions
```

`grimoire incant` outputs a block you can paste into CLAUDE.md or a system prompt so your agent knows what topics are available and how to query them.

## All Commands

| Command | Purpose |
|---------|---------|
| `grimoire search [query]` | Browse and install from the registry (interactive) |
| `grimoire add <owner/repo>` | Pull pre-built grimoire from registry |
| `grimoire conjure [name] [--github] [--path] [--mode] [--hint]` | Generate docs from a codebase |
| `grimoire push <name>` | Contribute to the registry |
| `grimoire list [project]` | List projects or topics |
| `grimoire show <project> <topic>` | Read a topic |
| `grimoire incant <project>` | Output agent instructions |
| `grimoire remove <project>` | Delete a project |

## Naming

- **Registry projects** use `owner/repo` (e.g. `tim-smart/effect-atom`) — same as GitHub
- **`conjure --github`** defaults to `owner/repo` as the local name
- **`conjure --github --path`** (monorepo) requires an explicit name
- **`conjure --path`** (local) requires an explicit name

## How It Works

1. `conjure` creates `~/.grimoire/projects/<name>/` with a `grimoire.json` config (or reuses existing)
2. Analysis reads the codebase (respecting `.gitignore`) and either generates an agent prompt or calls an AI provider
3. Topics are markdown files with YAML frontmatter — no build step, read directly at runtime
4. `list`, `show`, and `incant` parse frontmatter and render to the terminal
5. `add` pulls pre-built grimoires from the public registry at [llm-grimoire.dev](https://llm-grimoire.dev)
6. `push` helps you contribute your grimoire back to the registry

## Storage

Everything lives in `~/.grimoire` (override with `GRIMOIRE_HOME`):

```
~/.grimoire/
  projects/
    tim-smart/
      effect-atom/
        grimoire.json
        topics/
          00-overview.md
          01-architecture.md
          ...
    my-lib/
      grimoire.json
      topics/
        ...
```

## Built With

- [Effect](https://effect.website) + [@effect/cli](https://github.com/Effect-TS/effect/tree/main/packages/cli)
- [@effect/ai](https://github.com/Effect-TS/effect/tree/main/packages/ai) providers: Anthropic, OpenAI, OpenRouter (API mode)

## License

MIT
