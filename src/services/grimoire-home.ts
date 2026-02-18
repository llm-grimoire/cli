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
            if (entry.startsWith(".")) continue
            const entryPath = `${projectsRoot}/${entry}`
            const stat = yield* fs.stat(entryPath)
            if (stat.type === "Directory") {
              // Check if this is a direct project (has grimoire.json)
              const hasConfig = yield* fs.exists(`${entryPath}/grimoire.json`)
              if (hasConfig) {
                dirs.push(entry)
              } else {
                // Check for owner/repo nesting
                const subEntries = yield* fs.readDirectory(entryPath)
                for (const sub of subEntries) {
                  if (sub.startsWith(".")) continue
                  const subPath = `${entryPath}/${sub}`
                  const subStat = yield* fs.stat(subPath)
                  if (subStat.type === "Directory") {
                    const subHasConfig = yield* fs.exists(`${subPath}/grimoire.json`)
                    if (subHasConfig) {
                      dirs.push(`${entry}/${sub}`)
                    }
                  }
                }
              }
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
