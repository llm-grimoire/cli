import { Args, Command } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { GrimoireHome } from "../services/grimoire-home.js"
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

export const searchCommand = Command.make("search", {
  args: { query: queryArg },
}).pipe(
  Command.withDescription("Browse available grimoires in the registry"),
  Command.withHandler(({ args }) =>
    Effect.gen(function* () {
      const home = yield* GrimoireHome
      const query = Option.getOrUndefined(args.query)?.toLowerCase()

      const response = yield* Effect.tryPromise({
        try: async () => {
          const res = await fetch(`${REGISTRY_BASE}/api/v1/grimoires/index.json`)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.json() as Promise<{ grimoires: RegistryGrimoire[] }>
        },
        catch: () => new Error("Failed to fetch registry. Check your internet connection."),
      })

      let grimoires = response.grimoires

      if (query) {
        grimoires = grimoires.filter(
          (g) =>
            g.name.toLowerCase().includes(query) ||
            g.owner.toLowerCase().includes(query) ||
            g.repo.toLowerCase().includes(query) ||
            g.description.toLowerCase().includes(query),
        )
      }

      if (grimoires.length === 0) {
        yield* Console.log("")
        if (query) {
          yield* Console.log(render.dim(`No grimoires matching '${query}'.`))
        } else {
          yield* Console.log(render.dim("No grimoires in the registry yet."))
        }
        yield* Console.log("")
        return
      }

      // Check which are installed locally
      const localProjects = yield* home.listProjects()
      const localSet = new Set(localProjects)

      yield* Console.log("")
      yield* Console.log(render.banner(`Registry${query ? ` — matching '${query}'` : ""}`))
      yield* Console.log("")

      for (const g of grimoires) {
        const ref = `${g.owner}/${g.repo}`
        const installed = localSet.has(ref)
        const status = installed ? " ✓ installed" : ""
        yield* Console.log(render.label(ref, g.description))
        yield* Console.log(render.dim(`  ${g.topicCount} topics${status}`))
      }

      yield* Console.log("")
      yield* Console.log(render.dim("Install with: grimoire add <owner/repo>"))
      yield* Console.log("")
    }),
  ),
)
