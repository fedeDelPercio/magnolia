/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL || 'demo@magnolia.com'
const PASSWORD = process.env.E2E_PASSWORD || 'DemoMagnolia2026!'
const BASE = process.env.BASE_URL || 'http://localhost:3001'
const OUT = 'scripts/.shots/proveedor-redesign'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
const page = await ctx.newPage()

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.locator('#email').waitFor({ state: 'visible', timeout: 15000 })
await page.waitForTimeout(400)
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }),
  page.getByRole('button', { name: 'Ingresar' }).click(),
])

// Carniceria con año completo
await page.goto(`${BASE}/proveedores`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await Promise.all([
  page.waitForURL(/\/proveedores\/[0-9a-f-]+$/, { timeout: 5000 }).catch(() => null),
  page.getByText('Carniceria').first().click(),
])
await page.waitForTimeout(800)
await page.goto(`${page.url()}?from=2026-01-01&to=2027-01-01`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

// Scroll al gráfico y crop
const chart = page.locator('svg').last()
await chart.scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await chart.screenshot({ path: `${OUT}/07-chart-zoom.png` })
console.log('📸 07-chart-zoom.png')
await browser.close()
