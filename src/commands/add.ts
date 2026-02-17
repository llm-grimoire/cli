import { Args, Command } from "@effect/cli"
import { FileSystem } from "@effect/platform"
import { Console, Effect, Schema } from "effect"
import { GrimoireHome } from "../services/grimoire-home.js"
import { ProjectConfig } from "../schemas/project-config.js"
import * as render from "../lib/render.js"

const REGISTRY_REPO = "llm-grimoire/registry"
const REGISTRY_BRANCH = "main"

const nameArg = Args.text({ name: "name" }).pipe(
  Args.withDescription("Registry name — 'owner/repo' for exact match, or a search term"),
)

const rawUrl = (path: string) =>
  `https://raw.githubusercontent.com/${REGISTRY_REPO}/${REGISTRY_BRANCH}/${path}`

const fetchText = (url: string): Effect.Effect<string, Error> =>
  Effect.tryPromise({
    try: async () => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
      return res.text()
    },
    catch: (e) => new Error(`Failed to fetch ${url}: ${e}`),
  })

const fetchJson = (url: string): Effect.Effect<unknown, Error> =>
  fetchText(url).pipe(Effect.map((text) => JSON.parse(text)))

export const addCommand = Command.make("add", {
  args: { name: nameArg },
}).pipe(
  Command.withDescription("Install a pre-built grimoire from the registry"),
  Command.withHandler(({ args }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const home = yield* GrimoireHome

      const name = args.name

      // Determine registry path — prefixed under packages/
      const registryPath = `packages/${name}`

      yield* Console.error("")
      yield* Console.error(render.info(`Fetching grimoire for '${name}' from registry...`))

      // Fetch grimoire.json from registry
      const configUrl = rawUrl(`${registryPath}/grimoire.json`)
      const configJson = yield* fetchJson(configUrl).pipe(
        Effect.catchAll(() =>
          Effect.fail(new Error(
            `Could not find '${name}' in the registry.\n` +
            `  Check https://github.com/${REGISTRY_REPO} for available grimoires.`,
          )),
        ),
      )

      const config = yield* Schema.decodeUnknown(ProjectConfig)(configJson).pipe(
        Effect.mapError((e) => new Error(`Invalid grimoire.json in registry: ${e}`)),
      )

      // Check if project already exists locally
      const localName = config.name
      const exists = yield* home.projectExists(localName)
      if (exists) {
        yield* Console.error(render.error(`Project '${localName}' already exists locally. Remove it first with 'grimoire remove ${localName}'.`))
        return
      }

      yield* home.ensureHome()

      // Create project directory
      const projectDir = home.projectDir(localName)
      const topicsDir = `${projectDir}/topics`
      yield* fs.makeDirectory(topicsDir, { recursive: true })

      // Write config
      yield* fs.writeFileString(
        `${projectDir}/grimoire.json`,
        JSON.stringify(configJson, null, 2) + "\n",
      )

      // Fetch topic listing via GitHub API
      const apiUrl = `https://api.github.com/repos/${REGISTRY_REPO}/contents/${registryPath}/topics`
      const listing = yield* fetchJson(apiUrl).pipe(
        Effect.catchAll(() => Effect.succeed([] as Array<{ name: string }>)),
      ) as Effect.Effect<Array<{ name: string }>>

      const mdFiles = (listing as Array<{ name: string }>).filter(
        (f) => f.name.endsWith(".md"),
      )

      let downloaded = 0
      for (const file of mdFiles) {
        const content = yield* fetchText(rawUrl(`${registryPath}/topics/${file.name}`)).pipe(
          Effect.catchAll(() => Effect.succeed("")),
        )
        if (content) {
          yield* fs.writeFileString(`${topicsDir}/${file.name}`, content)
          downloaded++
        }
      }

      yield* Console.error("")
      yield* Console.error(render.success(`Added '${localName}' with ${downloaded} topics`))
      yield* Console.error("")
      yield* Console.error(render.dim("Next steps:"))
      yield* Console.error(render.dim(`  grimoire list ${localName}`))
      yield* Console.error(render.dim(`  grimoire show ${localName} overview`))
      yield* Console.error("")
    }),
  ),
)
