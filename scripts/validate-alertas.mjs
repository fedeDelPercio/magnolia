/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000'
const SHOTS = 'scripts/.shots'

mkdirSync(SHOTS, { recursive: true })

async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
  console.log(`  📸 ${SHOTS}/${name}.png`)
}

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  await page.locator('#email').fill(EMAIL)
  await page.locator('#password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 })
  console.log('  ✓ Login ok')
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()

  // capture client-side errors
  const consoleErrors = []
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`)
  })
  page.on('response', (r) => {
    if (r.status() >= 500) consoleErrors.push(`HTTP ${r.status()} ${r.url()}`)
  })

  try {
    console.log('▶ Login')
    await login(page)

    console.log('\n▶ /alertas (estado inicial)')
    await page.goto(`${BASE_URL}/alertas`, { waitUntil: 'networkidle' })
    await page.waitForLoadState('networkidle')
    await shot(page, '01-alertas-vacia')

    // Verify IVA balance card is present
    const ivaTitle = page.getByText('Balanza de IVA', { exact: false }).first()
    await ivaTitle.waitFor({ timeout: 5000 })
    console.log('  ✓ Balanza IVA visible')

    async function openEditDialog(proveedorName) {
      await page.goto(`${BASE_URL}/proveedores`, { waitUntil: 'networkidle' })
      // Find the row containing this proveedor, then click its menu button
      const row = page.locator('tr', { hasText: proveedorName }).first()
      await row.locator('button').last().click() // dropdown trigger (last button in row)
      await page.waitForTimeout(300)
      await page.getByRole('menuitem', { name: 'Editar' }).click()
      await page.waitForTimeout(500)
    }

    console.log('\n▶ Editar Carniceria (regla monto + IVA)')
    await openEditDialog('Carniceria')
    await shot(page, '02-carniceria-edit-dialog')

    // Toggle "Discrimina IVA" via the visible button (Base UI exposes role=checkbox on the button)
    await page.getByRole('checkbox', { name: /Discrimina IVA/i }).click()
    await page.waitForTimeout(100)

    await page.getByRole('button', { name: 'Al alcanzar monto' }).click()
    await page.waitForTimeout(200)
    await page.locator('input[type="number"]').last().fill('100000')
    await shot(page, '03-rule-monto-set')

    await page.getByRole('button', { name: 'Guardar' }).click()
    await page.waitForTimeout(2000)
    await shot(page, '03b-carniceria-after-save')
    console.log('  ✓ Carniceria: monto=100000 + discrimina_iva')

    console.log('\n▶ Editar Distribuidora Test (regla boletas)')
    await openEditDialog('Distribuidora Test')
    await page.getByRole('button', { name: 'Cada N boletas' }).click()
    await page.waitForTimeout(200)
    await page.locator('input[type="number"]').last().fill('1')
    await page.getByRole('button', { name: 'Guardar' }).click()
    await page.waitForTimeout(1500)
    console.log('  ✓ Distribuidora Test: cada 1 boleta')

    console.log('\n▶ Editar FEMSA (regla 2do martes)')
    await openEditDialog('FEMSA')
    await page.getByRole('button', { name: 'N-ésimo día' }).click()
    await page.waitForTimeout(200)
    await page.getByRole('button', { name: 'Guardar' }).click()
    await page.waitForTimeout(1500)
    console.log('  ✓ FEMSA: 2do martes (defaults)')

    console.log('\n▶ /alertas (estado final con reglas)')
    await page.goto(`${BASE_URL}/alertas`, { waitUntil: 'networkidle' })
    await page.waitForLoadState('networkidle')
    await shot(page, '06-alertas-con-reglas')

    // Verify rule cards for active proveedores with rule (Carniceria, Distribuidora Test, FEMSA)
    await page.getByText('Carniceria', { exact: true }).first().waitFor({ timeout: 5000 })
    await page.getByText('Distribuidora Test', { exact: true }).first().waitFor({ timeout: 5000 })
    await page.getByText('FEMSA', { exact: true }).first().waitFor({ timeout: 5000 })
    console.log('  ✓ Cards de Carniceria, Distribuidora Test, FEMSA visibles')

    const summary = await page.locator('text=/a revisar/').first().textContent()
    console.log(`  ℹ Resumen: ${summary?.trim()}`)

    // Verify IVA crédito ahora refleja compras de Carniceria (discrimina_iva = true)
    const creditoText = await page.locator('text=/IVA crédito/').first().locator('..').textContent()
    console.log(`  ℹ ${creditoText?.replace(/\s+/g, ' ').trim().slice(0, 100)}`)
    if (!creditoText?.includes('compras con IVA')) {
      throw new Error('La sección IVA crédito no muestra el monto esperado')
    }

    if (consoleErrors.length > 0) {
      console.log('\n⚠ Errores cliente/servidor:')
      consoleErrors.forEach((e) => console.log(`    ${e}`))
      process.exit(1)
    }

    console.log('\n✅ Todo OK')
  } catch (err) {
    console.error('\n❌ Falló:', err.message)
    await shot(page, 'error')
    if (consoleErrors.length > 0) {
      console.log('Errores capturados:')
      consoleErrors.forEach((e) => console.log(`  ${e}`))
    }
    process.exit(1)
  } finally {
    await browser.close()
  }
}

main()
