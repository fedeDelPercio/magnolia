/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL || 'demo@magnolia.com'
const PASSWORD = process.env.E2E_PASSWORD || 'DemoMagnolia2026!'
const BASE = process.env.BASE_URL || 'http://localhost:3001'
const OUT = 'scripts/.shots/proveedor-redesign'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') {
    const t = m.text()
    if (!t.includes('Download the React DevTools')) errors.push(`console.error: ${t}`)
  }
})

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.locator('#email').waitFor({ state: 'visible', timeout: 15000 })
await page.waitForTimeout(400)
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }),
  page.getByRole('button', { name: 'Ingresar' }).click(),
])

// 1) Proveedores list — pills "Activo" no deben aparecer
await page.goto(`${BASE}/proveedores`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.screenshot({ path: `${OUT}/01-proveedores-list.png`, fullPage: false })
console.log('📸 01-proveedores-list.png')

// 2) Click Carniceria (saldo más alto entre activos)
await Promise.all([
  page.waitForURL(/\/proveedores\/[0-9a-f-]+$/, { timeout: 5000 }).catch(() => null),
  page.getByText('Carniceria').first().click(),
])
await page.waitForTimeout(1000)
await page.screenshot({ path: `${OUT}/02-proveedor-detail-default.png`, fullPage: true })
console.log('📸 02-proveedor-detail-default.png')

// 3) Cambiar a "Año actual" via URL para garantizar — vamos a "Distribuidora Test" que tiene varios insumos
await page.goto(`${BASE}/proveedores`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await Promise.all([
  page.waitForURL(/\/proveedores\/[0-9a-f-]+$/, { timeout: 5000 }).catch(() => null),
  page.getByText('Distribuidora Test').first().click(),
])
await page.waitForTimeout(800)
const detailUrl = page.url()
await page.goto(`${detailUrl}?from=2026-01-01&to=2027-01-01`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.screenshot({ path: `${OUT}/03-proveedor-detail-anio.png`, fullPage: true })
console.log('📸 03-proveedor-detail-anio.png')

// 4) Click sobre una compra para expandirla
await page.getByRole('button').filter({ hasText: /\d+ ítem/ }).first().click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/04-compra-expandida.png`, fullPage: true })
console.log('📸 04-compra-expandida.png')

// 5) Cambiar insumo en el dropdown
const select = page.locator('#insumo-select')
await select.scrollIntoViewIfNeeded()
const options = await select.locator('option').allTextContents()
console.log('Insumos disponibles:', options)
if (options.length >= 2) {
  await select.selectOption({ index: 1 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/05-otro-insumo.png`, fullPage: true })
  console.log('📸 05-otro-insumo.png')
}

// 6) Catálogo productos — pills Margen/Activo en verde Magnolia
await page.goto(`${BASE}/catalogo/productos`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.screenshot({ path: `${OUT}/06-catalogo-productos.png`, fullPage: false })
console.log('📸 06-catalogo-productos.png')

// 7) Catálogo insumos — pill Activo
await page.goto(`${BASE}/catalogo/insumos`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.screenshot({ path: `${OUT}/07-catalogo-insumos.png`, fullPage: false })
console.log('📸 07-catalogo-insumos.png')

if (errors.length) {
  console.log('\n❌ Errores:')
  for (const e of errors) console.log(' ', e)
  process.exit(1)
}
console.log('\n✅ Todo OK')
await browser.close()
