import { Args, Command, Options } from "@effect/cli"
import { FileSystem } from "@effect/platform"
import { Console, Effect, Option } from "effect"
import { ProjectConfig } from "../schemas/project-config.js"
import { ProjectConfigService } from "../services/project-config.js"
import { GrimoireHome } from "../services/grimoire-home.js"
import { AgentPromptGenerator } from "../services/agent-prompt-generator.js"
import { TopicWriter } from "../services/topic-writer.js"
import { resolveSource } from "../services/source-resolver.js"
import { resolveProvider } from "../ai/provider.js"
import * as render from "../lib/render.js"

const nameArg = Args.text({ name: "name" }).pipe(
  Args.withDescription("Project name — required for local paths and monorepo sub-packages, optional with --github"),
  Args.optional,
)

const githubOption = Options.text("github").pipe(
  Options.withDescription("GitHub owner/repo (e.g. 'tim-smart/effect-atom')"),
  Options.optional,
)

const pathOption = Options.text("path").pipe(
  Options.withDescription("Local path or subpath within a GitHub repo"),
  Options.optional,
)

const modeOption = Options.choice("mode", ["agent", "api"]).pipe(
  Options.withDescription("Analysis mode: 'agent' emits prompt to stdout, 'api' calls AI directly"),
  Options.withDefault("agent"),
)

const descriptionOption = Options.text("description").pipe(
  Options.withAlias("d"),
  Options.withDescription("Project description (used when creating a new project)"),
  Options.withDefault("A codebase navigation project"),
)

const hintOption = Options.text("hint").pipe(
  Options.withDescription("Context hint to guide the AI (e.g. 'This repo has exercises organized by topic')"),
  Options.optional,
)

export const conjureCommand = Command.make("conjure", {
  args: { name: nameArg },
  options: { github: githubOption, path: pathOption, mode: modeOption, description: descriptionOption, hint: hintOption },
}).pipe(
  Command.withDescription("Conjure topic documentation from a codebase"),
  Command.withHandler(({ args, options }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const home = yield* GrimoireHome
      const configService = yield* ProjectConfigService

      const nameOpt = Option.getOrUndefined(args.name)
      const github = Option.getOrUndefined(options.github)
      const path = Option.getOrUndefined(options.path)
      const hint = Option.getOrUndefined(options.hint)

      // Resolve project name
      let projectName: string
      if (nameOpt) {
        projectName = nameOpt
      } else if (github && !path) {
        // --github without --path: use owner/repo as name
        projectName = github
      } else if (github && path) {
        yield* Console.error(render.error("Name is required when using --github with --path (monorepo sub-package)."))
        yield* Console.error(render.dim(`  Example: grimoire conjure effect-sql --github ${github} --path ${path}`))
        return
      } else {
        yield* Console.error(render.error("Name is required. Provide a project name or use --github."))
        return
      }

      // Load or create project
      const exists = yield* home.projectExists(projectName)
      let config: ProjectConfig

      if (exists) {
        config = yield* configService.read(projectName)
      } else {
        yield* home.ensureHome()

        config = new ProjectConfig({
          name: projectName,
          description: options.description,
          ...(github ? { github, sourceType: "github" as const } : {}),
          ...(path ? { path } : {}),
          ...(!github && path ? { sourceType: "path" as const } : {}),
          ...(hint ? { hint } : {}),
        })

        const projectDir = home.projectDir(projectName)
        const topicsDir = `${projectDir}/topics`
        yield* fs.makeDirectory(topicsDir, { recursive: true })
        yield* configService.write(projectName, config)

        yield* Console.error(render.success(`Created project '${projectName}'`))
      }

      // Update config if new source flags or hint provided
      if (github || path || hint) {
        config = new ProjectConfig({
          ...config,
          ...(github ? { github, sourceType: "github" as const } : {}),
          ...(path ? { path } : {}),
          ...(!github && path ? { sourceType: "path" as const } : {}),
          ...(hint ? { hint } : {}),
        })
        yield* configService.write(projectName, config)
      }

      // Resolve the source — from flags or stored config
      const resolvedGithub = github ?? config.github
      const resolvedPath = path ?? config.path

      if (!resolvedGithub && !resolvedPath) {
        yield* Console.error(render.error("No source specified. Use --github or --path, or set them in grimoire.json."))
        return
      }

      const resolvedHint = hint ?? config.hint

      const source = yield* resolveSource({
        github: resolvedGithub,
        path: resolvedPath,
      })

      const projectDir = home.projectDir(projectName)
      const topicsDir = `${projectDir}/topics`

      try {
        yield* Console.error("")
        yield* Console.error(render.banner(`Analyzing ${projectName}...`))
        yield* Console.error("")

        if (options.mode === "agent") {
          const generator = yield* AgentPromptGenerator
          const promptPath = `${projectDir}/analysis-prompt.md`

          yield* Console.error(render.info("Reading codebase..."))
          const prompt = yield* generator.generate(source.codebasePath, promptPath, projectName, topicsDir, resolvedHint)

          yield* Console.error("")
          yield* Console.error(render.success(`Saved to ~/.grimoire/projects/${projectName}/analysis-prompt.md`))
          yield* Console.log(prompt)
        } else {
          const topicWriter = yield* TopicWriter

          const provider = yield* resolveProvider().pipe(
            Effect.catchAll(() =>
              Effect.gen(function* () {
                yield* Console.error(render.error("No API key found. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY."))
                yield* Console.error(render.dim("Tip: use --mode agent (default) to generate a prompt file instead."))
                return yield* Effect.fail("no-key" as const)
              }),
            ),
          )

          yield* Console.error(render.info("Running AI analysis pipeline..."))
          yield* Console.error(render.dim(`  Using ${provider.name}`))

          const { runFullPipeline } = yield* Effect.promise(
            () => import("../ai/pipeline.js"),
          )

          const { topics } = yield* runFullPipeline(source.codebasePath, resolvedHint).pipe(
            Effect.provide(provider.layer),
          )

          for (const topic of topics) {
            yield* topicWriter.write(topicsDir, {
              slug: topic.slug,
              title: topic.title,
              description: topic.description,
              order: topic.order,
              category: topic.category,
              tags: topic.tags as string[],
              relatedFiles: topic.relatedFiles as string[],
              content: "\n" + topic.content,
            })
          }

          yield* Console.error("")
          yield* Console.error(render.success(`Generated ${topics.length} topics`))
          yield* Console.error("")
          yield* Console.error(render.dim("Next steps:"))
          yield* Console.error(render.dim(`  grimoire list ${projectName}`))
          yield* Console.error(render.dim(`  grimoire show ${projectName} overview`))
          yield* Console.error("")
        }
      } finally {
        if (source.cleanup) {
          yield* Effect.promise(() => source.cleanup!())
        }
      }
    }),
  ),
)
