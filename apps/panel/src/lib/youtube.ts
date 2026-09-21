// Duración de un video de YouTube leída con la IFrame API (sin API key): se carga el video en un reproductor
// oculto y se espera a que informe su duración. null si no se puede (video privado, sin embed, sin red…).
declare global {
  interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void }
}

let apiPromise: Promise<void> | null = null;
function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
      if (!document.getElementById("yt-api")) {
        const s = document.createElement("script");
        s.id = "yt-api";
        s.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(s);
      }
    });
  }
  return apiPromise;
}

export async function youtubeDuration(id: string, timeoutMs = 10_000): Promise<number | null> {
  await loadApi();
  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-9999px;top:0;width:220px;height:130px;pointer-events:none";
    const inner = document.createElement("div");
    host.appendChild(inner);
    document.body.appendChild(host);
    let done = false;
    let poll: ReturnType<typeof setInterval> | undefined;
    let kick: ReturnType<typeof setTimeout> | undefined;
    let player: any;
    const finish = (v: number | null) => {
      if (done) return;
      done = true;
      clearTimeout(limit); clearTimeout(kick); clearInterval(poll);
      try { player?.destroy(); } catch { /* noop */ }
      host.remove();
      resolve(v);
    };
    const limit = setTimeout(() => finish(null), timeoutMs);
    player = new window.YT.Player(inner, {
      videoId: id,
      playerVars: { autoplay: 0, controls: 0, mute: 1 },
      events: {
        onReady: () => {
          poll = setInterval(() => {
            const d = player?.getDuration?.();
            if (d > 0) finish(Math.ceil(d));
          }, 300);
          // Algunos videos no informan la duración hasta empezar a reproducirse: se lo empuja (mudo).
          kick = setTimeout(() => { try { player.mute(); player.playVideo(); } catch { /* noop */ } }, 1500);
        },
        onError: () => finish(null),
      },
    });
  });
}
