export interface ServerEnv {
  openAiApiKey: string;
  worldLabsApiKey: string;
  port: number;
}

export function readServerEnv(source: NodeJS.ProcessEnv): ServerEnv {
  const openAiApiKey = source.OPENAI_API_KEY?.trim() ?? "";
  const worldLabsApiKey = source.WORLDLABS_API_KEY?.trim() ?? "";

  if (!openAiApiKey || !worldLabsApiKey) {
    throw new Error("OPENAI_API_KEY and WORLDLABS_API_KEY are required");
  }

  const rawPort = source.PORT?.trim() ?? "";
  const parsedPort = rawPort === "" ? 4817 : Number(rawPort);

  if (!Number.isInteger(parsedPort) || parsedPort < 0 || parsedPort > 65535) {
    throw new Error("PORT must be an integer between 0 and 65535");
  }

  return {
    openAiApiKey,
    worldLabsApiKey,
    port: parsedPort
  };
}
