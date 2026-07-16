/**
 * Thin, provider-agnostic wrapper over the `openai` npm SDK. Works against any
 * OpenAI-compatible chat-completions endpoint (default: DeepSeek via
 * OpenRouter; swap AI_MODEL/AI_BASE_URL to point at any other OpenAI-
 * compatible gateway, including an Anthropic model served through one, with
 * zero code change here).
 *
 * MOCK PATH: if a mock file is supplied (AI_BRIEF_MOCK env var, or a
 * `--mock <file>` CLI arg passed in via opts.argv), callAiBrief() returns that
 * file's parsed JSON WITHOUT ever importing the `openai` package. This is what
 * lets CI smoke-test the pipeline, and developers preview the dashboard,
 * without an API key or a network call. The dynamic `import("openai")` below
 * only happens on the real-call path, so mock-only runs don't even need the
 * package installed.
 */
import fs from "node:fs";
import path from "node:path";

const DEFAULT_MODEL = "deepseek/deepseek-chat";

/** AI_BRIEF_MOCK env var wins; otherwise scan argv for `--mock <file>`. */
function resolveMockPath(argv, env) {
  if (env.AI_BRIEF_MOCK) return env.AI_BRIEF_MOCK;
  const idx = argv.indexOf("--mock");
  if (idx !== -1 && argv[idx + 1]) return argv[idx + 1];
  return null;
}

/**
 * Call the configured chat-completions endpoint (or return a mock fixture)
 * and hand back the defensively-parsed JSON body plus the model id that
 * produced it (or the literal string "mock").
 *
 * @param {{system: string, user: string}} prompt
 * @param {{argv?: string[], env?: NodeJS.ProcessEnv}} [opts]
 * @returns {Promise<{json: unknown, model_id: string}>}
 *   Throws on: missing mock file, malformed JSON (mock or model), missing
 *   API key with no mock, empty model response, or any SDK/network error.
 *   Callers are expected to catch and fail soft -- this function never
 *   swallows an error itself.
 */
export async function callAiBrief({ system, user }, opts = {}) {
  const argv = opts.argv ?? process.argv.slice(2);
  const env = opts.env ?? process.env;

  const mockPath = resolveMockPath(argv, env);
  if (mockPath) {
    const raw = fs.readFileSync(path.resolve(mockPath), "utf-8");
    return { json: JSON.parse(raw), model_id: "mock" };
  }

  const apiKey = env.AI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_API_KEY is not set and no --mock/AI_BRIEF_MOCK fixture was provided");
  }
  const baseURL = env.AI_BASE_URL;
  const model = env.AI_MODEL || DEFAULT_MODEL;

  // Lazy import: only the real-call path needs the `openai` package present.
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ baseURL, apiKey, timeout: 30000, maxRetries: 1 });

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    // NOT json_schema: DeepSeek/OpenRouter strict-schema support is uneven.
    // The prompt describes the required shape; validateBrief() in
    // ai_brief.mjs is the real gate, not provider-side schema enforcement.
    response_format: { type: "json_object" },
    max_tokens: 900,
  });

  const content = completion?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("model response had no message content to parse");
  }
  return { json: JSON.parse(content), model_id: model };
}
