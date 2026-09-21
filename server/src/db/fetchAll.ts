// Trae todas las filas de una consulta paginando (Supabase corta en 1000 por página).
export type Row = Record<string, any>;
export async function fetchAll(
  build: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
): Promise<{ rows: Row[]; error: string | null }> {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) return { rows, error: error.message };
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }
  return { rows, error: null };
}
