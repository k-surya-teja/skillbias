import http from "node:http";
import { buildApp } from "./app.js";
import { connectDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { initializeSockets } from "./sockets/index.js";

async function startServer(): Promise<void> {
  await connectDatabase();
  const app = buildApp();
  const server = http.createServer(app);
  initializeSockets(server);

  server.listen(env.PORT, () => {
    console.log(`ATS backend running on http://localhost:${env.PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
