/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL || 'demo@magnolia.com'
const PASSWORD = process.env.E2E_PASSWORD || 'DemoMagnolia2026!'
const BASE = process.env.BASE_URL || 'http://localhost:3001'
const OUT = 'scripts/.shots/redesign'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
// Viewport laptop estándar (1366×768) menos ~100px de chrome de Chrome → simula vista real.
const ctx = await browser.newContext({ viewport: { width: 1366, height: 700 } })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') {
    const t = m.text()
    if (!t.includes('Download the React DevTools')) errors.push(`console.error: ${t}`)
  }
})
page.on('response', (r) => {
  if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`)
})

// Login
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.locator('#email').waitFor({ state: 'visible', timeout: 15000 })
await page.waitForTimeout(400)
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }),
  page.getByRole('button', { name: 'Ingresar' }).click(),
])

async function shot(path, name, fullPage = false) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  // fullPage=false → captura sólo el viewport (lo que se ve sin scroll). Es lo que queremos validar.
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage })
  console.log(`📸 ${name}.png ${fullPage ? '(full)' : '(viewport)'}`)
}

await shot('/empleados', '01-empleados')
await shot('/proveedores', '02-proveedores')
await shot('/operacion', '03-operacion')

// Probar buscador en empleados
await page.goto(`${BASE}/empleados`, { waitUntil: 'networkidle' })
await page.locator('input[placeholder="Buscar por nombre…"]').fill('bri')
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/04-empleados-search.png`, fullPage: true })
console.log('📸 04-empleados-search.png')

// Navegar a mayo 2026 vía URL directa (más fiable que click cross-chevron)
await page.goto(`${BASE}/operacion?month=2026-05`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.screenshot({ path: `${OUT}/05-operacion-mayo.png`, fullPage: true })
console.log('📸 05-operacion-mayo.png')

// Vista de un mes con días cerrados (volver a abril si los datos existen)
await page.goto(`${BASE}/operacion?month=2026-04`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.screenshot({ path: `${OUT}/06-operacion-abril.png`, fullPage: true })
console.log('📸 06-operacion-abril.png')

if (errors.length) {
  console.log('\n❌ Errors detected:')
  for (const e of errors) console.log('  ', e)
  process.exit(1)
}

console.log('\n✅ All shots OK')
await browser.close()
