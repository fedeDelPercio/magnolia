/* eslint-disable */
import { chromium } from '@playwright/test'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await ctx.newPage()

page.on('console', (m) => console.log(`[browser ${m.type()}]`, m.text()))
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
page.on('response', (r) => {
  if (r.status() >= 400) console.log(`[HTTP ${r.status()}]`, r.url())
})

console.log('Goto /login...')
await page.goto('http://localhost:3001/login', { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle').catch(() => {})

console.log('Fill...')
await page.locator('#email').fill(process.env.E2E_EMAIL || 'fndelpercio@gmail.com')
await page.locator('#password').fill(process.env.E2E_PASSWORD || 'Fede1498')

console.log('Click Ingresar...')
await page.getByRole('button', { name: 'Ingresar' }).click()

console.log('Wait 8s...')
await page.waitForTimeout(8000)
console.log('Current URL:', page.url())

await page.screenshot({ path: 'scripts/.shots/debug-login.png', fullPage: true })
console.log('Screenshot saved.')

await browser.close()
