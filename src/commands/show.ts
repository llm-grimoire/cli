import { Args, Command } from "@effect/cli"
import { Console, Effect } from "effect"
import { GrimoireHome } from "../services/grimoire-home.js"
import { TopicReader } from "../services/topic-reader.js"
import * as render from "../lib/render.js"

const projectArg = Args.text({ name: "project" }).pipe(
  Args.withDescription("Project name"),
)

const topicArg = Args.text({ name: "topic" }).pipe(
  Args.withDescription("Topic slug (e.g. 'overview', 'architecture')"),
)

export const showCommand = Command.make("show", {
  args: { project: projectArg, topic: topicArg },
}).pipe(
  Command.withDescription("Show a topic's content"),
  Command.withHandler(({ args }) =>
    Effect.gen(function* () {
      const home = yield* GrimoireHome
      const topicReader = yield* TopicReader

      const exists = yield* home.projectExists(args.project)
      if (!exists) {
        yield* Console.log(render.error(`Project '${args.project}' not found`))
        return
      }

      const topic = yield* topicReader.readOne(args.project, args.topic)

      yield* Console.log("")
      yield* Console.log(render.heading(topic.title))
      if (topic.description) {
        yield* Console.log(render.dim(topic.description))
      }
      yield* Console.log("")
      yield* Console.log(topic.content)
      yield* Console.log("")
    }),
  ),
)
