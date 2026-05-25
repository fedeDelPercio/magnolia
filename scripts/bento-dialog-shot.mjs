/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
const BASE = process.env.BASE_URL || 'http://localhost:3001'
const OUT = 'scripts/.shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await page.getByRole('button', { name: 'Ingresar' }).click()
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 })

await page.goto(`${BASE}/catalogo/insumos`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Nuevo insumo' }).click()
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/dialog-nuevo-insumo.png`, fullPage: true })
console.log('📸 dialog-nuevo-insumo.png')

// Also a dropdown menu
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
await page.locator('tr', { hasText: 'Carne' }).first().locator('button').last().click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/dropdown.png`, fullPage: true })
console.log('📸 dropdown.png')

await browser.close()
