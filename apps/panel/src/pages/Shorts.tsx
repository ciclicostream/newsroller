import { ShortsManager } from "../components/managers";

export function Shorts() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Shorts</h1>
          <p>Últimos shorts del canal en YouTube. Editá el título que sale al aire y elegí cuáles rotan.</p>
        </div>
      </div>
      <ShortsManager />
    </>
  );
}
