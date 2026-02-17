import { Args, Command } from "@effect/cli"
import { Console, Effect } from "effect"
import { FileSystem } from "@effect/platform"
import { GrimoireHome } from "../services/grimoire-home.js"
import * as render from "../lib/render.js"

const projectArg = Args.text({ name: "project" }).pipe(
  Args.withDescription("Project name to remove"),
)

export const removeCommand = Command.make("remove", {
  args: { project: projectArg },
}).pipe(
  Command.withDescription("Remove a project"),
  Command.withHandler(({ args }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const home = yield* GrimoireHome

      const exists = yield* home.projectExists(args.project)
      if (!exists) {
        yield* Console.log(render.error(`Project '${args.project}' not found`))
        return
      }

      const projectDir = home.projectDir(args.project)
      yield* fs.remove(projectDir, { recursive: true })

      yield* Console.log("")
      yield* Console.log(render.success(`Removed project '${args.project}'`))
      yield* Console.log("")
    }),
  ),
)
