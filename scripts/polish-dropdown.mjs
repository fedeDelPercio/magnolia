/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL || 'test@magnolia.com'
const PASSWORD = process.env.E2E_PASSWORD || 'TestE2E2026!'
const BASE = process.env.BASE_URL || 'http://localhost:3001'
const OUT = 'scripts/.shots/polish'
const LABEL = process.env.LABEL || 'after'

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.locator('#email').waitFor({ state: 'visible', timeout: 15000 })
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }),
  page.getByRole('button', { name: 'Ingresar' }).click(),
])
console.log('  ✓ login')

await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(500)

// Open user dropdown via aria-label
await page.getByRole('button', { name: 'Menú de usuario' }).click()
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/topnav-dropdown-${LABEL}.png`, clip: { x: 1000, y: 0, width: 440, height: 280 } })
console.log(`  📸 topnav-dropdown-${LABEL}.png`)

// Test escape key closes dropdown
await page.keyboard.press('Escape')
await page.waitForTimeout(200)

// Open range picker
await page.getByRole('button', { name: /Mayo|Resumen|2026/ }).first().click().catch(async () => {
  await page.locator('button:has(svg)').filter({ hasText: /20\d\d/ }).first().click()
})
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/range-picker-${LABEL}.png`, clip: { x: 900, y: 0, width: 540, height: 480 } })
console.log(`  📸 range-picker-${LABEL}.png`)

// Focus visible: tab into nav
await page.keyboard.press('Escape')
await page.waitForTimeout(200)
await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(400)
await page.keyboard.press('Tab') // brand
await page.keyboard.press('Tab') // nav item
await page.waitForTimeout(200)
await page.screenshot({ path: `${OUT}/nav-focus-${LABEL}.png`, clip: { x: 0, y: 0, width: 1440, height: 90 } })
console.log(`  📸 nav-focus-${LABEL}.png`)

await browser.close()
console.log('✅ done')
