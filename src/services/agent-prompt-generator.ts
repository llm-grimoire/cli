import { Effect, Data } from "effect"
import { FileSystem } from "@effect/platform"
import { CodebaseReader } from "./codebase-reader.js"

export class AgentPromptError extends Data.TaggedError("AgentPromptError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class AgentPromptGenerator extends Effect.Service<AgentPromptGenerator>()(
  "AgentPromptGenerator",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const reader = yield* CodebaseReader

      const generate = (codebasePath: string, outputPath: string, projectName: string, topicsDir: string) =>
        Effect.gen(function* () {
          const { formatted: fileTree } = yield* reader.getFileTree(codebasePath, 4)
          const keyFiles = yield* reader.findKeyFiles(codebasePath)

          const keyFileContents: Array<{ path: string; content: string }> = []
          for (const filePath of keyFiles.slice(0, 20)) {
            const content = yield* reader.readFile(filePath).pipe(Effect.orElseSucceed(() => ""))
            const relativePath = filePath.slice(codebasePath.length + 1)
            keyFileContents.push({ path: relativePath, content })
          }

          const prompt = buildPrompt(projectName, topicsDir, fileTree, keyFileContents)
          yield* fs.writeFileString(outputPath, prompt)
          return outputPath
        }).pipe(
          Effect.mapError(
            (cause) =>
              new AgentPromptError({ message: "Failed to generate agent prompt", cause }),
          ),
        )

      return { generate }
    }),
  },
) {}

const buildPrompt = (
  projectName: string,
  topicsDir: string,
  fileTree: string,
  keyFiles: ReadonlyArray<{ path: string; content: string }>,
): string => {
  const keyFileSections = keyFiles
    .map(
      (f) => `### ${f.path}
\`\`\`
${f.content.slice(0, 5000)}
\`\`\``,
    )
    .join("\n\n")

  return `# Codebase Analysis Task: ${projectName}

You are analyzing the **${projectName}** codebase to generate topic documentation.
The goal is to produce 8-15 focused topic files that help AI agents navigate this codebase efficiently.

## Output Directory

Write all topic files to:

\`\`\`
${topicsDir}
\`\`\`

## File Tree

\`\`\`
${fileTree}
\`\`\`

## Key Files

${keyFileSections}

## Your Task

Analyze this codebase and produce topic documentation. For each topic, create a markdown file in the output directory above.

### Topic Format

Each topic file should follow this exact format:

\`\`\`markdown
---
title: Topic Title
slug: topic-slug
description: Brief one-line description
order: 1
category: architecture|patterns|api|guides|setup
tags: [tag1, tag2]
relatedFiles: [src/path/to/file.ts]
---

# Topic Title

## Overview
Brief overview of what this topic covers and why it matters.

## Key Concepts
Explain the main concepts, patterns, or architecture decisions.

## Code Examples
Show real code examples from the codebase with explanations.

## Related Files
List the most important files an agent should read for deeper understanding.
\`\`\`

### File Naming

Name files as \`NN-slug.md\` where NN is the zero-padded order number. Example: \`00-overview.md\`, \`01-architecture.md\`.

### Guidelines

1. **Focus on what AI agents need** — help them write correct code without reading every file
2. **Use real code examples** from the codebase, not generic examples
3. **Cover architecture decisions** — why things are structured the way they are
4. **Include file pointers** — tell agents which files to read for specific concerns
5. **8-15 topics** covering: overview, architecture, key modules, patterns, setup, common tasks
6. **Order topics** from general (overview, setup) to specific (individual modules, patterns)

### Verification

When done, run \`grimoire list ${projectName}\` to confirm topics were written correctly.
`
}
