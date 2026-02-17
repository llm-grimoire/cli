import { Schema } from "effect"

export class ProjectConfig extends Schema.Class<ProjectConfig>("ProjectConfig")({
  name: Schema.String,
  description: Schema.String,
  version: Schema.optionalWith(Schema.String, { default: () => "0.1.0" }),
  source: Schema.optional(Schema.String),
  topicsDir: Schema.optionalWith(Schema.String, { default: () => "topics" }),
}) {}

export const encodeProjectConfig = Schema.encode(ProjectConfig)
export const decodeProjectConfig = Schema.decode(ProjectConfig)
