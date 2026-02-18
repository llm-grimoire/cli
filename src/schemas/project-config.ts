import { Schema } from "effect"

export class ProjectConfig extends Schema.Class<ProjectConfig>("ProjectConfig")({
  name: Schema.String,
  description: Schema.String,
  version: Schema.optional(Schema.String),
  github: Schema.optional(Schema.String),
  path: Schema.optional(Schema.String),
  sourceType: Schema.optional(Schema.Literal("github", "path")),
  topicsDir: Schema.optionalWith(Schema.String, { default: () => "topics" }),
  hint: Schema.optional(Schema.String),
}) {}

export const encodeProjectConfig = Schema.encode(ProjectConfig)
export const decodeProjectConfig = Schema.decode(ProjectConfig)
