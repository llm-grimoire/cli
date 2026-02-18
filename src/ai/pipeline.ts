import { Effect } from "effect"
import { LanguageModel } from "@effect/ai"
import { CodebaseOverview, TopicProposalSet, GeneratedTopic } from "../schemas/analysis.js"
import { CodebaseReader } from "../services/codebase-reader.js"
import * as prompts from "./prompts.js"

export const discover = (codebasePath: string, hint?: string) =>
  Effect.gen(function* () {
    const reader = yield* CodebaseReader
    const { formatted: fileTree } = yield* reader.getFileTree(codebasePath, 4)
    const keyFiles = yield* reader.findKeyFiles(codebasePath)

    const keyFileContents = yield* Effect.all(
      keyFiles.slice(0, 10).map((filePath: string) =>
        reader.readFile(filePath).pipe(
          Effect.map((content: string) => {
            const relativePath = filePath.slice(codebasePath.length + 1)
            return `### ${relativePath}\n\`\`\`\n${content.slice(0, 3000)}\n\`\`\``
          }),
          Effect.orElseSucceed(() => ""),
        ),
      ),
    )

    const response = yield* LanguageModel.generateObject({
      prompt: prompts.discoveryPrompt(fileTree, keyFileContents.join("\n\n"), hint),
      schema: CodebaseOverview,
    })

    return response.value
  })

export const planTopics = (overview: CodebaseOverview, hint?: string) =>
  Effect.gen(function* () {
    const overviewText = JSON.stringify(overview, null, 2)
    const response = yield* LanguageModel.generateObject({
      prompt: prompts.topicPlanningPrompt(overviewText, hint),
      schema: TopicProposalSet,
    })
    return response.value.proposals
  })

export const generateTopic = (
  codebasePath: string,
  proposal: { slug: string; title: string; description: string; relevantFiles: ReadonlyArray<string> },
) =>
  Effect.gen(function* () {
    const reader = yield* CodebaseReader

    const fileContents = yield* Effect.all(
      proposal.relevantFiles.map((filePath: string) => {
        const fullPath = filePath.startsWith("/") ? filePath : `${codebasePath}/${filePath}`
        return reader.readFile(fullPath).pipe(
          Effect.map((content: string) => `### ${filePath}\n\`\`\`\n${content.slice(0, 5000)}\n\`\`\``),
          Effect.orElseSucceed(() => `### ${filePath}\n(file not found)`),
        )
      }),
    )

    const response = yield* LanguageModel.generateObject({
      prompt: prompts.topicGenerationPrompt(proposal, fileContents.join("\n\n")),
      schema: GeneratedTopic,
    })

    return response.value
  })

export const runFullPipeline = (codebasePath: string, hint?: string) =>
  Effect.gen(function* () {
    const overview = yield* discover(codebasePath, hint)
    const proposals = yield* planTopics(overview, hint)

    const topics = yield* Effect.all(
      proposals.map((proposal) => generateTopic(codebasePath, proposal)),
      { concurrency: 3 },
    )

    return { overview, proposals, topics }
  })
