/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL || 'demo@magnolia.com'
const PASSWORD = process.env.E2E_PASSWORD || 'DemoMagnolia2026!'
const BASE = process.env.BASE_URL || 'http://localhost:3001'
const OUT = 'scripts/.shots/alertas-month-nav'
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

// Captura mes actual
await page.goto(`${BASE}/alertas`, { waitUntil: 'networkidle' })
await page.screenshot({ path: `${OUT}/01-mes-actual.png`, fullPage: true })

// Captura mes siguiente (julio)
await page.goto(`${BASE}/alertas?chequesMonth=2026-07`, { waitUntil: 'networkidle' })
await page.screenshot({ path: `${OUT}/02-mes-siguiente.png`, fullPage: true })

// Click flecha derecha y captura
await page.goto(`${BASE}/alertas`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Mes siguiente' }).click()
await page.waitForLoadState('networkidle')
await page.screenshot({ path: `${OUT}/03-via-flecha.png`, fullPage: true })

await browser.close()
console.log('OK')
