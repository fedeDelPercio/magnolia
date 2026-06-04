/* eslint-disable */
import { chromium } from '@playwright/test'

const EMAIL = process.env.E2E_EMAIL || 'demo@magnolia.com'
const PASSWORD = process.env.E2E_PASSWORD || 'DemoMagnolia2026!'
const BASE = process.env.BASE_URL || 'http://localhost:3001'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1366, height: 700 } })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') console.log('console.error:', m.text())
})
page.on('framenavigated', (f) => console.log('navigated →', f.url()))

// Login
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.locator('#email').waitFor({ state: 'visible', timeout: 15000 })
await page.waitForTimeout(300)
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }),
  page.getByRole('button', { name: 'Ingresar' }).click(),
])

// Test 1: proveedores → click sobre el saldo
await page.goto(`${BASE}/proveedores`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await Promise.all([
  page.waitForURL(/\/proveedores\/[0-9a-f-]+$/, { timeout: 5000 }).catch(() => null),
  page.getByText('$ 3.844.094,93').click(),
])
await page.waitForTimeout(800)
const url1 = page.url()
console.log('proveedores click saldo →', url1)
if (!url1.match(/\/proveedores\/[0-9a-f-]+$/)) {
  console.error('❌ FAIL: no navegó al detalle')
  process.exit(1)
}

// Test 2: empleados → click sobre Plus mensual
await page.goto(`${BASE}/empleados`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await Promise.all([
  page.waitForURL(/\/empleados\/[0-9a-f-]+$/, { timeout: 5000 }).catch(() => null),
  page.getByText('Plus mensual').first().click(),
])
await page.waitForTimeout(800)
const url2 = page.url()
console.log('empleados click plus mensual →', url2)
if (!url2.match(/\/empleados\/[0-9a-f-]+$/)) {
  console.error('❌ FAIL: no navegó al detalle')
  process.exit(1)
}

// Test 3: dropdown "..." NO navega
await page.goto(`${BASE}/proveedores`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const urlBefore = page.url()
await page.locator('button[aria-haspopup="menu"]').first().click()
await page.waitForTimeout(300)
const urlAfter = page.url()
if (urlBefore !== urlAfter) {
  console.error('❌ FAIL: el dropdown disparó navegación')
  process.exit(1)
}
const menuVisible = await page.getByRole('menuitem', { name: 'Editar' }).isVisible()
console.log('dropdown stopPropagation OK, menú visible:', menuVisible)

if (errors.length) {
  console.log('\n❌ Errores:')
  for (const e of errors) console.log(' ', e)
  process.exit(1)
}

console.log('\n✅ Click en cualquier parte navega, dropdown no')
await browser.close()
