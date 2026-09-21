import { useEffect, useState } from "react";
import type { ToastKind } from "../lib/toast";

interface T { id: number; msg: string; kind: ToastKind }

export function Toaster() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    let n = 0;
    const onToast = (e: Event) => {
      const { msg, kind } = (e as CustomEvent<{ msg: string; kind: ToastKind }>).detail;
      const id = ++n;
      setItems((l) => [...l, { id, msg, kind }]);
      setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), kind === "error" ? 8000 : 4500);
    };
    window.addEventListener("ciclico:toast", onToast);
    return () => window.removeEventListener("ciclico:toast", onToast);
  }, []);
  return (
    <div className="toaster">
      {items.map((t) => <div key={t.id} className={"toast " + t.kind} onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))}>{t.msg}</div>)}
    </div>
  );
}
