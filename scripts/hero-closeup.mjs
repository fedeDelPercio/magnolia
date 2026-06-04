/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL || 'test@magnolia.com'
const PASSWORD = process.env.E2E_PASSWORD || 'TestE2E2026!'
const BASE = process.env.BASE_URL || 'http://localhost:3001'
const OUT = 'scripts/.shots/reviews'
const LABEL = process.env.LABEL || 'closeup'

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.locator('#email').waitFor({ state: 'visible', timeout: 15000 })
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }),
  page.getByRole('button', { name: 'Ingresar' }).click(),
])

await page.goto(`${BASE}/dashboard?from=2026-05-01&to=2026-06-01`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(700)

// Crop del hero + costos (donde están los números más grandes)
await page.screenshot({ path: `${OUT}/hero-${LABEL}.png`, clip: { x: 30, y: 0, width: 1280, height: 400 } })
console.log(`  📸 hero-${LABEL}.png`)

// Crop del bloque de costos card (donde los números 58.3%, 7.0%, 65.3% son grandes)
await page.screenshot({ path: `${OUT}/costos-${LABEL}.png`, clip: { x: 30, y: 760, width: 1280, height: 220 } })
console.log(`  📸 costos-${LABEL}.png`)

await browser.close()
console.log('✅ done')
