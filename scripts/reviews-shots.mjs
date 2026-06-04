/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const EMAIL = process.env.E2E_EMAIL || 'test@magnolia.com'
const PASSWORD = process.env.E2E_PASSWORD || 'TestE2E2026!'
const BASE = process.env.BASE_URL || 'http://localhost:3001'
const OUT = 'scripts/.shots/reviews'
const LABEL = process.env.LABEL || 'empty'

mkdirSync(OUT, { recursive: true })

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
page.on('response', (r) => {
  if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`)
})

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.locator('#email').waitFor({ state: 'visible', timeout: 15000 })
await page.locator('#email').fill(EMAIL)
await page.locator('#password').fill(PASSWORD)
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }),
  page.getByRole('button', { name: 'Ingresar' }).click(),
])
console.log('  ✓ login')

console.log('▶ /dashboard')
await page.goto(`${BASE}/dashboard?from=2026-05-01&to=2026-06-01`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(700)
await page.screenshot({ path: `${OUT}/dashboard-${LABEL}.png`, fullPage: true })
console.log(`  📸 dashboard-${LABEL}.png`)

// Captura cercana de la card de reviews
const reviewsCard = page.locator('section').filter({ hasText: 'Reseñas Google' }).first()
if (await reviewsCard.count()) {
  await reviewsCard.scrollIntoViewIfNeeded()
  await reviewsCard.screenshot({ path: `${OUT}/card-${LABEL}.png` })
  console.log(`  📸 card-${LABEL}.png`)
} else {
  console.log('  ⚠ card no encontrada')
}

console.log('▶ /config')
await page.goto(`${BASE}/config`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/config-${LABEL}.png`, fullPage: true })
console.log(`  📸 config-${LABEL}.png`)

if (errors.length > 0) {
  console.log('\n❌ Errores:')
  errors.forEach((e) => console.log(`  ${e}`))
  await browser.close()
  process.exit(1)
}
console.log('\n✅ OK')
await browser.close()
