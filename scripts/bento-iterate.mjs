/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
const BASE = process.env.BASE_URL || 'http://localhost:3001'
const ITERATION = process.env.ITER || '1'
const OUT = `scripts/.shots/iter-${ITERATION}`
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1800 } })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`) })
page.on('response', (r) => { if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`) })

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 })
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await page.getByRole('button', { name: 'Ingresar' }).click()
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 })

console.log(`▶ Iteración ${ITERATION}`)
await page.goto(`${BASE}/dashboard?from=2026-05-01&to=2026-06-01`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)

await page.screenshot({ path: `${OUT}/full.png`, fullPage: true })
console.log(`📸 ${OUT}/full.png`)

// Snip de la parte hero (header + hero cards)
await page.screenshot({ path: `${OUT}/hero.png`, fullPage: false, clip: { x: 0, y: 0, width: 1440, height: 800 } })
console.log(`📸 ${OUT}/hero.png`)

if (errors.length > 0) {
  console.log('\n⚠ Errores:')
  errors.forEach((e) => console.log(`  ${e}`))
}

await browser.close()
