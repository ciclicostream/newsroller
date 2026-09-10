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
import { playlistRouter } from "./routes/playlist.js";
import { outputRouter } from "./routes/output.js";
import { getStore } from "./db/store.js";
import { getSupabase } from "./db/supabase.js";
import { ensureAdmins } from "./auth/bootstrap.js";
import { syncShorts } from "./content/youtube.js";

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
// Cada router en su sub-ruta: así el requireAdmin de usuarios NO afecta a contenido.
app.use("/api/users", usersRouter());
app.use("/api/content", contentRouter());
app.use("/api/playlist", playlistRouter());
app.use("/api/output", outputRouter()); // público (sin auth) para vMix

// En producción, servir los builds del front (mismo origen que la API y el socket).
const appsDir = path.resolve(fileURLToPath(import.meta.url), "../../../apps");
const outputDist = path.join(appsDir, "output/dist");
const panelDist = path.join(appsDir, "panel/dist");

// Output para vMix en /output (app propia, base /output/).
if (existsSync(outputDist)) {
  app.use("/output", express.static(outputDist));
  app.get("/output/*", (_req, res) => res.sendFile(path.join(outputDist, "index.html")));
  console.log(`[server] sirviendo output desde ${outputDist}`);
}

// Panel en la raíz.
if (existsSync(panelDist)) {
  app.use(express.static(panelDist));
  // SPA fallback: cualquier ruta que no sea API/health/output la resuelve el panel.
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/health" || req.path.startsWith("/output")) return next();
    res.sendFile(path.join(panelDist, "index.html"));
  });
  console.log(`[server] sirviendo panel desde ${panelDist}`);
}

http.listen(env.port, () => {
  console.log(`[server] escuchando en http://localhost:${env.port}`);
  console.log(`[server] store: ${registry.storeKind()}`);
  void ensureAdmins();
  registry.start();

  // Auto-sync de shorts de YouTube (si hay key + Supabase).
  const sb = getSupabase();
  if (sb && env.youtubeApiKey) {
    const run = () =>
      syncShorts(sb)
        .then((n) => console.log(`[youtube] shorts sincronizados: ${n}`))
        .catch((e) => console.error(`[youtube] sync ERROR: ${e.message}`));
    void run();
    setInterval(run, env.youtubeSyncMs);
  }
});

const shutdown = () => {
  console.log("\n[server] cerrando...");
  registry.stop();
  http.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
