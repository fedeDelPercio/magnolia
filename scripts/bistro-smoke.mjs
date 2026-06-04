/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL || 'test@magnolia.com'
const PASSWORD = process.env.E2E_PASSWORD || 'TestE2E2026!'
const BASE = process.env.BASE_URL || 'http://localhost:3001'
const OUT = 'scripts/.shots/bistro'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
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

// Login (esperar hidratación antes de submit, sino el form se manda como GET)
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.locator('#email').waitFor({ state: 'visible', timeout: 15000 })
await page.waitForTimeout(800)
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }),
  page.getByRole('button', { name: 'Ingresar' }).click(),
])
console.log('  ✓ login')

// /config — la card debe estar
console.log('▶ /config')
await page.goto(`${BASE}/config`, { waitUntil: 'networkidle' })
const bistroCard = page.getByText('Conexión Bistrosoft API')
await bistroCard.waitFor({ state: 'visible', timeout: 10000 })
console.log('  ✓ card "Conexión Bistrosoft API" visible')
await page.screenshot({ path: `${OUT}/config-bistro.png`, fullPage: true })
console.log(`  ✓ shot → ${OUT}/config-bistro.png`)

// /dashboard — debería seguir funcionando exactamente igual (views activas)
console.log('▶ /dashboard')
await page.goto(`${BASE}/dashboard?from=2026-05-01&to=2026-06-01`, { waitUntil: 'networkidle' })
const facturacion = page.getByText('Facturación del período', { exact: true })
await facturacion.waitFor({ state: 'visible', timeout: 10000 })
console.log('  ✓ dashboard renderiza con las views activas')
await page.screenshot({ path: `${OUT}/dashboard-after-refactor.png`, fullPage: true })
console.log(`  ✓ shot → ${OUT}/dashboard-after-refactor.png`)

await browser.close()

if (errors.length) {
  console.error('\n✗ ERRORES detectados:')
  for (const e of errors) console.error('  ' + e)
  process.exit(1)
}
console.log('\n✓ Smoke OK — sin errores de consola ni HTTP 5xx')
