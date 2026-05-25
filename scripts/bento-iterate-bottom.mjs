/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
const BASE = process.env.BASE_URL || 'http://localhost:3001'
const ITER = process.env.ITER || '4'
const OUT = `scripts/.shots/iter-${ITER}`
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await page.getByRole('button', { name: 'Ingresar' }).click()
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 })

await page.goto(`${BASE}/dashboard?from=2026-05-01&to=2026-06-01`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

// scroll a la zona de Mix / Medios
await page.evaluate(() => window.scrollTo(0, 1400))
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/middle.png`, fullPage: false })

await page.evaluate(() => window.scrollTo(0, 2400))
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/bottom.png`, fullPage: false })

console.log('OK')
await browser.close()
