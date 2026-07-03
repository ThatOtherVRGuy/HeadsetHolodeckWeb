import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { buildServer } from "./app.js";
import { readServerEnv } from "./config/env.js";
import { OpenAiTranscriptionClient } from "./openai/transcriptionClient.js";
import { WorldLabsClient } from "./worldlabs/worldLabsClient.js";

dotenv.config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url))
});

const env = readServerEnv(process.env);
const app = await buildServer({
  voiceToWorld: {
    transcriptionClient: new OpenAiTranscriptionClient(env.openAiApiKey),
    worldLabsClient: new WorldLabsClient(env.worldLabsApiKey)
  }
});

await app.listen({
  host: "0.0.0.0",
  port: env.port
});
