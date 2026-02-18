import { Args, Command, Prompt } from "@effect/cli"
import * as Terminal from "@effect/platform/Terminal"
import { Console, Data, Effect, Option } from "effect"
import pc from "picocolors"
import { GrimoireHome } from "../services/grimoire-home.js"
import { fetchFromRegistry } from "../services/registry-fetcher.js"
import * as render from "../lib/render.js"

const REGISTRY_BASE = "https://llm-grimoire.dev"

const queryArg = Args.text({ name: "query" }).pipe(
  Args.withDescription("Filter grimoires by name or description"),
  Args.optional,
)

interface RegistryGrimoire {
  name: string
  owner: string
  repo: string
  description: string
  topicCount: number
  version: string
}

// ---------------------------------------------------------------------------
// Interactive search prompt
// ---------------------------------------------------------------------------

interface SearchState {
  readonly query: string
  readonly cursor: number
  readonly grimoires: ReadonlyArray<RegistryGrimoire>
  readonly filtered: ReadonlyArray<RegistryGrimoire>
  readonly installed: ReadonlySet<string>
}

type SearchAction = Prompt.Prompt.Action<SearchState, RegistryGrimoire | null>

const Action = Data.taggedEnum<Prompt.Prompt.ActionDefinition>()

const MAX_VISIBLE = 8

function filterGrimoires(
  grimoires: ReadonlyArray<RegistryGrimoire>,
  query: string,
): ReadonlyArray<RegistryGrimoire> {
  if (!query) return grimoires
  const q = query.toLowerCase()
  return grimoires.filter(
    (g) =>
      g.name.toLowerCase().includes(q) ||
      g.owner.toLowerCase().includes(q) ||
      g.repo.toLowerCase().includes(q) ||
      g.description.toLowerCase().includes(q),
  )
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text
}

/** Count terminal lines produced by renderFrame for a given state. */
function lineCount(filtered: ReadonlyArray<RegistryGrimoire>): number {
  // prompt + blank + (items | "No matches") + blank + help
  const itemLines = filtered.length === 0 ? 1 : Math.min(filtered.length, MAX_VISIBLE)
  return 1 + 1 + itemLines + 1 + 1
}

function renderFrame(state: SearchState): string {
  const lines: string[] = []

  // Prompt line
  const cursor = state.query.length > 0 ? "" : pc.dim("type to filter")
  lines.push(
    `${pc.cyan("?")} ${pc.bold("Search grimoires")} ${pc.dim("›")} ${state.query}${cursor}`,
  )
  lines.push("")

  if (state.filtered.length === 0) {
    lines.push(pc.dim("  No matches"))
  } else {
    const total = state.filtered.length
    const visible = Math.min(total, MAX_VISIBLE)
    let start = state.cursor - Math.floor(visible / 2)
    start = Math.max(0, Math.min(start, total - visible))
    const end = start + visible

    for (let i = start; i < end; i++) {
      const g = state.filtered[i]!
      const ref = `${g.owner}/${g.repo}`
      const isSelected = i === state.cursor
      const installed = state.installed.has(ref)

      const pointer = isSelected ? pc.cyan("❯") : " "
      const name = isSelected ? pc.cyan(ref) : ref
      const desc = pc.dim(truncate(g.description, 50))
      const topics = pc.dim(`${g.topicCount} topics`)
      const badge = installed ? pc.green(" ✓") : ""

      lines.push(`${pointer} ${name} ${pc.dim("—")} ${desc} (${topics})${badge}`)
    }
  }

  lines.push("")
  lines.push(pc.dim("  ↑↓ navigate · enter install · esc cancel"))

  return "\x1b[?25l" + lines.join("\n")
}

function handleRender(
  _state: SearchState,
  action: SearchAction,
): Effect.Effect<string, never, Prompt.Prompt.Environment> {
  return Action.$match(action, {
    Beep: () => Effect.succeed("\x07"),
    NextFrame: ({ state }: { state: SearchState }) => Effect.succeed(renderFrame(state)),
    Submit: ({ value }: { value: RegistryGrimoire | null }) => {
      if (value) {
        const ref = `${value.owner}/${value.repo}`
        return Effect.succeed(
          `${pc.green("✓")} ${pc.bold("Search grimoires")} ${pc.dim("›")} ${ref}\n`,
        )
      }
      return Effect.succeed("")
    },
  })
}

function handleProcess(
  input: Terminal.UserInput,
  state: SearchState,
): Effect.Effect<SearchAction> {
  const char = Option.getOrUndefined(input.input)

  switch (input.key.name) {
    case "up":
    case "k": {
      if (state.filtered.length === 0) return Effect.succeed(Action.Beep())
      const cursor = state.cursor <= 0 ? state.filtered.length - 1 : state.cursor - 1
      return Effect.succeed(Action.NextFrame({ state: { ...state, cursor } }))
    }
    case "down":
    case "j": {
      if (state.filtered.length === 0) return Effect.succeed(Action.Beep())
      const cursor = state.cursor >= state.filtered.length - 1 ? 0 : state.cursor + 1
      return Effect.succeed(Action.NextFrame({ state: { ...state, cursor } }))
    }
    case "enter":
    case "return": {
      const selected = state.filtered[state.cursor]
      if (!selected) return Effect.succeed(Action.Beep())
      return Effect.succeed(Action.Submit({ value: selected }))
    }
    case "escape": {
      return Effect.succeed(Action.Submit({ value: null }))
    }
    case "backspace":
    case "delete": {
      if (state.query.length === 0) return Effect.succeed(Action.Beep())
      const query = state.query.slice(0, -1)
      const filtered = filterGrimoires(state.grimoires, query)
      const cursor = Math.min(state.cursor, Math.max(0, filtered.length - 1))
      return Effect.succeed(Action.NextFrame({ state: { ...state, query, filtered, cursor } }))
    }
    default: {
      if (char && char.length === 1 && !input.key.ctrl && !input.key.meta) {
        const query = state.query + char
        const filtered = filterGrimoires(state.grimoires, query)
        const cursor = Math.min(state.cursor, Math.max(0, filtered.length - 1))
        return Effect.succeed(Action.NextFrame({ state: { ...state, query, filtered, cursor } }))
      }
      return Effect.succeed(Action.Beep())
    }
  }
}

function handleClear(
  state: SearchState,
  _action: SearchAction,
): Effect.Effect<string, never, Prompt.Prompt.Environment> {
  const count = lineCount(state.filtered)
  if (count <= 1) return Effect.succeed("\x1b[G\x1b[J")
  return Effect.succeed(`\x1b[${count - 1}A\x1b[G\x1b[J`)
}

function makeSearchPrompt(
  grimoires: ReadonlyArray<RegistryGrimoire>,
  installed: ReadonlySet<string>,
): Prompt.Prompt<RegistryGrimoire | null> {
  const initialState: SearchState = {
    query: "",
    cursor: 0,
    grimoires,
    filtered: grimoires,
    installed,
  }
  return Prompt.custom(initialState, {
    render: handleRender,
    process: handleProcess,
    clear: handleClear,
  })
}

// ---------------------------------------------------------------------------
// Static search (non-interactive)
// ---------------------------------------------------------------------------

function staticSearch(
  query: string,
  grimoires: ReadonlyArray<RegistryGrimoire>,
  localSet: ReadonlySet<string>,
) {
  return Effect.gen(function* () {
    const q = query.toLowerCase()
    const filtered = grimoires.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.owner.toLowerCase().includes(q) ||
        g.repo.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q),
    )

    if (filtered.length === 0) {
      yield* Console.log("")
      yield* Console.log(render.dim(`No grimoires matching '${query}'.`))
      yield* Console.log("")
      return
    }

    yield* Console.log("")
    yield* Console.log(render.banner(`Registry — matching '${query}'`))
    yield* Console.log("")

    for (const g of filtered) {
      const ref = `${g.owner}/${g.repo}`
      const installed = localSet.has(ref)
      const status = installed ? " ✓ installed" : ""
      yield* Console.log(render.label(ref, g.description))
      yield* Console.log(render.dim(`  ${g.topicCount} topics${status}`))
    }

    yield* Console.log("")
    yield* Console.log(render.dim("Install with: grimoire add <owner/repo>"))
    yield* Console.log("")
  })
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export const searchCommand = Command.make("search", {
  args: { query: queryArg },
}).pipe(
  Command.withDescription("Browse available grimoires in the registry"),
  Command.withHandler(({ args }) =>
    Effect.gen(function* () {
      const home = yield* GrimoireHome
      const query = Option.getOrUndefined(args.query)

      const response = yield* Effect.tryPromise({
        try: async () => {
          const res = await fetch(`${REGISTRY_BASE}/api/v1/grimoires/index.json`)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.json() as Promise<{ grimoires: RegistryGrimoire[] }>
        },
        catch: () => new Error("Failed to fetch registry. Check your internet connection."),
      })

      const grimoires = response.grimoires

      if (grimoires.length === 0) {
        yield* Console.log("")
        yield* Console.log(render.dim("No grimoires in the registry yet."))
        yield* Console.log("")
        return
      }

      const localProjects = yield* home.listProjects()
      const localSet = new Set(localProjects)

      if (query) {
        yield* staticSearch(query, grimoires, localSet)
      } else {
        const selected = yield* Prompt.run(makeSearchPrompt(grimoires, localSet)).pipe(
          Effect.catchTag("QuitException", () => Effect.succeed(null)),
        )

        if (selected) {
          const ref = `${selected.owner}/${selected.repo}`
          if (localSet.has(ref)) {
            yield* Console.log(render.dim(`'${ref}' is already installed.`))
          } else {
            yield* fetchFromRegistry(ref)
          }
        }
      }
    }),
  ),
)
