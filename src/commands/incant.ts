import { Args, Command } from "@effect/cli"
import { Console, Effect } from "effect"
import { GrimoireHome } from "../services/grimoire-home.js"
import { ProjectConfigService } from "../services/project-config.js"
import { TopicReader } from "../services/topic-reader.js"
import * as render from "../lib/render.js"

const projectArg = Args.text({ name: "project" }).pipe(
  Args.withDescription("Project name"),
)

export const incantCommand = Command.make("incant", {
  args: { project: projectArg },
}).pipe(
  Command.withDescription("Recite a grimoire as agent context"),
  Command.withHandler(({ args }) =>
    Effect.gen(function* () {
      const home = yield* GrimoireHome
      const configService = yield* ProjectConfigService
      const topicReader = yield* TopicReader

      const exists = yield* home.projectExists(args.project)
      if (!exists) {
        yield* Console.log(render.error(`Project '${args.project}' not found`))
        return
      }

      const config = yield* configService.read(args.project)
      const topics = yield* topicReader.readAll(args.project)

      const lines: string[] = []
      lines.push(`# ${config.name} Reference`)
      if (config.description) {
        lines.push(``)
        lines.push(config.description)
      }
      lines.push(``)
      lines.push(`This project has documentation available via grimoire.`)
      lines.push(`Run \`grimoire show ${args.project} <topic>\` to read a topic.`)
      lines.push(`Run \`grimoire list ${args.project}\` to see all topics.`)

      if (topics.length > 0) {
        lines.push(``)
        lines.push(`## Available Topics`)
        lines.push(``)
        for (const topic of topics) {
          const desc = topic.description ? ` — ${topic.description}` : ""
          lines.push(`- **${topic.slug}**${desc}`)
        }
      }

      lines.push(``)
      yield* Console.log(lines.join("\n"))
    }),
  ),
)
