import { Effect, Data } from "effect"
import { FileSystem } from "@effect/platform"
import { GrimoireHome } from "./grimoire-home.js"
import { ProjectConfig, decodeProjectConfig, encodeProjectConfig } from "../schemas/project-config.js"

const CONFIG_FILE = "grimoire.json"

export class ProjectConfigError extends Data.TaggedError("ProjectConfigError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class ProjectConfigService extends Effect.Service<ProjectConfigService>()(
  "ProjectConfigService",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const home = yield* GrimoireHome

      const configPath = (projectName: string) =>
        `${home.projectDir(projectName)}/${CONFIG_FILE}`

      const read = (projectName: string) =>
        Effect.gen(function* () {
          const path = configPath(projectName)
          const exists = yield* fs.exists(path)
          if (!exists) {
            return yield* Effect.fail(
              new ProjectConfigError({ message: `Project '${projectName}' not found` }),
            )
          }
          const raw = yield* fs.readFileString(path)
          const json = JSON.parse(raw)
          return yield* decodeProjectConfig(json).pipe(
            Effect.mapError(
              (e) => new ProjectConfigError({ message: `Invalid ${CONFIG_FILE}`, cause: e }),
            ),
          )
        })

      const write = (projectName: string, config: ProjectConfig) =>
        Effect.gen(function* () {
          const dir = home.projectDir(projectName)
          yield* fs.makeDirectory(dir, { recursive: true })
          const encoded = yield* encodeProjectConfig(config).pipe(
            Effect.mapError(
              (e) => new ProjectConfigError({ message: "Failed to encode config", cause: e }),
            ),
          )
          yield* fs.writeFileString(configPath(projectName), JSON.stringify(encoded, null, 2) + "\n")
        })

      const exists = (projectName: string) => fs.exists(configPath(projectName))

      return { read, write, exists }
    }),
  },
) {}
