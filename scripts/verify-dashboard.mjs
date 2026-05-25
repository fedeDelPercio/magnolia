/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const OUT = 'scripts/.shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } })
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

// 1. Dashboard mes actual (sin cierres)
console.log('▶ /dashboard (mes actual)')
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/dashboard-actual.png`, fullPage: true })
console.log('📸 dashboard-actual.png')

// 2. Dashboard de mayo (con cierres)
console.log('\n▶ /dashboard?month=2026-05')
await page.goto(`${BASE}/dashboard?month=2026-05`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/dashboard-mayo.png`, fullPage: true })
console.log('📸 dashboard-mayo.png')

// Verificar elementos clave
const checks = [
  'Facturación del mes',
  'Cubiertos en salón',
  'Food cost',
  'Evolución de facturación',
  'Medios de pago',
  'Salón vs Mostrador',
  'Top productos vendidos',
  'Productos más rentables',
  'Productos en riesgo',
  'Stock crítico',
]
for (const text of checks) {
  const count = await page.getByText(text, { exact: false }).count()
  if (count === 0) {
    errors.push(`Falta sección: "${text}"`)
  } else {
    console.log(`  ✓ "${text}" visible`)
  }
}

// 3. Click en month picker (←) y verificar que cambia
console.log('\n▶ Click en mes anterior')
const prevBtn = page.locator('button:has(svg.lucide-chevron-left)').first()
await prevBtn.click()
await page.waitForTimeout(800)
const url = page.url()
if (!url.includes('month=')) errors.push('El click en prev no actualizó la URL')
else console.log(`  ✓ URL actualizada: ${url.split('?')[1]}`)
await page.screenshot({ path: `${OUT}/dashboard-prev.png`, fullPage: true })
console.log('📸 dashboard-prev.png')

if (errors.length > 0) {
  console.log('\n❌ Errores:')
  errors.forEach((e) => console.log(`  ${e}`))
  process.exit(1)
}
console.log('\n✅ Dashboard OK')
await browser.close()
