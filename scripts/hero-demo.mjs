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
await page.goto(`${BASE}/dashboard?from=2026-05-01&to=2026-06-01`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(1000)
await page.screenshot({ path: 'scripts/.shots/demo/hero-margin.png', clip: { x: 30, y: 80, width: 1300, height: 480 } })
console.log('done')
await browser.close()
