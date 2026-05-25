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

const text = await page.evaluate(() => {
  const allText = document.body.innerText
  // Get the section around "Productos más rentables"
  const idx = allText.indexOf('PRODUCTOS MÁS RENTABLES')
  if (idx === -1) return 'not found'
  return allText.slice(idx, idx + 400)
})
console.log('=== Productos más rentables ===')
console.log(text)

await browser.close()
