/* eslint-disable */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL || 'http://localhost:3001'
const OUT = 'scripts/.shots/demo'
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
// Esperar a que React hidrate antes de tipear/hacer click — sino el form
// se submitiría como GET nativo en lugar del onSubmit handler.
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
await page.waitForTimeout(800)
await page.locator('#email').fill('demo@magnolia.com')
await page.locator('#password').fill('DemoMagnolia2026!')
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }),
  page.getByRole('button', { name: 'Ingresar' }).click(),
])
console.log('  ✓ login demo')

const ranges = [
  ['/dashboard', 'dashboard-default'],
  ['/dashboard?from=2026-05-01&to=2026-06-01', 'dashboard-may'],
  ['/dashboard?evGran=mes', 'dashboard-mes'],
  ['/dashboard?from=2025-12-01&to=2026-06-01&evGran=mes', 'dashboard-6m'],
]

for (const [path, name] of ranges) {
  console.log(`▶ ${path}`)
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
  console.log(`  📸 ${name}.png`)
}

if (errors.length > 0) {
  console.log('\n❌ Errores:')
  errors.forEach((e) => console.log(`  ${e}`))
}
console.log('\n✅ done')
await browser.close()
