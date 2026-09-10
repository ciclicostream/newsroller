import { Router } from "express";
import type { Registry } from "../sources/registry.js";

export function sourcesRouter(registry: Registry): Router {
  const r = Router();
  // Estado y última corrida de cada poller.
  r.get("/sources", (_req, res) => {
    res.json(registry.getStatuses());
  });
  return r;
}
