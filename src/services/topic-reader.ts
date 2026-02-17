import { Effect, Data } from "effect"
import { FileSystem } from "@effect/platform"
import { GrimoireHome } from "./grimoire-home.js"
import matter from "gray-matter"

export class TopicReaderError extends Data.TaggedError("TopicReaderError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

interface TopicEntry {
  slug: string
  title: string
  description: string
  order: number
  category: string
  tags: string[]
  relatedFiles: string[]
  content: string
  filePath: string
}

export class TopicReader extends Effect.Service<TopicReader>()(
  "TopicReader",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const home = yield* GrimoireHome

      const topicsDir = (projectName: string) =>
        `${home.projectDir(projectName)}/topics`

      const readAll = (projectName: string) =>
        Effect.gen(function* () {
          const dir = topicsDir(projectName)
          const exists = yield* fs.exists(dir)
          if (!exists) return [] as TopicEntry[]

          const files = yield* fs.readDirectory(dir)
          const mdFiles = files.filter((f) => f.endsWith(".md")).sort()

          const topics: TopicEntry[] = []
          for (const file of mdFiles) {
            const filePath = `${dir}/${file}`
            const raw = yield* fs.readFileString(filePath)
            const { data, content } = matter(raw)
            topics.push({
              slug: (data.slug as string) ?? file.replace(/\.md$/, "").replace(/^\d+-/, ""),
              title: (data.title as string) ?? file.replace(/\.md$/, ""),
              description: (data.description as string) ?? "",
              order: (data.order as number) ?? 0,
              category: (data.category as string) ?? "general",
              tags: (data.tags as string[]) ?? [],
              relatedFiles: (data.relatedFiles as string[]) ?? [],
              content: content.trim(),
              filePath,
            })
          }

          return topics.sort((a, b) => a.order - b.order)
        }).pipe(
          Effect.mapError(
            (cause) => new TopicReaderError({ message: `Failed to read topics for ${projectName}`, cause }),
          ),
        )

      const readOne = (projectName: string, slug: string) =>
        Effect.gen(function* () {
          const topics = yield* readAll(projectName)
          const topic = topics.find((t) => t.slug === slug)
          if (!topic) {
            return yield* Effect.fail(
              new TopicReaderError({ message: `Topic '${slug}' not found in project '${projectName}'` }),
            )
          }
          return topic
        })

      return { readAll, readOne }
    }),
  },
) {}
