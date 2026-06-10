/* eslint-disable */
// Capturar el dashboard con los datos corregidos del 1-3 jun para validación visual
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL || 'demo@magnolia.com'
const PASSWORD = process.env.E2E_PASSWORD || 'DemoMagnolia2026!'
const BASE = process.env.BASE_URL || 'http://localhost:3001'
const OUT = 'scripts/.shots/dashboard-verify'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
const page = await ctx.newPage()

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.locator('#email').waitFor({ state: 'visible', timeout: 15000 })
await page.waitForTimeout(600)
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }),
  page.getByRole('button', { name: 'Ingresar' }).click(),
])

await page.goto(`${BASE}/dashboard?from=2026-06-01&to=2026-06-03`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2000)
await page.screenshot({ path: `${OUT}/dashboard-1-3-jun.png`, fullPage: true })
console.log(`  ✓ ${OUT}/dashboard-1-3-jun.png`)

await browser.close()
