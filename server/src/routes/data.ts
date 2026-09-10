import { Router } from "express";
import { getStore } from "../db/store.js";
import { getSource } from "../sources/index.js";

export function dataRouter(): Router {
  const r = Router();
  const store = getStore();

  // Todos los payloads cacheados.
  r.get("/data", async (_req, res) => {
    res.json(await store.getAll());
  });

  // Último payload de una fuente.
  r.get("/data/:source", async (req, res) => {
    const { source } = req.params;
    if (!getSource(source)) {
      return res.status(404).json({ error: `fuente desconocida: ${source}` });
    }
    const data = await store.getData(source);
    if (!data) return res.status(503).json({ error: `sin datos todavía para ${source}` });
    res.json(data);
  });

  return r;
}
