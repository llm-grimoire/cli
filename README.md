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
grimoire show effect-atom overview
```

### Flow 2: Agent Mode (default)

Grimoire reads a codebase and emits a detailed prompt to stdout. Pipe it straight to your agent:

```bash
grimoire analyze my-lib --path ./src | claude
```

Works with GitHub repos too:

```bash
grimoire analyze effect-atom --github tim-smart/effect-atom | claude
```

For monorepo sub-packages, combine `--github` with `--path`:

```bash
grimoire analyze effect-sql --github effect-ts/effect --path packages/sql | claude
```

The prompt includes the codebase structure, key source files, and instructions for writing each topic. The agent writes directly to `~/.grimoire/projects/<name>/topics/`. Status messages go to stderr so piping works cleanly.

Best for: deep, high-quality documentation — the agent can read additional files and make judgement calls as it writes.

### Flow 3: API Mode

Grimoire calls an AI provider directly. No agent needed — topics are generated automatically.

Set any one of these keys (checked in this order):

```bash
export ANTHROPIC_API_KEY=sk-...    # uses claude-sonnet-4-5
export OPENAI_API_KEY=sk-...       # uses gpt-4o
export OPENROUTER_API_KEY=sk-...   # uses anthropic/claude-sonnet-4-5
```

Then run:

```bash
grimoire analyze my-lib --path ./src --mode api
grimoire analyze effect-atom --github tim-smart/effect-atom --mode api
grimoire analyze effect-sql --github effect-ts/effect --path packages/sql --mode api
```

Best for: quick results without manual steps.

## Reading the Docs

```bash
grimoire list                           # all projects
grimoire list my-lib                    # topics in a project
grimoire show my-lib overview           # read a topic
grimoire context my-lib                 # markdown snippet for agent instructions
```

`grimoire context` outputs a block you can paste into CLAUDE.md or a system prompt so your agent knows what topics are available and how to query them.

## All Commands

| Command | Purpose |
|---------|---------|
| `grimoire add <name>` | Pull pre-built grimoire from registry |
| `grimoire analyze <name> [--github\|--path] [--mode]` | Generate locally (creates project if needed) |
| `grimoire push <name>` | Contribute to the registry |
| `grimoire list [project]` | List projects or topics |
| `grimoire show <project> <topic>` | Read a topic |
| `grimoire context <project>` | Output agent instructions |
| `grimoire remove <project>` | Delete a project |

## How It Works

1. `analyze` creates `~/.grimoire/projects/<name>/` with a `grimoire.json` config (or reuses existing)
2. Analysis reads the codebase (respecting `.gitignore`) and either generates an agent prompt or calls an AI provider
3. Topics are markdown files with YAML frontmatter — no build step, read directly at runtime
4. `list`, `show`, and `context` parse frontmatter and render to the terminal
5. `add` pulls pre-built grimoires from the public registry
6. `push` helps you contribute your grimoire back to the registry

## Storage

Everything lives in `~/.grimoire` (override with `GRIMOIRE_HOME`):

```
~/.grimoire/
  projects/
    my-lib/
      grimoire.json
      topics/
        00-overview.md
        01-architecture.md
        ...
```

## Built With

- [Effect](https://effect.website) + [@effect/cli](https://github.com/Effect-TS/effect/tree/main/packages/cli)
- [@effect/ai](https://github.com/Effect-TS/effect/tree/main/packages/ai) providers: Anthropic, OpenAI, OpenRouter (API mode)

## License

MIT
