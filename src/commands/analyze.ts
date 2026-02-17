import { Args, Command, Options } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { AgentPromptGenerator } from "../services/agent-prompt-generator.js"
import { ProjectConfigService } from "../services/project-config.js"
import { GrimoireHome } from "../services/grimoire-home.js"
import { TopicWriter } from "../services/topic-writer.js"
import { resolveProvider } from "../ai/provider.js"
import * as render from "../lib/render.js"

const projectArg = Args.text({ name: "project" }).pipe(
  Args.withDescription("Project name to analyze"),
)

const targetOption = Options.text("target").pipe(
  Options.withAlias("t"),
  Options.withDescription("Path to the codebase (defaults to source from grimoire.json)"),
  Options.optional,
)

const modeOption = Options.choice("mode", ["agent", "api"]).pipe(
  Options.withDescription("Analysis mode: 'agent' generates a prompt file, 'api' calls an AI provider directly"),
  Options.withDefault("agent"),
)

export const analyzeCommand = Command.make("analyze", {
  args: { project: projectArg },
  options: { target: targetOption, mode: modeOption },
}).pipe(
  Command.withDescription("Run or rerun analysis for a project"),
  Command.withHandler(({ args, options }) =>
    Effect.gen(function* () {
      const home = yield* GrimoireHome
      const configService = yield* ProjectConfigService

      const projectName = args.project
      const exists = yield* home.projectExists(projectName)
      if (!exists) {
        yield* Console.log(render.error(`Project '${projectName}' not found. Run 'grimoire init ${projectName}' first.`))
        return
      }

      const config = yield* configService.read(projectName)
      const projectDir = home.projectDir(projectName)
      const topicsDir = `${projectDir}/topics`

      // Resolve target: from --target flag, or from config source
      const targetRaw = Option.getOrUndefined(options.target) ?? config.source
      if (!targetRaw) {
        yield* Console.log(render.error("No target specified. Use --target <path> or set source in grimoire.json"))
        return
      }

      const codebasePath = targetRaw.startsWith("/")
        ? targetRaw
        : `${process.cwd()}/${targetRaw}`

      yield* Console.error("")
      yield* Console.error(render.banner(`Analyzing ${projectName}...`))
      yield* Console.error("")

      if (options.mode === "agent") {
        const generator = yield* AgentPromptGenerator
        const promptPath = `${projectDir}/analysis-prompt.md`

        yield* Console.error(render.info("Reading codebase..."))
        const prompt = yield* generator.generate(codebasePath, promptPath, projectName, topicsDir)

        yield* Console.error("")
        yield* Console.error(render.success(`Saved to ~/.grimoire/projects/${projectName}/analysis-prompt.md`))
        yield* Console.log(prompt)
      } else {
        const topicWriter = yield* TopicWriter

        const provider = yield* resolveProvider().pipe(
          Effect.catchAll(() =>
            Effect.gen(function* () {
              yield* Console.log(render.error("No API key found. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY."))
              return yield* Effect.fail("no-key" as const)
            }),
          ),
        )

        yield* Console.log(render.info("Running AI analysis pipeline..."))
        yield* Console.log(render.dim(`  Using ${provider.name}`))
        yield* Console.log(render.dim("  Phase 1: Discovery"))
        yield* Console.log(render.dim("  Phase 2: Topic Planning"))
        yield* Console.log(render.dim("  Phase 3: Topic Generation"))
        yield* Console.log("")

        const pipeline = yield* Effect.promise(
          () => import("../ai/pipeline.js"),
        )

        const { topics } = yield* pipeline.runFullPipeline(codebasePath).pipe(
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

        yield* Console.log(render.success(`Generated ${topics.length} topics`))
        yield* Console.log("")
        yield* Console.log(render.dim(`Run 'grimoire list ${projectName}' to see topics.`))
        yield* Console.log("")
      }
    }),
  ),
)
