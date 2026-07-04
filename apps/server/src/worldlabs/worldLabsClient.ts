import { normalizeWorld } from "./normalizeWorld.js";
import type { WorldResult } from "./worldTypes.js";

interface WorldLabsClientOptions {
  baseUrl?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

interface WorldLabsRequestOptions {
  signal?: AbortSignal;
  onProgress?: (progress: WorldLabsProgress) => void;
}

interface WorldLabsOperation {
  status?: unknown;
  operation_id?: unknown;
  done?: unknown;
  metadata?: {
    world_id?: unknown;
    progress?: {
      status?: unknown;
      description?: unknown;
    };
  };
  response?: unknown;
  error?: unknown;
}

export interface WorldLabsProgress {
  operationId: string;
  status: string;
  description?: string;
  worldId?: string;
}

export class WorldLabsClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly fetch: typeof globalThis.fetch;

  constructor(apiKey: string, options: WorldLabsClientOptions = {}) {
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.worldlabs.ai";
    this.pollIntervalMs = options.pollIntervalMs ?? 5_000;
    this.timeoutMs = options.timeoutMs ?? 600_000;
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async generateWorldFromText(
    prompt: string,
    transcript = prompt,
    options: WorldLabsRequestOptions = {}
  ): Promise<WorldResult> {
    const createResponse = await this.fetch(
      `${this.baseUrl}/marble/v1/worlds:generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "WLT-Api-Key": this.apiKey
        },
        signal: options.signal,
        body: JSON.stringify({
          world_prompt: {
            type: "text",
            text_prompt: prompt
          },
          display_name: buildDisplayName(prompt),
          model: "marble-1.1",
          permission: {
            allowed_readers: [],
            allowed_writers: [],
            public: false
          }
        })
      }
    );

    if (!createResponse.ok) {
      throw new Error(
        `World Labs world generation failed with ${createResponse.status} ${createResponse.statusText}: ${await readResponseMessage(createResponse)}`
      );
    }

    const createPayload = (await createResponse.json()) as {
      operation_id?: unknown;
    };
    const operationId =
      typeof createPayload.operation_id === "string"
        ? createPayload.operation_id.trim()
        : "";

    if (!operationId) {
      throw new Error("World Labs world generation did not return operation_id");
    }

    options.onProgress?.({
      operationId,
      status: "created",
      description: "World generation operation created"
    });

    const operation = await this.waitForOperation(
      operationId,
      options.signal,
      options.onProgress
    );

    if (!operation.response || typeof operation.response !== "object") {
      throw new Error(
        `World Labs operation ${operationId} did not include a response payload`
      );
    }

    return normalizeWorld(operation.response, { prompt, transcript });
  }

  private async waitForOperation(
    operationId: string,
    signal?: AbortSignal,
    onProgress?: (progress: WorldLabsProgress) => void
  ): Promise<WorldLabsOperation> {
    const startedAt = Date.now();

    while (Date.now() - startedAt <= this.timeoutMs) {
      throwIfAborted(signal);
      const response = await this.fetch(
        `${this.baseUrl}/marble/v1/operations/${operationId}`,
        {
          method: "GET",
          headers: {
            "WLT-Api-Key": this.apiKey
          },
          signal
        }
      );

      if (!response.ok) {
        throw new Error(
          `World Labs operation ${operationId} polling failed with ${response.status} ${response.statusText}: ${await readResponseMessage(response)}`
        );
      }

      const operation = (await response.json()) as WorldLabsOperation;
      const status = readOperationStatus(operation);
      const description = readOperationDescription(operation);
      const worldId = readOperationWorldId(operation);

      if (status || description || worldId) {
        onProgress?.({
          operationId,
          status: status || "polling",
          ...(description ? { description } : {}),
          ...(worldId ? { worldId } : {})
        });
      }

      if (operation.error || status === "error" || status === "failed") {
        throw new Error(
          `World Labs operation ${operationId} failed: ${readOperationError(operation.error)}`
        );
      }

      if (
        operation.done === true ||
        status === "done" ||
        status === "completed" ||
        status === "complete" ||
        status === "succeeded" ||
        status === "success"
      ) {
        return operation;
      }

      await sleep(this.pollIntervalMs, signal);
    }

    throw new Error(
      `World Labs operation ${operationId} timed out after ${this.timeoutMs}ms`
    );
  }
}

function readOperationStatus(operation: WorldLabsOperation): string {
  if (typeof operation.status === "string") {
    return operation.status.toLowerCase();
  }

  const progressStatus = operation.metadata?.progress?.status;

  return typeof progressStatus === "string"
    ? progressStatus.toLowerCase()
    : "";
}

function readOperationDescription(operation: WorldLabsOperation): string {
  const description = operation.metadata?.progress?.description;

  return typeof description === "string" ? description : "";
}

function readOperationWorldId(operation: WorldLabsOperation): string {
  const worldId = operation.metadata?.world_id;

  return typeof worldId === "string" ? worldId : "";
}

async function readResponseMessage(response: Response): Promise<string> {
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

function readOperationError(error: unknown): string {
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message.trim();
  }

  return "Unknown operation error";
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);

  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);

    const abort = () => {
      clearTimeout(timeout);
      reject(createAbortError());
    };

    signal?.addEventListener("abort", abort, { once: true });
  });
}

function buildDisplayName(prompt: string): string {
  return (
    prompt.trim().replace(/\s+/g, " ").slice(0, 60) ||
    "Headset Holodeck World"
  );
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function createAbortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}
