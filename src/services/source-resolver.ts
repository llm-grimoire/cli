import { Effect, Data } from "effect"
import { execFile, spawn } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

export class SourceResolverError extends Data.TaggedError("SourceResolverError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

export interface ResolvedSource {
  readonly codebasePath: string
  readonly cleanup?: () => Promise<void>
  readonly sourceRef?: string
}

const shallowClone = (url: string): Promise<string> =>
  new Promise((resolve, reject) => {
    mkdtemp(join(tmpdir(), "grimoire-")).then((tempDir) => {
      const proc = spawn("git", ["clone", "--depth", "1", url, tempDir], {
        stdio: "inherit",
      })
      proc.on("close", (code) =>
        code === 0 ? resolve(tempDir) : reject(new Error(`git clone failed (exit ${code})`)),
      )
      proc.on("error", reject)
    }).catch(reject)
  })

const getHeadSha = (dir: string): Promise<string | undefined> =>
  new Promise((resolve) => {
    execFile("git", ["rev-parse", "HEAD"], { cwd: dir }, (err, stdout) => {
      resolve(err ? undefined : stdout.trim())
    })
  })

const isFullUrl = (s: string) =>
  s.startsWith("https://") || s.startsWith("http://") || s.startsWith("git@")

export const resolveSource = (opts: {
  github?: string | undefined
  path?: string | undefined
}): Effect.Effect<ResolvedSource, SourceResolverError> =>
  Effect.gen(function* () {
    if (opts.github) {
      const url = isFullUrl(opts.github)
        ? opts.github
        : `https://github.com/${opts.github}`

      const tempDir = yield* Effect.tryPromise({
        try: () => shallowClone(url),
        catch: (e) => new SourceResolverError({ message: `Failed to clone ${url}`, cause: e }),
      })

      const sha = yield* Effect.tryPromise({
        try: () => getHeadSha(tempDir),
        catch: () => new SourceResolverError({ message: "Failed to read HEAD SHA" }),
      })

      const codebasePath = opts.path ? join(tempDir, opts.path) : tempDir
      const cleanup = () => rm(tempDir, { recursive: true, force: true })

      return sha
        ? { codebasePath, cleanup, sourceRef: sha }
        : { codebasePath, cleanup }
    }

    if (opts.path) {
      const codebasePath = resolve(process.cwd(), opts.path)
      return { codebasePath }
    }

    return yield* Effect.fail(
      new SourceResolverError({ message: "No source specified. Use --github or --path." }),
    )
  })
