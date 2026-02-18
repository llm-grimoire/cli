export const SYSTEM_PROMPT = `You are an expert software architect analyzing codebases to generate structured documentation.
Your goal is to produce topic documentation that helps AI agents navigate codebases efficiently.

Key principles:
- Focus on what an AI agent needs to write correct code
- Identify architecture patterns, module boundaries, and public APIs
- Use real code examples from the codebase
- Point to specific files for deeper understanding
- Be concise but comprehensive

IMPORTANT: Always respond with valid JSON matching the requested schema. No markdown, no commentary — only JSON.`

export const discoveryPrompt = (fileTree: string, keyFileContents: string, hint?: string): string =>
  `Analyze this codebase and produce a structured overview.
${hint ? `\n## Context Hint\n${hint}\n` : ""}
## File Tree
\`\`\`
${fileTree}
\`\`\`

## Key Files
${keyFileContents}

Respond with a JSON object matching this exact shape:
{
  "projectName": "string",
  "projectType": "string (e.g. library, application, framework)",
  "language": "string",
  "buildSystem": "string",
  "description": "string",
  "keyModules": [{ "name": "string", "path": "string", "description": "string" }],
  "architecturePatterns": ["string"],
  "entryPoints": ["string"]
}`

export const topicPlanningPrompt = (overview: string, hint?: string): string =>
  `Based on this codebase overview, propose 8-15 documentation topics.
${hint ? `\n## Context Hint\n${hint}\n` : ""}
## Codebase Overview
${overview}

Respond with a JSON object matching this exact shape:
{
  "proposals": [
    {
      "slug": "url-friendly-slug",
      "title": "Clear Title",
      "description": "One-line description",
      "category": "architecture | patterns | api | guides | setup",
      "relevantFiles": ["path/to/file.ts"],
      "order": 0
    }
  ]
}

Order: 0 = most general/overview, higher = more specific.`

export const topicGenerationPrompt = (
  proposal: { slug: string; title: string; description: string; relevantFiles: ReadonlyArray<string> },
  fileContents: string,
): string =>
  `Generate complete documentation for this topic.

## Topic
- Slug: ${proposal.slug}
- Title: ${proposal.title}
- Description: ${proposal.description}

## Relevant File Contents
${fileContents}

Respond with a JSON object matching this exact shape:
{
  "slug": "${proposal.slug}",
  "title": "${proposal.title}",
  "description": "one-line description",
  "category": "architecture | patterns | api | guides | setup",
  "order": 0,
  "tags": ["tag1", "tag2"],
  "relatedFiles": ["path/to/file.ts"],
  "content": "Full markdown content here with ## headings, code examples from the files above, etc."
}

The "content" field should contain complete markdown documentation with:
1. Overview explaining what this covers and why
2. Key concepts with clear explanations
3. Real code examples from the files above (not generic)
4. Related files for deeper understanding`
