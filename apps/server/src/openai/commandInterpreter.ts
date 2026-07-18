export type CommandInterpretationRoute = "command" | "generate" | "ignore";

export interface CommandInterpretation {
  route: CommandInterpretationRoute;
  canonicalCommand?: string;
  reason?: string;
}

export interface CommandInterpreter {
  interpretTranscript(
    transcript: string,
    options?: { signal?: AbortSignal }
  ): Promise<CommandInterpretation>;
}

interface OpenAiCommandInterpreterOptions {
  baseUrl?: string;
  model?: string;
  fetch?: typeof globalThis.fetch;
}

export class OpenAiCommandInterpreter implements CommandInterpreter {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetch: typeof globalThis.fetch;

  constructor(
    private readonly apiKey: string,
    options: OpenAiCommandInterpreterOptions = {}
  ) {
    this.baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
    this.model = options.model ?? "gpt-4o-mini";
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async interpretTranscript(
    transcript: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<CommandInterpretation> {
    const response = await this.fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
        Accept: "application/json"
      },
      signal: options.signal,
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: COMMAND_INTERPRETER_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: transcript
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI command interpretation failed with ${response.status} ${response.statusText}: ${await response.text()}`
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return { route: "ignore", reason: "empty interpreter response" };
    }

    return normalizeCommandInterpretation(content);
  }
}

function normalizeCommandInterpretation(content: string): CommandInterpretation {
  try {
    const parsed = JSON.parse(content) as {
      route?: unknown;
      canonicalCommand?: unknown;
      reason?: unknown;
    };
    const route =
      parsed.route === "command" ||
      parsed.route === "generate" ||
      parsed.route === "ignore"
        ? parsed.route
        : "ignore";
    const canonicalCommand =
      typeof parsed.canonicalCommand === "string"
        ? parsed.canonicalCommand.trim()
        : undefined;
    const reason =
      typeof parsed.reason === "string" ? parsed.reason.trim() : undefined;

    return {
      route,
      ...(canonicalCommand ? { canonicalCommand } : {}),
      ...(reason ? { reason } : {})
    };
  } catch {
    return { route: "ignore", reason: "invalid interpreter JSON" };
  }
}

const COMMAND_INTERPRETER_SYSTEM_PROMPT = [
  "You classify short WebXR holodeck voice transcripts.",
  "Return only JSON with route, canonicalCommand, and reason.",
  "route must be one of: command, generate, ignore.",
  "Use command when the transcript is likely a local command, even if ASR produced homophones or nonsense.",
  "Examples: 'I'd fart', 'Heidarch', 'Hi to Arch', 'Hide art' all mean canonicalCommand 'hide arch'.",
  "Supported canonical commands include: hide arch, show arch, hide holodeck, show holodeck, end program, reset world, recenter world, move world up/down/left/right/forward/back <amount>, rotate world <angle>, scale world <amount>, move me up/down/left/right/forward/back <amount>, reset my position, recenter me.",
  "Use generate only for explicit or descriptive world creation prompts such as 'create a three ring circus' or 'put me in a large autumn park'.",
  "Use ignore for greetings, filler, silence, unrelated text, or uncertain transcripts.",
  "Do not invent distances or angles for commands that did not include them."
].join(" ");
