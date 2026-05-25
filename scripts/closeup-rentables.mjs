/* eslint-disable */
import { chromium } from '@playwright/test'

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
const BASE = process.env.BASE_URL || 'http://localhost:3000'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1800 } })
const page = await ctx.newPage()

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await page.getByRole('button', { name: 'Ingresar' }).click()
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 })

await page.goto(`${BASE}/dashboard?month=2026-05`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
// closeup de la card "Productos más rentables"
const card = page.locator('div', { hasText: 'Productos más rentables' }).filter({ has: page.locator('ul, p.text-center') }).first()
await card.scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await card.screenshot({ path: 'scripts/.shots/v3-closeup-rentables.png' })
console.log('📸 closeup rentables')

await browser.close()
