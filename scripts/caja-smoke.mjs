/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL || 'test@magnolia.com'
const PASSWORD = process.env.E2E_PASSWORD || 'TestE2E2026!'
const BASE = process.env.BASE_URL || 'http://localhost:3001'
const OUT = 'scripts/.shots/caja'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
const page = await ctx.newPage()

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.locator('#email').waitFor({ state: 'visible', timeout: 15000 })
await page.waitForTimeout(800)
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }),
  page.getByRole('button', { name: 'Ingresar' }).click(),
])

await page.goto(`${BASE}/caja`, { waitUntil: 'networkidle' })
await page.screenshot({ path: `${OUT}/caja.png`, fullPage: true })

await browser.close()
console.log('OK')
