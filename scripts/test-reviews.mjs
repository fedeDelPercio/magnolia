/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:3001'
const OUT = 'scripts/.shots/reviews'
mkdirSync(OUT, { recursive: true })

const MAPS_URL =
  'https://www.google.com/maps/place/Magnolia/@-34.3960849,-58.7410881,17z/data=!3m1!4b1!4m6!3m5!1s0x95bc9f80bfa1b7df:0x49e3ca1159eb4892!8m2!3d-34.3960894!4d-58.7385132!16s%2Fg%2F11gf09mc5y'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') {
    const t = m.text()
    if (!t.includes('Download the React DevTools')) errors.push(`console.error: ${t}`)
  }
})

// Login demo
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

// Ir a /config y pegar la URL
await page.goto(`${BASE}/config`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(800)
await page.locator('#maps-url').fill(MAPS_URL)
console.log('  ▶ URL pegada, click Conectar…')
await page.getByRole('button', { name: /Conectar|Reemplazar/ }).click()

// Esperar el toast de éxito o error
await page.waitForTimeout(6000)
await page.screenshot({ path: `${OUT}/config-connected.png`, fullPage: true })
console.log('  📸 config-connected.png')

// Ir al dashboard y ver la card
await page.goto(`${BASE}/dashboard?from=2026-05-01&to=2026-06-01`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(1500)
const card = page.locator('section').filter({ hasText: 'Reseñas Google' }).first()
if (await card.count()) {
  await card.scrollIntoViewIfNeeded()
  await card.screenshot({ path: `${OUT}/card-connected.png` })
  console.log('  📸 card-connected.png')
}
await page.screenshot({ path: `${OUT}/dashboard-connected.png`, fullPage: true })

if (errors.length > 0) {
  console.log('\n⚠ errores:')
  errors.forEach((e) => console.log(`  ${e}`))
}
console.log('\n✅ done')
await browser.close()
