# grimoire

Instant codebase documentation for AI agents and humans. Two ways to generate, one way to read.

## Why

AI agents waste context window exploring codebases — reading directory trees, opening files speculatively, rediscovering structure across sessions. Grimoire creates a curated reference that gives agents (and developers) the right information immediately.

## Install

Requires Node.js 20+.

```bash
npm install -g grimoire-gen
```

## Two Flows

### Flow 1: Agent Mode (default)

Grimoire reads your codebase and generates a detailed prompt. You hand the prompt to Claude Code (or any coding agent), and the agent writes the topic files.

```bash
grimoire init my-lib --target ./path/to/my-lib
# → writes prompt to ~/.grimoire/projects/my-lib/agent-prompt.md

# Give the prompt to your agent, e.g.:
claude "$(cat ~/.grimoire/projects/my-lib/agent-prompt.md)"
```

The prompt includes the codebase structure, key source files, and instructions for writing each topic. The agent writes directly to `~/.grimoire/projects/my-lib/topics/`.

Best for: deep, high-quality documentation — the agent can read additional files and make judgement calls as it writes.

### Flow 2: API Mode

Grimoire calls an AI provider directly. No agent needed — topics are generated automatically.

Set any one of these keys (checked in this order):

```bash
export ANTHROPIC_API_KEY=sk-...    # uses claude-sonnet-4-5
export OPENAI_API_KEY=sk-...       # uses gpt-4o
export OPENROUTER_API_KEY=sk-...   # uses anthropic/claude-sonnet-4-5
```

Then run:

```bash
grimoire init my-lib --target ./path/to/my-lib --mode api
```

Works with URLs too:

```bash
grimoire init effect-atom --target https://github.com/tim-smart/effect-atom --mode api
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
| `grimoire init <name> [--target url\|path] [--mode agent\|api]` | Create project + analyze |
| `grimoire analyze <project> [--target path] [--mode agent\|api]` | Rerun analysis |
| `grimoire list [project]` | List projects or topics |
| `grimoire show <project> <topic>` | Read a topic |
| `grimoire context <project>` | Output agent instructions |
| `grimoire remove <project>` | Delete a project |

## How It Works

1. `init` creates `~/.grimoire/projects/<name>/` with a `grimoire.json` config
2. Analysis reads the codebase (respecting `.gitignore`) and either generates an agent prompt or calls an AI provider
3. Topics are markdown files with YAML frontmatter — no build step, read directly at runtime
4. `list`, `show`, and `context` parse frontmatter and render to the terminal

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
