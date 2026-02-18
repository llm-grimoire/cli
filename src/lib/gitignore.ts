import { Effect } from "effect"
import { FileSystem } from "@effect/platform"

export interface GitignoreMatcher {
  readonly isIgnored: (path: string) => boolean
}

const parsePatterns = (content: string): ReadonlyArray<{ pattern: string; negated: boolean }> =>
  content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const negated = line.startsWith("!")
      const pattern = negated ? line.slice(1) : line
      return { pattern, negated }
    })

const patternToRegex = (pattern: string): RegExp => {
  // Strip leading slash before escaping — it just means "anchored to root"
  const anchored = pattern.startsWith("/")
  const cleaned = anchored ? pattern.slice(1) : pattern

  let regex = cleaned
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/\{\{GLOBSTAR\}\}/g, ".*")

  if (cleaned.endsWith("/")) {
    regex = regex.slice(0, -1) + "(/|$)"
  } else {
    regex = "(" + regex + "$|" + regex + "/)"
  }

  if (anchored) {
    regex = "^" + regex
  } else if (!cleaned.includes("/")) {
    regex = "(^|.*/)" + regex
  }

  return new RegExp(regex)
}

export const createMatcher = (content: string): GitignoreMatcher => {
  const patterns = parsePatterns(content)
  const compiled = patterns.map(({ pattern, negated }) => ({
    regex: patternToRegex(pattern),
    negated,
  }))

  return {
    isIgnored: (path: string) => {
      let ignored = false
      for (const { regex, negated } of compiled) {
        if (regex.test(path)) {
          ignored = !negated
        }
      }
      return ignored
    },
  }
}

const DEFAULT_IGNORES = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  ".next/",
  "coverage/",
  ".DS_Store",
  "*.lock",
  "bun.lock",
]

export const loadMatcher = (dir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const gitignorePath = `${dir}/.gitignore`
    const exists = yield* fs.exists(gitignorePath)
    const content = exists
      ? yield* fs.readFileString(gitignorePath)
      : ""
    const combined = DEFAULT_IGNORES.join("\n") + "\n" + content
    return createMatcher(combined)
  })
