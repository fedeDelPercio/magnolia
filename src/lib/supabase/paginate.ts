// Helper para iterar sobre todas las rows de una query supabase-js superando
// el limite default de 1000 rows por request. Usa .range() iterativo.
//
// Uso:
//   const rows = await fetchAllPaged((from, to) =>
//     supabase.from('foo').select('*').eq('x', y).range(from, to)
//   )

type Page<T> = {
  data: T[] | null
  error: { message: string } | null
}

export async function fetchAllPaged<T>(
  buildPage: (from: number, to: number) => PromiseLike<Page<T>>,
  pageSize = 1000,
  maxPages = 50, // backstop: 50k rows como tope duro para evitar loops infinitos
): Promise<T[]> {
  const all: T[] = []
  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize
    const to = from + pageSize - 1
    const res = await buildPage(from, to)
    if (res.error) throw new Error(res.error.message)
    const chunk = res.data ?? []
    all.push(...chunk)
    if (chunk.length < pageSize) return all
  }
  return all
}
