// Corre una fuente a mano e imprime el payload normalizado.
// Uso: npm run poll -- dolar   (o: datosgob, cammesa)   sin arg = todas.
import { sources, getSource } from "../sources/index.js";

async function main() {
  const arg = process.argv[2];
  const toRun = arg ? [getSource(arg)].filter(Boolean) : sources;

  if (arg && toRun.length === 0) {
    console.error(`Fuente desconocida: ${arg}. Disponibles: ${sources.map((s) => s.id).join(", ")}`);
    process.exit(1);
  }

  for (const source of toRun) {
    process.stdout.write(`\n=== ${source!.id} (${source!.label}) ===\n`);
    try {
      const payload = await source!.fetch();
      console.log(JSON.stringify(payload, null, 2));
    } catch (err) {
      console.error(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

void main();
