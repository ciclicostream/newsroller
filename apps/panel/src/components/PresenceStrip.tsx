import { useEffect, useState } from "react";
import { ROLE_LABEL, type Role } from "@newsroller/shared";
import { api } from "../lib/api";
import { Avatar } from "./Avatar";

interface Online { id: string; name: string; role: Role; avatar_url: string | null; last_seen_at: string }

// Tira de caritas con quién está conectado (el Master es invisible: el servidor no lo incluye).
export function PresenceStrip() {
  const [list, setList] = useState<Online[]>([]);
  useEffect(() => {
    let on = true;
    const load = () => api.get<Online[]>("/api/presence").then((l) => on && setList(l)).catch(() => {});
    void load();
    const t = setInterval(load, 30_000);
    return () => { on = false; clearInterval(t); };
  }, []);
  if (list.length === 0) return null;
  const MAX = 5;
  const shown = list.slice(0, MAX);
  return (
    <div className="presence" title={`${list.length} conectado${list.length === 1 ? "" : "s"}`}>
      <div className="presence-faces">
        {shown.map((u) => (
          <span key={u.id} className="presence-face" title={`${u.name} · ${ROLE_LABEL[u.role]}`}>
            <Avatar url={u.avatar_url} name={u.name} size={28} ring />
            <i className="presence-dot" />
          </span>
        ))}
        {list.length > MAX && <span className="presence-more">+{list.length - MAX}</span>}
      </div>
    </div>
  );
}
