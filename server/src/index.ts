import { createServer } from "node:http";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { Registry } from "./sources/registry.js";
import { createIO, emitData, emitStatus } from "./realtime/socket.js";
import { healthRouter } from "./routes/health.js";
import { dataRouter } from "./routes/data.js";
import { sourcesRouter } from "./routes/sources.js";
import { meRouter } from "./routes/me.js";
import { usersRouter } from "./routes/users.js";
import { contentRouter } from "./routes/content.js";
import { getStore } from "./db/store.js";
import { ensureAdmins } from "./auth/bootstrap.js";

const app = express();
app.use(cors({ origin: env.corsOrigin === "*" ? true : env.corsOrigin.split(",") }));
app.use(express.json());

const http = createServer(app);
const io = createIO(http);
const registry = new Registry();

// Cada actualización de un poller se emite y se refresca el estado de fuentes.
registry.setUpdateHandler((data) => {
  emitData(io, data);
  emitStatus(io, registry.getStatuses());
});

// Al conectarse un cliente (output/panel), recibe el estado actual sin esperar el próximo ciclo.
io.on("connection", async (socket) => {
  for (const data of await getStore().getAll()) socket.emit("data:update", data);
  socket.emit("sources:status", registry.getStatuses());
});

app.use(healthRouter(registry));
app.use("/api", dataRouter());
app.use("/api", sourcesRouter(registry));
app.use("/api", meRouter());
app.use("/api", usersRouter());
app.use("/api", contentRouter());

// En producción, servir el build del panel (mismo origen que la API y el socket).
const panelDist = path.resolve(fileURLToPath(import.meta.url), "../../../apps/panel/dist");
if (existsSync(panelDist)) {
  app.use(express.static(panelDist));
  // SPA fallback: cualquier ruta que no sea API la resuelve el router del front.
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/health") return next();
    res.sendFile(path.join(panelDist, "index.html"));
  });
  console.log(`[server] sirviendo panel desde ${panelDist}`);
}

http.listen(env.port, () => {
  console.log(`[server] escuchando en http://localhost:${env.port}`);
  console.log(`[server] store: ${registry.storeKind()}`);
  void ensureAdmins();
  registry.start();
});

const shutdown = () => {
  console.log("\n[server] cerrando...");
  registry.stop();
  http.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
