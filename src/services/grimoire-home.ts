import { Effect, Data } from "effect"
import { FileSystem } from "@effect/platform"
import { homedir } from "node:os"

export class GrimoireHomeError extends Data.TaggedError("GrimoireHomeError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class GrimoireHome extends Effect.Service<GrimoireHome>()(
  "GrimoireHome",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem

      const root = process.env["GRIMOIRE_HOME"] ?? `${homedir()}/.grimoire`
      const projectsRoot = `${root}/projects`

      const ensureHome = () =>
        fs.makeDirectory(projectsRoot, { recursive: true }).pipe(
          Effect.mapError(
            (cause) => new GrimoireHomeError({ message: "Failed to create ~/.grimoire", cause }),
          ),
        )

      const projectDir = (name: string) => `${projectsRoot}/${name}`

      const projectExists = (name: string) => fs.exists(projectDir(name))

      const listProjects = () =>
        Effect.gen(function* () {
          const exists = yield* fs.exists(projectsRoot)
          if (!exists) return [] as string[]
          const entries = yield* fs.readDirectory(projectsRoot)
          const dirs: string[] = []
          for (const entry of entries) {
            const stat = yield* fs.stat(`${projectsRoot}/${entry}`)
            if (stat.type === "Directory") {
              dirs.push(entry)
            }
          }
          return dirs.sort()
        }).pipe(
          Effect.mapError(
            (cause) => new GrimoireHomeError({ message: "Failed to list projects", cause }),
          ),
        )

      return { root, projectsRoot, ensureHome, projectDir, projectExists, listProjects }
    }),
  },
) {}
