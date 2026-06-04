/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL || 'demo@magnolia.com'
const PASSWORD = process.env.E2E_PASSWORD || 'DemoMagnolia2026!'
const BASE = process.env.BASE_URL || 'http://localhost:3001'
const OUT = 'scripts/.shots/cheque-cleared'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 } })
const page = await ctx.newPage()

const errs = []
page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') {
    const t = m.text()
    if (!t.includes('Download the React DevTools')) errs.push(`console.error: ${t}`)
  }
})

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.locator('#email').waitFor({ state: 'visible', timeout: 15000 })
await page.waitForTimeout(800)
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }),
  page.getByRole('button', { name: 'Ingresar' }).click(),
])

// Buscar Carniceria desde el listado de proveedores
await page.goto(`${BASE}/proveedores`, { waitUntil: 'networkidle' })
const carni = page.getByRole('link', { name: /Carniceria/i }).first()
await carni.waitFor({ state: 'visible', timeout: 10000 })
await carni.click()
await page.waitForLoadState('networkidle')

// Captura proveedor con cheque (fecha corta, pendiente amber)
await page.screenshot({ path: `${OUT}/proveedor.png`, fullPage: true })

await page.goto(`${BASE}/caja`, { waitUntil: 'networkidle' })
await page.screenshot({ path: `${OUT}/caja.png`, fullPage: true })

await browser.close()

if (errs.length) {
  console.error('✗ ERRORES:')
  for (const e of errs) console.error('  ' + e)
  process.exit(1)
}
console.log('OK')
