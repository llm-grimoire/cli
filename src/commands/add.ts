import { Args, Command } from "@effect/cli"
import { FileSystem } from "@effect/platform"
import { Console, Effect, Schema } from "effect"
import { GrimoireHome } from "../services/grimoire-home.js"
import { ProjectConfig } from "../schemas/project-config.js"
import * as render from "../lib/render.js"

const REGISTRY_BASE = "https://llm-grimoire.dev"

const nameArg = Args.text({ name: "name" }).pipe(
  Args.withDescription("Registry name — 'owner/repo' for exact match, or a search term"),
)

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

      yield* Console.error("")
      yield* Console.error(render.info(`Fetching grimoire for '${name}' from registry...`))

      // Fetch grimoire metadata from API
      const [owner, repo] = name.split("/")
      if (!owner || !repo) {
        yield* Effect.fail(new Error(
          `Invalid name '${name}'. Use 'owner/repo' format (e.g. 'tim-smart/effect-atom').`,
        ))
        return
      }

      const configJson = yield* fetchJson(
        `${REGISTRY_BASE}/api/v1/grimoires/${owner}/${repo}/index.json`,
      ).pipe(
        Effect.catchAll(() =>
          Effect.fail(new Error(
            `Could not find '${name}' in the registry.\n` +
            `  Check ${REGISTRY_BASE} for available grimoires.`,
          )),
        ),
      )

      const config = yield* Schema.decodeUnknown(ProjectConfig)(configJson).pipe(
        Effect.mapError((e) => new Error(`Invalid grimoire config in registry: ${e}`)),
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

      // Fetch topic listing from API
      const topicsResponse = yield* fetchJson(
        `${REGISTRY_BASE}/api/v1/grimoires/${owner}/${repo}/topics.json`,
      ).pipe(
        Effect.catchAll(() => Effect.succeed({ topics: [] } as { topics: Array<{ slug: string; filename: string }> })),
      ) as Effect.Effect<{ topics: Array<{ slug: string; filename: string }> }>

      const topicList = (topicsResponse as { topics: Array<{ slug: string; filename: string }> }).topics

      let downloaded = 0
      for (const topic of topicList) {
        const topicData = yield* fetchJson(
          `${REGISTRY_BASE}/api/v1/grimoires/${owner}/${repo}/topics/${topic.slug}.json`,
        ).pipe(
          Effect.catchAll(() => Effect.succeed(null)),
        )

        if (topicData) {
          const { frontmatter, content } = topicData as { frontmatter: Record<string, unknown>; content: string }
          // Reconstruct the markdown file with frontmatter
          const yamlLines = Object.entries(frontmatter).map(([key, val]) => {
            if (Array.isArray(val)) return `${key}: [${val.join(", ")}]`
            return `${key}: ${val}`
          })
          const md = `---\n${yamlLines.join("\n")}\n---\n${content}`
          yield* fs.writeFileString(`${topicsDir}/${topic.filename}`, md)
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
