import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";

export function meRouter(): Router {
  const r = Router();
  // Perfil + rol del usuario autenticado (lo usa el front para el guard por rol).
  r.get("/me", requireAuth, (req, res) => {
    res.json(req.user);
  });
  return r;
}
