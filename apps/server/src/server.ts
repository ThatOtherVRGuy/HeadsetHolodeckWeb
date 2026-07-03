import dotenv from "dotenv";
import { buildServer } from "./app.js";
import { readServerEnv } from "./config/env.js";
import { OpenAiTranscriptionClient } from "./openai/transcriptionClient.js";
import { WorldLabsClient } from "./worldlabs/worldLabsClient.js";

dotenv.config();

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
