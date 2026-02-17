import { Config, Effect, Layer, Redacted } from "effect"
import { FetchHttpClient } from "@effect/platform"

export const resolveProvider = () =>
  Effect.gen(function* () {
    const anthropicKey = process.env["ANTHROPIC_API_KEY"]
    if (anthropicKey) {
      const { AnthropicLanguageModel, AnthropicClient } = yield* Effect.promise(
        () => import("@effect/ai-anthropic"),
      )
      return {
        name: "Anthropic" as const,
        layer: AnthropicLanguageModel.model("claude-sonnet-4-5-20250929").pipe(
          Layer.provide(AnthropicClient.layerConfig({ apiKey: Config.succeed(Redacted.make(anthropicKey)) })),
          Layer.provide(FetchHttpClient.layer),
        ),
      }
    }

    const openaiKey = process.env["OPENAI_API_KEY"]
    if (openaiKey) {
      const { OpenAiLanguageModel, OpenAiClient } = yield* Effect.promise(
        () => import("@effect/ai-openai"),
      )
      return {
        name: "OpenAI" as const,
        layer: OpenAiLanguageModel.model("gpt-4o").pipe(
          Layer.provide(OpenAiClient.layerConfig({ apiKey: Config.succeed(Redacted.make(openaiKey)) })),
          Layer.provide(FetchHttpClient.layer),
        ),
      }
    }

    const openrouterKey = process.env["OPENROUTER_API_KEY"]
    if (openrouterKey) {
      const { OpenRouterLanguageModel, OpenRouterClient } = yield* Effect.promise(
        () => import("@effect/ai-openrouter"),
      )
      return {
        name: "OpenRouter" as const,
        layer: OpenRouterLanguageModel.model("anthropic/claude-sonnet-4-5").pipe(
          Layer.provide(OpenRouterClient.layerConfig({ apiKey: Config.succeed(Redacted.make(openrouterKey)) })),
          Layer.provide(FetchHttpClient.layer),
        ),
      }
    }

    return yield* Effect.fail("no-api-key" as const)
  })
