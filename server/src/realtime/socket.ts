import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type {
  CachedData,
  ClientToServerEvents,
  ServerToClientEvents,
  SourceStatus,
} from "@newsroller/shared";
import { env } from "../config/env.js";

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;

export function createIO(http: HttpServer): IO {
  const io: IO = new Server(http, {
    cors: { origin: env.corsOrigin === "*" ? true : env.corsOrigin.split(",") },
  });

  io.on("connection", (socket) => {
    console.log(`[io] cliente conectado: ${socket.id}`);
    socket.on("disconnect", () => console.log(`[io] cliente desconectado: ${socket.id}`));
  });

  return io;
}

export function emitData(io: IO, data: CachedData): void {
  io.emit("data:update", data);
}

export function emitStatus(io: IO, statuses: SourceStatus[]): void {
  io.emit("sources:status", statuses);
}
