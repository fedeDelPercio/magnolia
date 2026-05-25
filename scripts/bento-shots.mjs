/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
const BASE = process.env.BASE_URL || 'http://localhost:3001'
const OUT = 'scripts/.shots'

mkdirSync(OUT, { recursive: true })

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
  console.log(`📸 ${OUT}/${name}.png`)
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`)
})

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await page.getByRole('button', { name: 'Ingresar' }).click()
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 })
console.log('✓ login')

const routes = [
  ['/dashboard', 'dashboard'],
  ['/catalogo/insumos', 'insumos'],
  ['/proveedores', 'proveedores'],
  ['/alertas', 'alertas'],
  ['/caja', 'caja'],
  ['/operacion', 'operacion'],
]

for (const [path, name] of routes) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await shot(page, name)
}

if (errors.length > 0) {
  console.log('\n⚠ errors:')
  errors.forEach((e) => console.log(`  ${e}`))
}

await browser.close()
