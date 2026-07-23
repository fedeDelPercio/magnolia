---
name: whatsapp-novedades
description: Genera un mini-resumen de novedades/features listo para mandar por WhatsApp a un cliente o usuario no técnico. Formato bulleteado con emoji + título corto + explicación simple + ✅. Usar cuando el usuario pide "armá las novedades", "resumen para el cliente", "changelog para WhatsApp", "qué le mando al cliente", "release notes simples", o similar. Genérico y reutilizable entre proyectos.
---

Esta skill produce un mensaje corto de novedades para mandar por WhatsApp a un cliente/usuario **no técnico**. El objetivo es que entienda qué gana, no cómo está hecho.

## Qué reúne primero

Las features a comunicar pueden venir de:
1. **El usuario las lista** en el pedido → usá esas.
2. **Se piden desde el trabajo reciente** ("resumí lo que hicimos hoy", "las novedades de esta semana") → derivalas de los commits/PRs recientes (`git log`, mensajes de commit, diff). Traducí cada cambio técnico a un beneficio para el usuario final.

Antes de escribir:
- **Nombre del proyecto/producto**: necesario para el título. Si no lo sabés, deducilo del repo (package.json, README, título de la app) o preguntá en una línea.
- **Idioma y tono**: por defecto español rioplatense informal ("vos", "cargás", "mirás"). Igualá el idioma en que el usuario describió las features. Si el proyecto apunta a otro país/idioma, adaptá.
- **Filtrá lo interno**: refactors, fixes de tipos, cambios de infra, renombres de variables, migraciones → NO van (al cliente no le importan). Solo lo que el usuario percibe o usa. Un bugfix va solo si el usuario sufría ese bug de forma visible, y se redacta como mejora ("Ahora X anda siempre", no "arreglamos el bug de X").

## Formato de salida

```
Novedades de {Proyecto} 🚀

{emoji} {Título corto en negrita/normal}
{1–2 frases en lenguaje simple, orientadas al beneficio.} ✅

{emoji} {Título corto}
{Explicación.} ✅

...
```

Reglas del formato:
- **Encabezado**: `Novedades de {Proyecto} 🚀` (o "Nuevo en {Proyecto}", "Mejoras de {Proyecto}"). Un solo emoji acá.
- **Un ítem por feature**, separados por una línea en blanco.
- Cada ítem: **emoji temático** + **título de 2–5 palabras** en la primera línea; abajo **1–2 frases** que expliquen el beneficio; cerrá con **✅** al final de la explicación.
- El emoji del título debe evocar la feature (📸 factura/foto, 🕚 horario/automático, 🔎 búsqueda, 📈 métricas/comparativa, 🎯 gráfico, 🥐 producto, 🍽️ cocina/operación, 💰 caja/plata, 📋 listado/carga, ⚡ velocidad, 🔔 alertas). No repitas el mismo emoji dos veces.
- WhatsApp no tiene markdown rico: no uses tablas, encabezados `#`, ni links largos. Texto plano + emojis + saltos de línea.

## Reglas de estilo (lo importante)

- **Cero jerga técnica**: nada de "endpoint", "cron", "view", "deploy", "schema", "variante/canal", "concepto_id". Traducí. Ej: "cron a las 23hs" → "se actualiza automáticamente cada noche".
- **Beneficio primero**: qué mejora en el día a día del usuario, no qué archivo se tocó. Ej: no "agregamos delta vs periodo previo en el overview", sí "ahora ves cómo venís contra el mes pasado".
- **Cortito**: 1–2 frases por ítem. Si necesitás 3, probablemente estás explicando de más.
- **Concreto y con ejemplo cuando ayuda**: `"cafe" encuentra "Café"` comunica mejor que "búsqueda insensible a acentos".
- **Segunda persona informal** ("cargás", "ves", "buscás"), cálido pero no exagerado. Sin signos de exclamación por todos lados.
- **Sin promesas de tiempos ni detalles de implementación** (no "deploy en 2 min", no nombres de tablas/componentes).
- Ordená de más impactante / más visible a menos, o agrupá por área si son muchas. Si son más de ~8, sugerí recortar a las más relevantes o dividir en dos mensajes.

## Ejemplo de referencia (tono objetivo)

> Novedades de Magnolia 🚀
>
> 📸 Fecha de factura automática
> Al escanear, la fecha arranca en el día de hoy (ya no la interpreta la IA). Menos errores de carga. ✅
>
> 🥐 Productos que se compran hechos
> Medialunas, muffins, pastelitos y gaseosas se marcan con un tilde y el sistema los toma como insumo solo, descontando stock al venderlos. ✅
>
> 🔎 Búsqueda más flexible
> Buscás sin preocuparte por tildes ni mayúsculas: "cafe" encuentra "Café". ✅

## Cierre

Entregá el mensaje en un bloque de código o claramente delimitado para que el usuario lo copie/pegue de una. Ofrecé variantes si tiene sentido (versión más corta, sumar/sacar features, dividir en dos mensajes).
