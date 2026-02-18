import { Args, Command } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { GrimoireHome } from "../services/grimoire-home.js"
import { ProjectConfigService } from "../services/project-config.js"
import { TopicReader } from "../services/topic-reader.js"
import * as render from "../lib/render.js"

const projectArg = Args.text({ name: "project" }).pipe(
  Args.withDescription("Project name to list topics for"),
  Args.optional,
)

export const listCommand = Command.make("list", {
  args: { project: projectArg },
}).pipe(
  Command.withDescription("List projects or topics within a project"),
  Command.withHandler(({ args }) =>
    Effect.gen(function* () {
      const projectName = Option.getOrUndefined(args.project)

      if (!projectName) {
        // List all projects
        const home = yield* GrimoireHome
        const configService = yield* ProjectConfigService
        const projects = yield* home.listProjects()

        if (projects.length === 0) {
          yield* Console.log("")
          yield* Console.log(render.dim("No projects yet. Create one with:"))
          yield* Console.log(render.dim("  grimoire init <name>"))
          yield* Console.log("")
          return
        }

        yield* Console.log("")
        yield* Console.log(render.banner("Projects"))
        yield* Console.log("")

        for (const name of projects) {
          const config = yield* configService.read(name).pipe(
            Effect.orElseSucceed(() => ({ description: "" })),
          )
          yield* Console.log(render.label(name, config.description))
        }
        yield* Console.log("")
      } else {
        // List topics for a project
        const home = yield* GrimoireHome
        const topicReader = yield* TopicReader

        const exists = yield* home.projectExists(projectName)
        if (!exists) {
          yield* Console.log(render.error(`Project '${projectName}' not found`))
          return
        }

        const topics = yield* topicReader.readAll(projectName)

        if (topics.length === 0) {
          yield* Console.log("")
          yield* Console.log(render.dim(`No topics in '${projectName}'. Run analysis first:`))
          yield* Console.log(render.dim(`  grimoire conjure ${projectName} --target <path>`))
          yield* Console.log("")
          return
        }

        yield* Console.log("")
        yield* Console.log(render.banner(`Topics in '${projectName}'`))
        yield* Console.log("")

        for (const topic of topics) {
          yield* Console.log(render.label(topic.slug, topic.title))
          if (topic.description) {
            yield* Console.log(render.dim(`  ${topic.description}`))
          }
        }
        yield* Console.log("")
      }
    }),
  ),
)
