import { Effect, Data } from "effect"
import { FileSystem } from "@effect/platform"
import { GrimoireHome } from "./grimoire-home.js"

export class TopicReaderError extends Data.TaggedError("TopicReaderError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

const parseFrontmatter = (raw: string): { data: Record<string, string>; content: string } => {
  if (!raw.startsWith("---\n")) return { data: {}, content: raw }
  const end = raw.indexOf("\n---\n", 4)
  if (end === -1) return { data: {}, content: raw }
  const data: Record<string, string> = {}
  for (const line of raw.slice(4, end).split("\n")) {
    const idx = line.indexOf(": ")
    if (idx !== -1) data[line.slice(0, idx)] = line.slice(idx + 2)
  }
  return { data, content: raw.slice(end + 5) }
}

const parseArray = (s: string | undefined): string[] => {
  if (!s || s === "[]") return []
  const inner = s.startsWith("[") ? s.slice(1, -1) : s
  return inner.split(",").map((v) => v.trim()).filter(Boolean)
}

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
            const { data, content } = parseFrontmatter(raw)
            topics.push({
              slug: data.slug ?? file.replace(/\.md$/, "").replace(/^\d+-/, ""),
              title: data.title ?? file.replace(/\.md$/, ""),
              description: data.description ?? "",
              order: Number(data.order ?? 0),
              category: data.category ?? "general",
              tags: parseArray(data.tags),
              relatedFiles: parseArray(data.relatedFiles),
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
