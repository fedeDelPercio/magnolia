/* eslint-disable */
import { chromium } from '@playwright/test'

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
const BASE = process.env.BASE_URL || 'http://localhost:3001'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`)
})

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await page.getByRole('button', { name: 'Ingresar' }).click()
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 })

// Test multi-month (was the failing case)
await page.goto(`${BASE}/dashboard?from=2026-02-01&to=2026-06-01`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

const pillText = await page.locator('button', { hasText: /Febrero|01\/02/ }).first().textContent()
console.log(`Pill text: "${pillText?.trim()}"`)

if (errors.length > 0) {
  console.log('\n❌ Errores detectados:')
  errors.forEach((e) => console.log(`  ${e}`))
  process.exit(1)
}
console.log('\n✅ Sin hydration errors')

await browser.close()
