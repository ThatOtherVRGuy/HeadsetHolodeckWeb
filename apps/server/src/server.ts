import dotenv from "dotenv";
import { buildServer } from "./app.js";
import { readServerEnv } from "./config/env.js";

dotenv.config();

const env = readServerEnv(process.env);
const app = await buildServer();

await app.listen({
  host: "0.0.0.0",
  port: env.port
});
