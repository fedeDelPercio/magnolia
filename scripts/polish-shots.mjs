/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL || 'fndelpercio@gmail.com'
const PASSWORD = process.env.E2E_PASSWORD || 'Fede1498'
const BASE = process.env.BASE_URL || 'http://localhost:3001'
const OUT = process.env.OUT_DIR || 'scripts/.shots/polish'
const LABEL = process.env.LABEL || 'before'

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
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

console.log(`▶ Login (${BASE})`)
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
await page.locator('#email').waitFor({ state: 'visible', timeout: 15000 })
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }),
  page.getByRole('button', { name: 'Ingresar' }).click(),
])
console.log('  ✓ login OK')

const routes = [
  ['/dashboard?from=2026-05-01&to=2026-06-01', `dashboard-${LABEL}`],
  ['/alertas', `alertas-${LABEL}`],
  ['/catalogo/insumos', `insumos-${LABEL}`],
  ['/proveedores', `proveedores-${LABEL}`],
  ['/operacion', `operacion-${LABEL}`],
  ['/caja', `caja-${LABEL}`],
]

for (const [path, name] of routes) {
  console.log(`▶ ${path}`)
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
  console.log(`  📸 ${OUT}/${name}.png`)
}

// Captura específica del dropdown del top-nav para inspección
console.log('▶ Top-nav dropdown')
await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(400)
const moreBtn = page.getByRole('button', { name: /más|otras|menu/i }).first()
if (await moreBtn.count()) {
  await moreBtn.click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/topnav-open-${LABEL}.png`, fullPage: false })
  console.log(`  📸 topnav-open`)
}

if (errors.length > 0) {
  console.log('\n❌ Errores:')
  errors.forEach((e) => console.log(`  ${e}`))
  await browser.close()
  process.exit(1)
}
console.log('\n✅ OK')
await browser.close()
