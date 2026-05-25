/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const OUT = 'scripts/.shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 2200 } })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`) })
page.on('response', (r) => { if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`) })

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 })
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await page.getByRole('button', { name: 'Ingresar' }).click()
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 })

console.log('▶ /dashboard?from=2026-05-01&to=2026-06-01')
await page.goto(`${BASE}/dashboard?from=2026-05-01&to=2026-06-01`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.screenshot({ path: `${OUT}/v4-dashboard-mes.png`, fullPage: true })

// Checks
const checks = ['Movimiento del mes', 'Ticket promedio', 'Food Cost', 'Labor Cost', 'Prime Cost', 'Costo de comida', 'Costo de personal', 'Costo primario', 'Evolución de facturación']
for (const text of checks) {
  const count = await page.getByText(text, { exact: false }).count()
  if (count === 0) errors.push(`Falta: "${text}"`)
  else console.log(`  ✓ "${text}"`)
}

// RangePicker visible y abrible
console.log('\n▶ RangePicker')
await page.locator('button', { hasText: /Mayo 2026|2026/ }).first().click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/v4-rangepicker-open.png`, fullPage: false, clip: { x: 1000, y: 0, width: 440, height: 600 } })

// Click "Últimos 3 meses"
await page.locator('button', { hasText: 'Últimos 3 meses' }).click()
await page.waitForURL((u) => u.search.includes('from=') && u.search.includes('to='), { timeout: 10000 })
await page.waitForTimeout(800)
await page.screenshot({ path: `${OUT}/v4-dashboard-3meses.png`, fullPage: true })

// Cambio granularidad
console.log('\n▶ Cambio granularidad a Día')
await page.locator('button', { hasText: 'Día' }).first().click()
await page.waitForTimeout(800)
await page.screenshot({ path: `${OUT}/v4-dashboard-3meses-dia.png`, fullPage: true })

if (errors.length > 0) {
  console.log('\n❌ Errores:')
  errors.forEach((e) => console.log(`  ${e}`))
  process.exit(1)
}
console.log('\n✅ V4 OK')
await browser.close()
