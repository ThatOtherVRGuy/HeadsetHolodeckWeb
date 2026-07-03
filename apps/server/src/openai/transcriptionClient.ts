export interface TranscriptionClient {
  transcribe(
    audio: Uint8Array,
    fileName: string,
    contentType: string,
    options?: TranscriptionRequestOptions
  ): Promise<string>;
}

export interface TranscriptionRequestOptions {
  signal?: AbortSignal;
}

interface OpenAiTranscriptionClientOptions {
  baseUrl?: string;
  model?: string;
  fetch?: typeof globalThis.fetch;
}

export class OpenAiTranscriptionClient implements TranscriptionClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetch: typeof globalThis.fetch;

  constructor(apiKey: string, options: OpenAiTranscriptionClientOptions = {}) {
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
    this.model = options.model ?? "gpt-4o-transcribe";
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async transcribe(
    audio: Uint8Array,
    fileName: string,
    contentType: string,
    options: TranscriptionRequestOptions = {}
  ): Promise<string> {
    const form = new FormData();
    const audioBuffer = audio.buffer.slice(
      audio.byteOffset,
      audio.byteOffset + audio.byteLength
    ) as ArrayBuffer;
    form.append(
      "file",
      new Blob([audioBuffer], { type: contentType }),
      fileName
    );
    form.append("model", this.model);
    form.append("response_format", "json");
    form.append("language", "en");
    form.append("temperature", "0");

    const response = await this.fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json"
      },
      signal: options.signal,
      body: form
    });

    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new Error(
        `OpenAI transcription failed with ${response.status} ${response.statusText}: ${message}`
      );
    }

    const payload = (await response.json()) as { text?: unknown };
    const text = typeof payload.text === "string" ? payload.text.trim() : "";

    if (!text) {
      throw new Error("OpenAI transcription returned empty text");
    }

    return text;
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const body = await response.text();

  if (!body) {
    return "No response body";
  }

  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: unknown };
      message?: unknown;
    };
    const message =
      typeof parsed.error?.message === "string"
        ? parsed.error.message
        : parsed.message;

    return typeof message === "string" && message.trim()
      ? message.trim()
      : body;
  } catch {
    return body;
  }
}
