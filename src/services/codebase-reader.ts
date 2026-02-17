import { Effect, Data } from "effect"
import { FileSystem } from "@effect/platform"
import { loadMatcher } from "../lib/gitignore.js"
import { readTree, formatTree, type FileEntry } from "../lib/file-tree.js"

export class CodebaseReaderError extends Data.TaggedError("CodebaseReaderError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class CodebaseReader extends Effect.Service<CodebaseReader>()(
  "CodebaseReader",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem

      const getFileTree = (rootDir: string, maxDepth = 5) =>
        Effect.gen(function* () {
          const matcher = yield* loadMatcher(rootDir)
          const entries = yield* readTree(rootDir, matcher, maxDepth)
          return { entries, formatted: formatTree(entries) }
        }).pipe(
          Effect.mapError(
            (cause) => new CodebaseReaderError({ message: "Failed to read file tree", cause }),
          ),
        )

      const readFile = (filePath: string) =>
        fs.readFileString(filePath).pipe(
          Effect.mapError(
            (cause) => new CodebaseReaderError({ message: `Failed to read file: ${filePath}`, cause }),
          ),
        )

      const readMultipleFiles = (filePaths: ReadonlyArray<string>) =>
        Effect.all(
          filePaths.map((p) =>
            readFile(p).pipe(
              Effect.map((content) => ({ path: p, content })),
            ),
          ),
          { concurrency: 10 },
        )

      const findKeyFiles = (rootDir: string) =>
        Effect.gen(function* () {
          const matcher = yield* loadMatcher(rootDir)
          const entries = yield* readTree(rootDir, matcher, 3)
          const keyPatterns = [
            /^package\.json$/,
            /^README\.md$/i,
            /^src\/index\.(ts|js|tsx|jsx)$/,
            /^src\/main\.(ts|js|tsx|jsx)$/,
            /^src\/app\.(ts|js|tsx|jsx)$/,
            /^src\/[^/]+\.(ts|js|tsx|jsx)$/,
            /^src\/lib\/[^/]+\.(ts|js|tsx|jsx)$/,
            /^lib\/[^/]+\.(ts|js|tsx|jsx)$/,
          ]
          return entries
            .filter((e) => !e.isDirectory)
            .filter((e) => keyPatterns.some((p) => p.test(e.relativePath)))
            .map((e) => e.path)
        }).pipe(
          Effect.mapError(
            (cause) => new CodebaseReaderError({ message: "Failed to find key files", cause }),
          ),
        )

      const searchFiles = (rootDir: string, pattern: string) =>
        Effect.gen(function* () {
          const matcher = yield* loadMatcher(rootDir)
          const entries = yield* readTree(rootDir, matcher)
          const regex = new RegExp(pattern, "i")
          return entries
            .filter((e) => !e.isDirectory)
            .filter((e) => regex.test(e.relativePath))
            .map((e) => e.path)
        }).pipe(
          Effect.mapError(
            (cause) => new CodebaseReaderError({ message: `Failed to search files: ${pattern}`, cause }),
          ),
        )

      const grepCodebase = (rootDir: string, pattern: string, fileGlob?: string) =>
        Effect.gen(function* () {
          const matcher = yield* loadMatcher(rootDir)
          const entries = yield* readTree(rootDir, matcher)
          const regex = new RegExp(pattern, "gi")
          const globRegex = fileGlob ? new RegExp(fileGlob.replace(/\*/g, ".*")) : null

          const results: Array<{ path: string; line: number; text: string }> = []

          for (const entry of entries) {
            if (entry.isDirectory) continue
            if (globRegex && !globRegex.test(entry.relativePath)) continue

            const content = yield* fs.readFileString(entry.path).pipe(Effect.orElseSucceed(() => ""))
            const lines = content.split("\n")
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i]!)) {
                results.push({ path: entry.relativePath, line: i + 1, text: lines[i]! })
              }
              regex.lastIndex = 0
            }
          }

          return results
        }).pipe(
          Effect.mapError(
            (cause) => new CodebaseReaderError({ message: `Failed to grep: ${pattern}`, cause }),
          ),
        )

      return { getFileTree, readFile, readMultipleFiles, findKeyFiles, searchFiles, grepCodebase }
    }),
  },
) {}
