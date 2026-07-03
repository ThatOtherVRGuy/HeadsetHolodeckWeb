import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { buildServer } from "./app.js";
import { readServerEnv } from "./config/env.js";
import { OpenAiTranscriptionClient } from "./openai/transcriptionClient.js";
import { downloadSplat } from "./worldlabs/downloadSplat.js";
import { WorldLabsClient } from "./worldlabs/worldLabsClient.js";

dotenv.config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url))
});

const generatedWorldsDir = fileURLToPath(
  new URL("../../../assets/generated-worlds/", import.meta.url)
);
const env = readServerEnv(process.env);
const app = await buildServer({
  voiceToWorld: {
    transcriptionClient: new OpenAiTranscriptionClient(env.openAiApiKey),
    worldLabsClient: new WorldLabsClient(env.worldLabsApiKey),
    splatDownloader: (world, options) =>
      downloadSplat(world, {
        outputDir: generatedWorldsDir,
        signal: options.signal
      })
  }
});

await app.listen({
  host: "0.0.0.0",
  port: env.port
});
