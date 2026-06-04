/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:3001'
const OUT = 'scripts/.shots/help'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('DevTools')) errors.push(m.text()) })

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
await page.waitForTimeout(800)
await page.locator('#email').fill('demo@magnolia.com')
await page.locator('#password').fill('DemoMagnolia2026!')
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }),
  page.getByRole('button', { name: 'Ingresar' }).click(),
])
console.log('  ✓ login')

await page.goto(`${BASE}/dashboard?from=2025-12-01&to=2026-06-01&evGran=mes`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(1000)

// Click en el botón de ayuda del Menu Engineering
const helpBtn = page.getByRole('button', { name: 'Qué es el Menu Engineering' })
await helpBtn.scrollIntoViewIfNeeded()
await helpBtn.click()
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/help-modal.png` })
console.log('  📸 help-modal.png')

if (errors.length) { console.log('⚠ errores:'); errors.forEach((e) => console.log('  ' + e)) }
console.log('✅ done')
await browser.close()
