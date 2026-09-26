import { getConfig } from "./config";
import { AppError, serviceUnavailable, validationError } from "./errors";
import { logger } from "./logger";

export const AI_PROVIDERS = ["openai", "gemini", "anthropic"] as const;
export type AiProviderName = (typeof AI_PROVIDERS)[number];

export const AI_KINDS = ["captions", "repurpose", "event_summary", "analytics_explain"] as const;
export type AiKind = (typeof AI_KINDS)[number];

export type AiCompletionRequest = {
  kind: AiKind;
  model?: string;
  system: string;
  prompt: string;
  timeoutMs?: number;
};

export type AiCompletionResult = {
  provider: AiProviderName;
  model: string;
  text: string;
  inputTokens: number;
  outputTokens: number;
};

export type AiProvider = {
  name: AiProviderName;
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
};

export class HttpAiProvider implements AiProvider {
  constructor(
    readonly name: AiProviderName,
    private readonly options: {
      apiKey: string;
      model: string;
      timeoutMs: number;
      maxRetries: number;
      complete: (input: {
        apiKey: string;
        model: string;
        system: string;
        prompt: string;
        signal: AbortSignal;
      }) => Promise<AiCompletionResult>;
    },
  ) {}

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const timeoutMs = request.timeoutMs ?? this.options.timeoutMs;
    const model = request.model || this.options.model;
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const result = await this.options.complete({
          apiKey: this.options.apiKey,
          model,
          system: request.system,
          prompt: request.prompt,
          signal: controller.signal,
        });
        if (!result.text.trim()) {
          throw validationError("AI provider returned an empty response");
        }
        return { ...result, provider: this.name, model };
      } catch (error) {
        lastError = error;
        logger.warn(
          { provider: this.name, kind: request.kind, attempt, code: error instanceof AppError ? error.code : "AI_ERROR" },
          "ai provider attempt failed",
        );
        if (error instanceof AppError && (error.status === 400 || error.status === 401 || error.status === 403)) {
          throw error;
        }
        if (attempt >= this.options.maxRetries) {
          break;
        }
      } finally {
        clearTimeout(timer);
      }
    }
    if (lastError instanceof AppError) {
      throw lastError;
    }
    if (lastError instanceof Error && lastError.name === "AbortError") {
      throw serviceUnavailable("AI provider timed out");
    }
    throw serviceUnavailable("AI provider is unavailable");
  }
}

async function openaiComplete(input: {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  signal: AbortSignal;
}): Promise<AiCompletionResult> {
  const config = getConfig();
  const baseUrl = (config.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal: input.signal,
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.prompt },
      ],
      temperature: 0.4,
    }),
  });
  if (!response.ok) {
    throw serviceUnavailable("OpenAI request failed");
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = payload.choices?.[0]?.message?.content;
  if (typeof text !== "string") {
    throw validationError("AI provider returned an invalid response");
  }
  return {
    provider: "openai",
    model: input.model,
    text,
    inputTokens: payload.usage?.prompt_tokens ?? 0,
    outputTokens: payload.usage?.completion_tokens ?? 0,
  };
}

async function geminiComplete(input: {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  signal: AbortSignal;
}): Promise<AiCompletionResult> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`,
    {
      method: "POST",
      signal: input.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents: [{ role: "user", parts: [{ text: input.prompt }] }],
      }),
    },
  );
  if (!response.ok) {
    throw serviceUnavailable("Gemini request failed");
  }
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n");
  if (!text) {
    throw validationError("AI provider returned an invalid response");
  }
  return {
    provider: "gemini",
    model: input.model,
    text,
    inputTokens: payload.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: payload.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

async function anthropicComplete(input: {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  signal: AbortSignal;
}): Promise<AiCompletionResult> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: input.signal,
    headers: {
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: 1024,
      system: input.system,
      messages: [{ role: "user", content: input.prompt }],
    }),
  });
  if (!response.ok) {
    throw serviceUnavailable("Anthropic request failed");
  }
  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = payload.content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n");
  if (!text) {
    throw validationError("AI provider returned an invalid response");
  }
  return {
    provider: "anthropic",
    model: input.model,
    text,
    inputTokens: payload.usage?.input_tokens ?? 0,
    outputTokens: payload.usage?.output_tokens ?? 0,
  };
}

const DEFAULT_MODELS: Record<AiProviderName, string> = {
  openai: "gpt-4o-mini",
  gemini: "gemini-2.0-flash",
  anthropic: "claude-3-5-haiku-latest",
};

export function createAiProvider(): AiProvider {
  const config = getConfig();
  const name = config.AI_PROVIDER;
  if (!name) {
    throw serviceUnavailable("AI provider is not configured");
  }
  const timeoutMs = config.AI_TIMEOUT_MS;
  const maxRetries = config.AI_MAX_RETRIES;
  const model = config.AI_MODEL || DEFAULT_MODELS[name];
  if (name === "openai") {
    if (!config.OPENAI_API_KEY) {
      throw serviceUnavailable("OpenAI credentials are not configured");
    }
    return new HttpAiProvider("openai", {
      apiKey: config.OPENAI_API_KEY,
      model,
      timeoutMs,
      maxRetries,
      complete: openaiComplete,
    });
  }
  if (name === "gemini") {
    if (!config.GEMINI_API_KEY) {
      throw serviceUnavailable("Gemini credentials are not configured");
    }
    return new HttpAiProvider("gemini", {
      apiKey: config.GEMINI_API_KEY,
      model,
      timeoutMs,
      maxRetries,
      complete: geminiComplete,
    });
  }
  if (!config.ANTHROPIC_API_KEY) {
    throw serviceUnavailable("Anthropic credentials are not configured");
  }
  return new HttpAiProvider("anthropic", {
    apiKey: config.ANTHROPIC_API_KEY,
    model,
    timeoutMs,
    maxRetries,
    complete: anthropicComplete,
  });
}

let activeProvider: AiProvider | undefined;

export function getAiProvider(): AiProvider {
  if (!activeProvider) {
    activeProvider = createAiProvider();
  }
  return activeProvider;
}

export function setAiProvider(provider: AiProvider): void {
  activeProvider = provider;
}

export function resetAiProvider(): void {
  activeProvider = undefined;
}
