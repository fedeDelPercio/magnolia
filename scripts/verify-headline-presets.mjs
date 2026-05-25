/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
const BASE = process.env.BASE_URL || 'http://localhost:3001'
const OUT = 'scripts/.shots/headline-fix'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await page.getByRole('button', { name: 'Ingresar' }).click()
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 })

// Estado actual = mayo 2026
await page.goto(`${BASE}/dashboard?from=2026-05-01&to=2026-06-01`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.screenshot({ path: `${OUT}/mes-mayo.png`, fullPage: false, clip: { x: 0, y: 0, width: 1440, height: 900 } })
console.log('📸 mes-mayo (debería decir Mayo 2026 + Así está evolucionando)')

// Click "Últimos 3 meses" desde el RangePicker
await page.locator('button', { hasText: 'Mayo 2026' }).click()
await page.waitForTimeout(300)
await page.locator('button', { hasText: 'Últimos 3 meses' }).click()
await page.waitForTimeout(1000)
const url1 = page.url()
console.log(`  URL después de "Últimos 3 meses": ${url1.split('?')[1]}`)
await page.screenshot({ path: `${OUT}/ultimos-3-meses.png`, fullPage: false, clip: { x: 0, y: 0, width: 1440, height: 900 } })

// Click "Últimos 6 meses"
await page.locator('button', { hasText: /Febrero|Mayo/ }).first().click()
await page.waitForTimeout(300)
await page.locator('button', { hasText: 'Últimos 6 meses' }).click()
await page.waitForTimeout(1000)
const url2 = page.url()
console.log(`  URL después de "Últimos 6 meses": ${url2.split('?')[1]}`)
await page.screenshot({ path: `${OUT}/ultimos-6-meses.png`, fullPage: false, clip: { x: 0, y: 0, width: 1440, height: 900 } })

await browser.close()
console.log('\n✅ done')
