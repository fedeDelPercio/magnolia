/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL || 'test@magnolia.com'
const PASSWORD = process.env.E2E_PASSWORD || 'TestE2E2026!'
const BASE = process.env.BASE_URL || 'http://localhost:3001'
const OUT = 'scripts/.shots/cheques'
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

// Login
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.locator('#email').waitFor({ state: 'visible', timeout: 15000 })
await page.waitForTimeout(800)
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }),
  page.getByRole('button', { name: 'Ingresar' }).click(),
])
console.log('  ✓ login')

// /config — debe estar la nueva card "Límite mensual de cheques"
console.log('▶ /config')
await page.goto(`${BASE}/config`, { waitUntil: 'networkidle' })
await page.getByText('Límite mensual de cheques').waitFor({ state: 'visible', timeout: 10000 })
console.log('  ✓ card "Límite mensual de cheques" visible')
await page.screenshot({ path: `${OUT}/config.png`, fullPage: true })

// /alertas — debe renderizar la nueva card de cheques (estado sin configurar o con tono)
console.log('▶ /alertas')
await page.goto(`${BASE}/alertas`, { waitUntil: 'networkidle' })
await page.getByText('Vencimientos').first().waitFor({ state: 'visible', timeout: 10000 })
console.log('  ✓ card "Vencimientos del mes" visible')
await page.screenshot({ path: `${OUT}/alertas.png`, fullPage: true })

await browser.close()

if (errors.length) {
  console.error('\n✗ ERRORES:')
  for (const e of errors) console.error('  ' + e)
  process.exit(1)
}
console.log('\n✓ Smoke OK')
