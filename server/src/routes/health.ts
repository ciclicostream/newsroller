import { Router } from "express";
import type { Registry } from "../sources/registry.js";

export function healthRouter(registry: Registry): Router {
  const r = Router();
  r.get("/health", (_req, res) => {
    res.json({
      ok: true,
      store: registry.storeKind(),
      uptime: Math.round(process.uptime()),
      time: new Date().toISOString(),
    });
  });
  return r;
}
