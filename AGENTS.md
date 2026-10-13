<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Base de datos (Supabase, proyecto "magnolia" `vclazlnvyvhmrsbuavdc`)

- Para correr SQL (consultas, migraciones, arreglos de datos) se usa la CLI de Supabase, que ya tiene la sesión iniciada y el repo vinculado (`supabase/.temp`, ignorado en git):
  `supabase db query --linked --workdir C:/dev/Claude/Magnolia-bento -f archivo.sql` (o con el SQL entre comillas en vez de `-f`).
- El conector Supabase de claude.ai sirve para leer, pero en estas sesiones responde `declined` a todo lo que escribe: no usarlo para migraciones ni arreglos.
- Migraciones en `db/migrations/NNNN_nombre.sql`, que se puedan correr dos veces sin romper nada. Si agregan tablas o columnas, actualizar `src/types/database.ts`.
- Arreglos de datos: dentro de una transacción, con controles que corten si algo no da lo esperado. Guardarlos en `db/fixes/`.
- Datos reales: tenant "Magnolia Demo". Pruebas: tenant "Magnolia Test" (usuario test@magnolia.com).
