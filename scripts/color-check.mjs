/* eslint-disable */
import { chromium } from '@playwright/test'

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
const BASE = process.env.BASE_URL || 'http://localhost:3001'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await page.getByRole('button', { name: 'Ingresar' }).click()
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 })

await page.goto(`${BASE}/catalogo/insumos`, { waitUntil: 'networkidle' })

// Sample topnav rail
const railBg = await page.locator('nav.rounded-full').first().evaluate((el) => {
  return getComputedStyle(el).backgroundColor
})

// Open dialog
await page.getByRole('button', { name: 'Nuevo insumo' }).click()
await page.waitForTimeout(500)

const dialogBg = await page.locator('[data-slot="dialog-content"]').evaluate((el) => {
  return getComputedStyle(el).backgroundColor
})

// Sample the CSS variables themselves
const vars = await page.evaluate(() => {
  const s = getComputedStyle(document.documentElement)
  return {
    surface: s.getPropertyValue('--surface').trim(),
    popover: s.getPropertyValue('--popover').trim(),
    card: s.getPropertyValue('--card').trim(),
    background: s.getPropertyValue('--background').trim(),
  }
})

console.log('--- CSS variables ---')
console.log(vars)
console.log('\n--- Computed backgrounds ---')
console.log('topnav rail bg:', railBg)
console.log('dialog content bg:', dialogBg)

await browser.close()
