/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
const BASE = process.env.BASE_URL || 'http://localhost:3001'
const OUT = 'scripts/.shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await page.getByRole('button', { name: 'Ingresar' }).click()
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 })

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
  console.log(`📸 ${name}.png`)
}

// 1. Nuevo insumo dialog
await page.goto(`${BASE}/catalogo/insumos`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Nuevo insumo' }).click()
await page.waitForTimeout(500)
await shot('dialog-1-nuevo-insumo')

// 2. Editar insumo (un insumo con stock, para que aparezca la card de stock)
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
await page.locator('tr', { hasText: 'Carne' }).first().click()
await page.waitForTimeout(500)
await shot('dialog-2-ver-insumo')
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// 3. Nuevo proveedor dialog
await page.goto(`${BASE}/proveedores`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Nuevo proveedor' }).click()
await page.waitForTimeout(500)
await shot('dialog-3-nuevo-proveedor')
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// 4. Editar proveedor (con regla de pago — el dialog mas largo)
await page.locator('tr', { hasText: 'Carniceria' }).first().locator('button').last().click()
await page.waitForTimeout(300)
await page.getByRole('menuitem', { name: 'Editar' }).click()
await page.waitForTimeout(500)
await shot('dialog-4-editar-proveedor')
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// 5. Dropdown menu
await page.goto(`${BASE}/catalogo/insumos`, { waitUntil: 'networkidle' })
await page.locator('tr', { hasText: 'Carne' }).first().locator('button').last().click()
await page.waitForTimeout(400)
await shot('dropdown-menu')

await browser.close()
console.log('\n✅ 5 shots tomados')
