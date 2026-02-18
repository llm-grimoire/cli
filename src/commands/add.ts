import { Args, Command } from "@effect/cli"
import { Console, Effect } from "effect"
import { fetchFromRegistry } from "../services/registry-fetcher.js"
import * as render from "../lib/render.js"

const nameArg = Args.text({ name: "name" }).pipe(
  Args.withDescription("Grimoire name (e.g. 'effect-atom', '@effect/sql-pg')"),
)

export const addCommand = Command.make("add", {
  args: { name: nameArg },
}).pipe(
  Command.withDescription("Install a pre-built grimoire from the registry"),
  Command.withHandler(({ args }) =>
    Effect.gen(function* () {
      const name = args.name

      yield* Console.error("")

      const localName = yield* fetchFromRegistry(name)

      yield* Console.error(render.dim("Next steps:"))
      yield* Console.error(render.dim(`  grimoire list ${localName}`))
      yield* Console.error(render.dim(`  grimoire show ${localName} <topic>`))
      yield* Console.error("")
    }),
  ),
)
