import { chromium } from '@playwright/test'
const BASE = 'http://localhost:3001'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
await page.waitForTimeout(800)
await page.locator('#email').fill('demo@magnolia.com')
await page.locator('#password').fill('DemoMagnolia2026!')
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }),
  page.getByRole('button', { name: 'Ingresar' }).click(),
])
await page.goto(`${BASE}/dashboard?from=2025-12-01&to=2026-06-01&evGran=mes`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(1000)
const legend = page.locator('div.grid').filter({ hasText: 'Acertijos' }).last()
await legend.scrollIntoViewIfNeeded()
await legend.screenshot({ path: 'scripts/.shots/help/legend.png' })
console.log('done')
await browser.close()
