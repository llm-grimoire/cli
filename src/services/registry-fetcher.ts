import { FileSystem } from "@effect/platform"
import { Console, Effect, Schema } from "effect"
import { GrimoireHome } from "./grimoire-home.js"
import { ProjectConfig } from "../schemas/project-config.js"
import * as render from "../lib/render.js"

const REGISTRY_BASE = "https://llm-grimoire.dev"

const fetchJson = (url: string): Effect.Effect<unknown, Error> =>
  Effect.tryPromise({
    try: async () => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
      return res.json()
    },
    catch: (e) => new Error(`Failed to fetch ${url}: ${e}`),
  })

/**
 * Fetch a grimoire from the registry and install it locally.
 * Returns the local project name, or fails if not found.
 */
export const fetchFromRegistry = (ownerRepo: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const home = yield* GrimoireHome

    const [owner, repo] = ownerRepo.split("/")
    if (!owner || !repo) {
      return yield* Effect.fail(new Error(`Invalid registry name '${ownerRepo}'.`))
    }

    // Check if already exists locally under repo name
    const localName = repo.toLowerCase()
    const alreadyExists = yield* home.projectExists(localName)
    if (alreadyExists) {
      return localName
    }

    yield* Console.error(render.info(`Fetching '${ownerRepo}' from registry...`))

    const configJson = yield* fetchJson(
      `${REGISTRY_BASE}/api/v1/grimoires/${owner}/${repo}/index.json`,
    ).pipe(
      Effect.catchAll(() =>
        Effect.fail(new Error(`'${ownerRepo}' not found in the registry.`)),
      ),
    )

    yield* Schema.decodeUnknown(ProjectConfig)(configJson).pipe(
      Effect.mapError((e) => new Error(`Invalid grimoire config: ${e}`)),
    )

    yield* home.ensureHome()

    const projectDir = home.projectDir(localName)
    const topicsDir = `${projectDir}/topics`
    yield* fs.makeDirectory(topicsDir, { recursive: true })

    yield* fs.writeFileString(
      `${projectDir}/grimoire.json`,
      JSON.stringify(configJson, null, 2) + "\n",
    )

    const topicsResponse = yield* fetchJson(
      `${REGISTRY_BASE}/api/v1/grimoires/${owner}/${repo}/topics.json`,
    ).pipe(
      Effect.catchAll(() => Effect.succeed({ topics: [] as Array<{ slug: string; filename: string }> })),
    ) as Effect.Effect<{ topics: Array<{ slug: string; filename: string }> }>

    const topicList = topicsResponse.topics
    let downloaded = 0

    for (const topic of topicList) {
      const topicData = yield* fetchJson(
        `${REGISTRY_BASE}/api/v1/grimoires/${owner}/${repo}/topics/${topic.slug}.json`,
      ).pipe(Effect.catchAll(() => Effect.succeed(null)))

      if (topicData) {
        const { frontmatter, content } = topicData as { frontmatter: Record<string, unknown>; content: string }
        const yamlLines = Object.entries(frontmatter).map(([key, val]) => {
          if (Array.isArray(val)) return `${key}: [${val.join(", ")}]`
          return `${key}: ${val}`
        })
        const md = `---\n${yamlLines.join("\n")}\n---\n${content}`
        yield* fs.writeFileString(`${topicsDir}/${topic.filename}`, md)
        downloaded++
      }
    }

    yield* Console.error(render.success(`Added '${localName}' with ${downloaded} topics`))
    yield* Console.error("")

    return localName
  })

/** Check if a string looks like an owner/repo registry reference */
export const isRegistryRef = (name: string): boolean => name.includes("/")
