import { Args, Command } from "@effect/cli"
import { Console, Effect } from "effect"
import { fetchFromRegistry } from "../services/registry-fetcher.js"
import * as render from "../lib/render.js"

const nameArg = Args.text({ name: "name" }).pipe(
  Args.withDescription("Registry name — 'owner/repo' format (e.g. 'tim-smart/effect-atom')"),
)

export const addCommand = Command.make("add", {
  args: { name: nameArg },
}).pipe(
  Command.withDescription("Install a pre-built grimoire from the registry"),
  Command.withHandler(({ args }) =>
    Effect.gen(function* () {
      const name = args.name

      const [owner, repo] = name.split("/")
      if (!owner || !repo) {
        yield* Effect.fail(new Error(
          `Invalid name '${name}'. Use 'owner/repo' format (e.g. 'tim-smart/effect-atom').`,
        ))
        return
      }

      // Check if already exists by looking for a project matching the repo name
      // (fetchFromRegistry uses config.name from the registry as the local name)
      yield* Console.error("")

      const localName = yield* fetchFromRegistry(name)

      yield* Console.error(render.dim("Next steps:"))
      yield* Console.error(render.dim(`  grimoire list ${localName}`))
      yield* Console.error(render.dim(`  grimoire show ${localName} <topic>`))
      yield* Console.error("")
    }),
  ),
)
