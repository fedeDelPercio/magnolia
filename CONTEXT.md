# Magnolia — Contexto del proyecto

## Qué es esto

App de gestión para **Magnolia**, restaurant/café de Carolina en Argentina. Reemplaza tres Excel que usaba:

- `Stock Marzo.xlsx` — producción, venta, desperdicio, stock diario
- `Control de Gastos.xlsx` — una pestaña por proveedor + flujo de caja anual
- `Análisis de MAGNOLIA.xlsx` — costos de insumos, recetas por categoría, márgenes

El objetivo es centralizar operaciones, tener historial real, alertas automáticas y análisis de rentabilidad. No hay integración con POS en la fase actual; las ventas se cargan desde cierres de caja del sistema Bistrosoft (PDF → Claude API → extracción estructurada).

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Backend / DB | Supabase (PostgreSQL) con RLS multi-tenant |
| Auth | Supabase Auth |
| ORM / queries | Supabase JS client (sin Prisma) |
| Validación | Zod + react-hook-form + @hookform/resolvers |
| UI | Tailwind CSS v4 + shadcn/ui + lucide-react |
| Notificaciones | sonner (toasts) |
| IA | @anthropic-ai/sdk — claude-opus-4-7 para extracción de PDFs |
| Testing | Vitest |

**IMPORTANTE:** Este proyecto usa **Next.js 16.2.4**, que tiene breaking changes respecto a versiones anteriores. Siempre consultar `node_modules/next/dist/docs/` antes de usar APIs de Next.js. Las Server Actions se definen con `'use server'` y las páginas con `export default async function Page()`.

---

## Arquitectura general

### Multi-tenancy

Toda tabla de datos tiene `tenant_id uuid NOT NULL REFERENCES tenants(id)`. Las queries usan la función SQL `current_tenant_ids()` en las RLS policies, que lee el tenant activo del contexto de la sesión. En el código TypeScript, `getActiveTenantId()` de `src/lib/tenant/server.ts` retorna el tenant_id del usuario autenticado.

### Patrón de features

Cada feature vive en `src/features/<nombre>/` y sigue esta estructura:

```
actions.ts    — Server Actions ('use server'): mutaciones, INSERT/UPDATE/DELETE
queries.ts    — Funciones async que leen de Supabase (llamadas desde Server Components)
schemas.ts    — Zod schemas para validación de formularios
components/   — Componentes React (client o server según necesidad)
```

Las páginas (`src/app/(app)/`) son Server Components que llaman a queries y pasan datos a Client Components (`'use client'`). Los formularios usan `react-hook-form` + Zod, y las mutaciones llaman a server actions directamente.

### Tipos de Supabase

`src/types/database.ts` tiene los tipos generados de Supabase (Tables, Views, Functions, Enums). Cuando se agrega una tabla nueva, se actualiza manualmente este archivo. El tipo completo incluye `Row`, `Insert`, `Update` y `Relationships` para cada tabla.

---

## Base de datos

### Tablas principales

| Tabla | Propósito |
|-------|-----------|
| `tenants` | Tenant por negocio (Carolina tiene uno) |
| `memberships` | Usuario ↔ tenant (roles: owner, admin, member) |
| `insumos` | Materia prima: nombre, unidad, precio, proveedor, stock |
| `recetas` | Recetas: yield_qty, yield_unit, ingredientes |
| `receta_ingredientes` | Líneas de ingredientes: puede ser `kind='insumo'` o `kind='receta'` (sub-receta) |
| `productos` | Producto vendible: sale_price, receta_id, target_margin_pct, is_dynamic |
| `producto_descartables` | Insumos descartables usados por un producto (bolsas, etc.) |
| `producto_aliases` | Aliases de nombres de Bistrosoft → productos del catálogo |
| `producto_price_history` | Snapshot de sale_price + total_cost + margin_pct al cambiar precio |
| `proveedores` | Proveedores de insumos |
| `compras` | Compra a un proveedor |
| `compra_items` | Líneas de compra: insumo, qty, unit, precio |
| `pagos_proveedor` | Pagos registrados a proveedores |
| `dias_operativos` | Día operativo: fecha, status (abierto/cerrado) |
| `movimientos_diarios` | Producción y ventas por producto por día |
| `cierres_caja` | Cierre importado de Bistrosoft: totales por medio de pago |
| `cierre_caja_productos` | Líneas de productos dentro de un cierre |
| `insumo_stock_ajustes` | Ajustes manuales de stock (conteo físico) |
| `insumo_price_history` | Historial de precios de insumos (se crea al registrar compras) |
| `caja_movimientos` | Egresos manuales de caja |
| `tenant_config` | Configuración por tenant (key-value JSON) — ej: `impuesto_digital_pct` |

### Vistas importantes

| Vista | Propósito |
|-------|-----------|
| `insumo_stock` | Stock actual por insumo: baseline (último ajuste) + compras - consumo (solo movimientos post-ajuste) |
| `product_costs` | Costo total y margen por producto (recalcula dinámicamente desde precios actuales) |
| `saldos_proveedores` | Deuda actual por proveedor (compras - pagos) |

### Funciones SQL

| Función | Propósito |
|---------|-----------|
| `abrir_dia(fecha, tenant_id)` | Crea un día operativo |
| `cerrar_dia(dia_id)` | Cierra un día y propaga movimientos |
| `current_tenant_ids()` | Retorna array de tenant_ids del usuario (para RLS) |
| `normalize_qty(qty, from_unit, to_unit)` | Convierte cantidades entre unidades |
| `recipe_cost(receta_id)` | Costo de una receta |
| `recipe_has_cycle(receta_id)` | Detecta ciclos en sub-recetas |
| `normalize_name(text)` | Normaliza nombres: lowercase, sin acentos, trim |

### Enums

- `unit_kind`: kg, g, l, ml, u (unidades de medida)
- `ingrediente_kind`: insumo, receta
- `dia_status`: abierto, cerrado
- `compra_status`: pendiente, pagada
- `pago_metodo`: efectivo, transferencia, tarjeta, otro
- `membership_role`: owner, admin, member
- `caja_tipo`: ingreso, egreso

---

## Features implementadas

### Catálogo

**Insumos** (`/catalogo/insumos`)
- CRUD de insumos con unidad, tipo (ingrediente/descartable/limpieza), proveedor
- Precio actual (se actualiza automáticamente al registrar compras)
- `track_stock` = true → habilita control de stock
- Stock teórico visible en el dialog: hero card con barra de progreso
- **Controlar stock**: sección colapsable para ingresar stock real contado → registra ajuste → recalcula la vista `insumo_stock`
- **Precios del proveedor**: historial de precios con variación porcentual entre registros
- **IMPORTANTE sobre stock**: la vista `insumo_stock` usa el último ajuste como baseline y descuenta solo movimientos **posteriores** a ese ajuste. El filtro es `d.fecha >= la.since::date` (inclusivo, bug antiguo de `>` corregido en migración 0011).

**Productos** (`/catalogo/productos`)
- Producto = nombre + precio de venta + receta (ingredientes) + descartables opcionales
- `is_dynamic` = true → "Plato del día" (nombre variable)
- `target_margin_pct` = margen objetivo para alertas
- Botón "Actualizar precio" en vista (sin abrir edición completa)
- **Historial de precios**: card colapsable fuera del form con columnas fecha / precio / costo / margen. El margen tiene color (verde ≥ objetivo, rojo < objetivo) e ícono de tendencia.
- `product_costs` view calcula costo y margen dinámicamente; al guardar un precio se hace snapshot en `producto_price_history`.

**Recetas** (`/catalogo/recetas`)
- Receta con ingredientes: cada ingrediente puede ser `insumo` o `sub-receta`
- Detección de ciclos en sub-recetas vía `recipe_has_cycle()`

### Proveedores (`/proveedores`)
- Lista de proveedores con saldo pendiente (de `saldos_proveedores` view)
- Detalle con compras, pagos e historial
- Registrar compra → actualiza `current_price` del insumo + crea entrada en `insumo_price_history`
- Registrar pago → crea entrada en `pagos_proveedor`

### Operación Diaria (`/operacion`)
- Lista de días operativos con estado (abierto/cerrado)
- Detalle del día: tabla de productos con columnas Producción y Ventas
- Las ventas de productos **se auto-completan** al importar un cierre Bistrosoft
- Al cerrar un día: propaga movimientos al sistema

### Cierres de caja Bistrosoft (`/operacion/cierres`)
- Upload de PDF del cierre Bistrosoft
- Claude API extrae: fecha, operador, productos (nombre, categoría, cantidad, monto), totales por medio de pago
- **Matching de productos** en 3 estrategias (prioridad descendente):
  1. Alias previo (`producto_aliases` — lo que el usuario mapeó antes con esa fuente)
  2. Nombre exacto (case-sensitive)
  3. Nombre normalizado (lowercase, sin acentos, trim)
- UI de mapeo: ✓ verde si mapeado, ⚠️ amarillo si no. SearchableSelect para mapear, botón "Crear" para crear producto nuevo.
- Al mapear manualmente → se persiste el alias para reconocimiento futuro
- Al guardar el cierre → upsert `movimientos_diarios.ventas` por cada producto mapeado
- Al borrar un cierre → revierte las ventas (resta los movimientos)
- **Botón de desmapeo** (×) en cada fila mapeada para corregir errores
- En el detalle del cierre (`CierreDetailDialog`): pagos divididos en Efectivo y Medios Digitales (colapsable), con deducción de impuesto digital si está configurado.

### Caja (`/caja`)
- Flujo mensual con navegación por mes
- Cards: Ingresos (movimientos manuales + ventas de cierres del mes), Egresos, Resultado
- **Ventas del mes**: card con detalle de efectivo, medios digitales, neto tras impuesto
- Registrar egreso manual
- Egresos aparecen en la lista con categoría, descripción y fecha

### Configuración (`/config`)
- `impuesto_digital_pct`: porcentaje de impuesto sobre medios digitales (tarjetas, QR, online)
- Se guarda en `tenant_config` con key `'impuesto_digital_pct'`
- Afecta a: detalle de cierre, resumen de Caja mensual

---

## Variables de entorno requeridas

Crear `.env.local` con:

```
NEXT_PUBLIC_SUPABASE_URL=        # URL del proyecto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Clave anon pública de Supabase
ANTHROPIC_API_KEY=               # Clave API de Anthropic (para extracción PDF de cierres)
```

El proyecto Supabase es `vclazlnvyvhmrsbuavdc` (se puede ver en la URL del dashboard).

---

## Migraciones aplicadas

Las migraciones en `db/migrations/` están aplicadas al proyecto Supabase remoto. En una PC nueva **no correr las migraciones** — ya están en la DB. Solo correrlas si se crea un proyecto Supabase nuevo desde cero.

| Archivo | Qué hace |
|---------|----------|
| `0001_init.sql` | Tablas base, tenants, memberships, auth |
| `0002_catalog.sql` | insumos, recetas, receta_ingredientes, productos |
| `0003_operations.sql` | dias_operativos, movimientos_diarios |
| `0004_suppliers_cash.sql` | proveedores, compras, compra_items, pagos_proveedor, caja_movimientos |
| `0005_fix_product_costs_yield.sql` | Corrección de cálculo de costos con yield |
| `0006_cerrar_dia_propagate.sql` | Función cerrar_dia con propagación |
| `0007_cerrar_dia_propagate_always.sql` | Mejora: siempre propaga al cerrar |
| `0008_insumos_kind_descartables.sql` | Enum ingrediente_kind, producto_descartables, insumo kind |
| `0009_stock_ajustes.sql` | Tabla insumo_stock_ajustes, vista insumo_stock actualizada |
| `0010_producto_price_history.sql` | Tabla producto_price_history, tabla producto_aliases |
| `0011_fix_insumo_stock_fecha_filter.sql` | Fix: `>=` en lugar de `>` en filtro de fecha del ajuste |

---

## Setup en PC nueva

```bash
# 1. Clonar el repo
git clone <repo-url>
cd magnolia

# 2. Instalar dependencias
npm install

# 3. Crear .env.local con las variables de entorno (copiar manualmente)

# 4. Correr en desarrollo
npm run dev
```

La app queda en `http://localhost:3000`. No hay setup de DB local — todo apunta a Supabase cloud.

---

## Decisiones de diseño importantes

- **No POS**: las ventas se cargan desde PDFs de Bistrosoft, no hay integración con sistema de caja en tiempo real.
- **Snapshots de costos**: `product_costs` es una vista dinámica (recalcula con precios actuales). Para historial real de márgenes se usa `producto_price_history` que captura `total_cost` y `margin_pct` en el momento del cambio de precio.
- **Stock ajustable**: el stock teórico no es editable directamente. Se ingresa el "stock real contado" y el sistema calcula la diferencia. Desde ese punto, el stock sigue acumulando compras y descontando consumo de esa nueva base.
- **Aliases de Bistrosoft**: los nombres en los PDFs no coinciden con los del catálogo. El matching automático resuelve la mayoría; los manuales se persisten para la próxima vez.
- **Multi-tenant**: aunque actualmente solo hay un tenant (Carolina), toda la arquitectura está preparada para múltiples negocios.
- **Sin POS en fase 1**: las ventas en `movimientos_diarios` se llenan automáticamente cuando se guarda un cierre Bistrosoft. No hay input manual de ventas (salvo el editor de Operación Diaria).

---

## Convenciones de código

- **Comentarios**: solo cuando el "por qué" no es obvio. Sin comentarios que expliquen qué hace el código.
- **Server Actions**: archivo `actions.ts` de cada feature, siempre `'use server'` arriba. Retornan `{ error?: string }` o `{ data, error }`.
- **Queries**: funciones async en `queries.ts`, llamadas desde Server Components. Lanzan errores en lugar de retornar `{ error }`.
- **Dialogs**: patrón estándar — card de estado fuera del `<form>` (stock, historial), formulario dentro del `<Form>` de react-hook-form. El contenido scrollable usa un `div` con `max-h-[72vh] overflow-y-auto` que envuelve todo (cards + form), con el header y footer del dialog fuera del scroll.
- **Tipos**: los componentes reciben props tipadas, sin `any`. Los types de queries se exportan desde `queries.ts`.
- **Idioma UI**: todo en español argentino ("guardando...", "cancelar", "Registrar ajuste", etc.).
