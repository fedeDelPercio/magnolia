/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL || 'test@magnolia.com'
const PASSWORD = process.env.E2E_PASSWORD || 'TestE2E2026!'
const BASE = process.env.BASE_URL || 'http://localhost:3001'
const OUT = 'scripts/.shots/polish'
const LABEL = process.env.LABEL || 'final'

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

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.locator('#email').waitFor({ state: 'visible', timeout: 15000 })
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }),
  page.getByRole('button', { name: 'Ingresar' }).click(),
])
console.log('  ✓ login')

const routes = [
  ['/dashboard?from=2026-05-01&to=2026-06-01', `dashboard-${LABEL}`, true],
  ['/alertas', `alertas-${LABEL}`, true],
  ['/catalogo/insumos', `insumos-${LABEL}`, false],
  ['/catalogo/productos', `productos-${LABEL}`, false],
  ['/proveedores', `proveedores-${LABEL}`, true],
  ['/operacion', `operacion-${LABEL}`, false],
  ['/caja', `caja-${LABEL}`, false],
  ['/config', `config-${LABEL}`, true],
  ['/reportes', `reportes-${LABEL}`, true],
]

for (const [path, name, fullPage] of routes) {
  console.log(`▶ ${path}`)
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage, timeout: 60000 })
    console.log(`  📸 ${OUT}/${name}.png`)
  } catch (e) {
    console.log(`  ⚠ ${name} fallback viewport: ${e.message?.split('\n')[0] ?? e}`)
    try {
      await page.screenshot({ path: `${OUT}/${name}.png` })
      console.log(`  📸 ${OUT}/${name}.png (viewport)`)
    } catch (e2) {
      console.log(`  ❌ skip ${name}`)
    }
  }
}

// Dropdown
await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(400)
await page.getByRole('button', { name: 'Menú de usuario' }).click()
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/topnav-dropdown-${LABEL}.png`, clip: { x: 1000, y: 0, width: 440, height: 280 } })
console.log(`  📸 topnav-dropdown`)

// Range picker
await page.keyboard.press('Escape')
await page.waitForTimeout(200)
await page.locator('button:has(svg)').filter({ hasText: /20\d\d/ }).first().click()
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/range-picker-${LABEL}.png`, clip: { x: 880, y: 0, width: 560, height: 500 } })
console.log(`  📸 range-picker`)

if (errors.length > 0) {
  console.log('\n❌ Errores:')
  errors.forEach((e) => console.log(`  ${e}`))
  await browser.close()
  process.exit(1)
}
console.log('\n✅ OK')
await browser.close()
