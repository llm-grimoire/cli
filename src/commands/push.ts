import { Args, Command } from "@effect/cli"
import { Console, Effect } from "effect"
import { GrimoireHome } from "../services/grimoire-home.js"
import { ProjectConfigService } from "../services/project-config.js"
import { TopicReader } from "../services/topic-reader.js"
import * as render from "../lib/render.js"

const REGISTRY_REPO = "llm-grimoire/registry"

const nameArg = Args.text({ name: "name" }).pipe(
  Args.withDescription("Project name to push to the registry"),
)

export const pushCommand = Command.make("push", {
  args: { name: nameArg },
}).pipe(
  Command.withDescription("Contribute a local grimoire to the public registry"),
  Command.withHandler(({ args }) =>
    Effect.gen(function* () {
      const home = yield* GrimoireHome
      const configService = yield* ProjectConfigService
      const topicReader = yield* TopicReader

      const projectName = args.name

      // Validate project exists
      const exists = yield* home.projectExists(projectName)
      if (!exists) {
        yield* Console.error(render.error(`Project '${projectName}' not found.`))
        return
      }

      const config = yield* configService.read(projectName)

      // Validate github is set
      if (!config.github) {
        yield* Console.error(render.error("Cannot push: no 'github' field in grimoire.json."))
        yield* Console.error(render.dim("Set it with: grimoire analyze <name> --github owner/repo"))
        return
      }

      // Validate topics exist
      const topics = yield* topicReader.readAll(projectName)
      if (topics.length === 0) {
        yield* Console.error(render.error("Cannot push: no topics found. Run 'grimoire analyze' first."))
        return
      }

      // Determine registry path
      const github = config.github
      const registryPath = config.path
        ? `${github}/${config.path}`
        : github

      const projectDir = home.projectDir(projectName)

      yield* Console.error("")
      yield* Console.error(render.banner(`Push '${projectName}' to registry`))
      yield* Console.error("")
      yield* Console.error(render.info(`Registry path: ${registryPath}`))
      yield* Console.error(render.info(`Topics: ${topics.length}`))
      yield* Console.error("")
      yield* Console.error(render.dim("To contribute, copy your grimoire to the registry repo and open a PR:"))
      yield* Console.error("")
      yield* Console.error(render.dim(`  1. Fork https://github.com/${REGISTRY_REPO}`))
      yield* Console.error(render.dim(`  2. Copy files:`))
      yield* Console.error(render.dim(`     cp -r ${projectDir}/grimoire.json <registry-clone>/${registryPath}/`))
      yield* Console.error(render.dim(`     cp -r ${projectDir}/topics/ <registry-clone>/${registryPath}/topics/`))
      yield* Console.error(render.dim(`  3. Open a PR against ${REGISTRY_REPO}`))
      yield* Console.error("")
    }),
  ),
)
