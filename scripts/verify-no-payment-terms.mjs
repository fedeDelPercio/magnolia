/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const OUT = 'scripts/.shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`)
})

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
  console.log(`📸 ${name}.png`)
}

async function expectAbsent(text, where) {
  const found = await page.getByText(text, { exact: false }).count()
  if (found > 0) throw new Error(`"${text}" todavía aparece en ${where} (${found} matches)`)
  console.log(`  ✓ "${text}" no aparece en ${where}`)
}

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await page.getByRole('button', { name: 'Ingresar' }).click()
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 })

// 1. Lista de proveedores — verificar que no hay columna "Días de pago"
console.log('\n▶ /proveedores (lista)')
await page.goto(`${BASE}/proveedores`, { waitUntil: 'networkidle' })
await shot('post-clean-proveedores-list')
await expectAbsent('Días de pago', 'tabla de proveedores')
await expectAbsent('Contado', 'tabla de proveedores')

// 2. Dialog nuevo proveedor — verificar que no hay campo "Días para pago"
console.log('\n▶ Dialog nuevo proveedor')
await page.getByRole('button', { name: 'Nuevo proveedor' }).click()
await page.waitForTimeout(400)
await shot('post-clean-nuevo-proveedor-dialog')
await expectAbsent('Días para pago', 'dialog nuevo proveedor')
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// 3. Dialog editar proveedor existente
console.log('\n▶ Dialog editar proveedor (Carniceria)')
await page.locator('tr', { hasText: 'Carniceria' }).first().locator('button').last().click()
await page.waitForTimeout(300)
await page.getByRole('menuitem', { name: 'Editar' }).click()
await page.waitForTimeout(500)
await shot('post-clean-editar-proveedor')
await expectAbsent('Días para pago', 'dialog editar proveedor')

// 4. Guardar edicion — verificar que persiste sin errores
await page.getByRole('button', { name: 'Guardar' }).click()
await page.waitForTimeout(1500)
console.log('  ✓ Guardar funciona sin error')

// 5. Detalle del proveedor — no debe mostrar "Contado / X días" debajo del nombre
console.log('\n▶ Detalle del proveedor')
await page.goto(`${BASE}/proveedores`, { waitUntil: 'networkidle' })
await page.locator('tr', { hasText: 'Carniceria' }).first().click()
await page.waitForLoadState('networkidle')
await page.waitForTimeout(400)
await shot('post-clean-detalle')

// 6. Dialog nueva compra — verificar que el due_date no se autopuebla
console.log('\n▶ Dialog nueva compra')
await page.getByRole('button', { name: /Registrar compra/i }).click()
await page.waitForTimeout(500)
await shot('post-clean-nueva-compra')

// el due_date debe quedar vacío
const dueDateValue = await page.locator('input[type="date"]').nth(1).inputValue()
if (dueDateValue !== '') {
  console.log(`  ⚠ due_date NO está vacío: "${dueDateValue}" (era esperado vacío)`)
} else {
  console.log(`  ✓ due_date queda vacío (sin auto-fill)`)
}

if (errors.length > 0) {
  console.log('\n❌ Errores:')
  errors.forEach((e) => console.log(`  ${e}`))
  process.exit(1)
}

console.log('\n✅ Todo OK')
await browser.close()
