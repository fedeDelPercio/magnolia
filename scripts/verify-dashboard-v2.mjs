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
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`)
})
page.on('response', (r) => {
  if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`)
})

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await page.getByRole('button', { name: 'Ingresar' }).click()
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 })

console.log('▶ /dashboard?month=2026-05 (V2 completo)')
await page.goto(`${BASE}/dashboard?month=2026-05`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.screenshot({ path: `${OUT}/v2-dashboard-mayo.png`, fullPage: true })
console.log('📸 v2-dashboard-mayo.png')

const checks = [
  'Estructura de costos',
  'Food Cost',
  'Labor Cost',
  'Prime Cost',
  'Menu Engineering',
  'Estrella',
  'Caballito',
  'Acertijo',
  'Perro',
  'Top insumos en gasto',
  'Insumos con suba',
]
for (const text of checks) {
  const count = await page.getByText(text, { exact: false }).count()
  if (count === 0) errors.push(`Falta sección: "${text}"`)
  else console.log(`  ✓ "${text}" visible`)
}

if (errors.length > 0) {
  console.log('\n❌ Errores:')
  errors.forEach((e) => console.log(`  ${e}`))
  process.exit(1)
}
console.log('\n✅ V2 OK')
await browser.close()
