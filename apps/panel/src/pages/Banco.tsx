import { useState } from "react";
import type { AssetKind } from "@newsroller/shared";
import { AssetManager } from "../components/managers";

const TABS: { key: AssetKind; label: string }[] = [
  { key: "background", label: "Fondos" },
  { key: "ad", label: "Fotos y videos" },
  { key: "logo", label: "Logos" },
];

export function Banco() {
  const [tab, setTab] = useState<AssetKind>("background");
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Banco</h1>
          <p>Fotos, videos, fondos y logos cargados. Se reutilizan en las placas y al aire.</p>
        </div>
      </div>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={"tab" + (tab === t.key ? " active" : "")} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <AssetManager kind={tab} />
    </>
  );
}
