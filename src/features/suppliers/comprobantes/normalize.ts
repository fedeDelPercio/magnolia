// Normalizacion de textos de items detectados por OCR para buscar/guardar en
// insumo_aliases. Tiene que ser estable (mismo input -> mismo output) y
// equivalente a `lower(unaccent(...))` de Postgres porque la columna
// raw_text_normalized se popula desde aca y despues se busca por igualdad.
export function normalizeAliasText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}
