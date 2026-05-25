/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const OUT = 'scripts/.shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1800 } })
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

console.log('▶ /dashboard?month=2026-05 (default = mes, últimos 12 meses)')
await page.goto(`${BASE}/dashboard?month=2026-05`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.screenshot({ path: `${OUT}/v3-dashboard-default.png`, fullPage: true })

const checks = [
  'Movimiento del mes',
  'Ticket promedio',
  'Costo de comida',
  'Costo de personal',
  'Costo primario',
  'Evolución de facturación',
  'efectivo',
  'digital',
  'Día',
  'Semana',
  'Mes',
]
for (const text of checks) {
  const count = await page.getByText(text, { exact: false }).count()
  if (count === 0) errors.push(`Falta: "${text}"`)
  else console.log(`  ✓ "${text}"`)
}

console.log('\n▶ Click en granularidad "Día"')
await page.locator('button', { hasText: 'Día' }).first().click()
await page.waitForURL((u) => u.search.includes('evGran=dia'), { timeout: 10000 })
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/v3-dashboard-dia.png`, fullPage: false })
console.log('  ✓ granularidad cambió a día')

console.log('\n▶ Cambio rango personalizado: 2026-01-01 a 2026-06-01')
await page.locator('input[type="date"]').first().fill('2026-01-01')
await page.waitForTimeout(800)
await page.locator('input[type="date"]').last().fill('2026-06-01')
await page.waitForTimeout(1500)
await page.screenshot({ path: `${OUT}/v3-dashboard-custom.png`, fullPage: false })

console.log('\n▶ Verificar % en productos rentables')
await page.goto(`${BASE}/dashboard?month=2026-05`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const hasPct = await page.locator('text=/[0-9]+%/').count()
console.log(`  ℹ Total elementos con %: ${hasPct}`)

if (errors.length > 0) {
  console.log('\n❌ Errores:')
  errors.forEach((e) => console.log(`  ${e}`))
  process.exit(1)
}
console.log('\n✅ V3 OK')
await browser.close()
