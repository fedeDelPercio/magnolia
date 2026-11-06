// Normaliza texto para busquedas: minusculas + sin tildes/diacriticos.
// Asi "cafe" matchea "Café" y "MUZZARELLA" matchea "muzzarella".
// Usado por todos los filtros de busqueda de listas (insumos, productos,
// proveedores, recetas, empleados, SearchableSelect).
export function normalizeSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

// Devuelve true si `needle` (normalizado) esta contenido en `haystack`
// (normalizado). Insensible a tildes y mayusculas.
export function matchesSearch(haystack: string, needle: string): boolean {
  return normalizeSearch(haystack).includes(normalizeSearch(needle))
}

// Como matchesSearch, pero por palabras y en cualquier orden: "proveedor total"
// encuentra "Total proveedor" y "pollo pechuga" encuentra "Pechuga de pollo".
// Lo usa el SearchableSelect.
export function matchesAllWords(haystack: string, needle: string): boolean {
  const h = normalizeSearch(haystack)
  return normalizeSearch(needle)
    .split(/\s+/)
    .every((palabra) => h.includes(palabra))
}
