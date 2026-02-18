import { Command } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { addCommand } from "./commands/add.js"
import { conjureCommand } from "./commands/conjure.js"
import { listCommand } from "./commands/list.js"
import { showCommand } from "./commands/show.js"
import { removeCommand } from "./commands/remove.js"
import { incantCommand } from "./commands/incant.js"
import { pushCommand } from "./commands/push.js"
import { searchCommand } from "./commands/search.js"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const pkg = require("../package.json")
import { GrimoireHome } from "./services/grimoire-home.js"
import { ProjectConfigService } from "./services/project-config.js"
import { TopicWriter } from "./services/topic-writer.js"
import { TopicReader } from "./services/topic-reader.js"
import { CodebaseReader } from "./services/codebase-reader.js"
import { AgentPromptGenerator } from "./services/agent-prompt-generator.js"
import { UpdateNotifier } from "./services/update-notifier.js"

const rootCommand = Command.make("grimoire").pipe(
  Command.withDescription("AI-assisted codebase navigation"),
  Command.withSubcommands([
    addCommand,
    conjureCommand,
    listCommand,
    showCommand,
    removeCommand,
    incantCommand,
    pushCommand,
    searchCommand,
  ]),
)

// Base services without inter-service dependencies
const BaseServices = Layer.mergeAll(
  GrimoireHome.Default,
  TopicWriter.Default,
  CodebaseReader.Default,
  UpdateNotifier.Default,
)

// Services that depend on GrimoireHome
const DependentServices = Layer.mergeAll(
  ProjectConfigService.Default,
  TopicReader.Default,
  AgentPromptGenerator.Default,
)

const ServiceLayer = Layer.provideMerge(DependentServices, BaseServices)

const cli = Command.run(rootCommand, {
  name: "grimoire",
  version: pkg.version,
})

cli(globalThis.process.argv).pipe(
  Effect.provide(ServiceLayer),
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain,
)
