import type { PaymentRule } from './schemas'
import { DOW_LABELS, NTH_LABELS } from './schemas'

export type RuleEvaluation =
  | {
      kind: 'boletas'
      current: number
      target: number
      triggered: boolean
      label: string
      pct: number
    }
  | {
      kind: 'monto'
      current: number
      target: number
      triggered: boolean
      label: string
      pct: number
    }
  | {
      kind: 'fecha'
      nextDate: string
      daysUntil: number
      triggered: boolean
      label: string
    }

function nthWeekdayOfMonth(year: number, month: number, n: number, dow: number): Date {
  const first = new Date(year, month, 1)
  const offset = (dow - first.getDay() + 7) % 7
  const day = 1 + offset + (n - 1) * 7
  return new Date(year, month, day)
}

function lastWeekdayOfMonth(year: number, month: number, dow: number): Date {
  const last = new Date(year, month + 1, 0)
  const offset = (last.getDay() - dow + 7) % 7
  return new Date(year, month, last.getDate() - offset)
}

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

export function evaluatePaymentRule(
  rule: PaymentRule,
  context: {
    pendingCount: number
    pendingAmount: number
    today?: Date
  },
): RuleEvaluation {
  const today = context.today ?? new Date()
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  if (rule.kind === 'boletas') {
    const pct = Math.min(100, (context.pendingCount / rule.n) * 100)
    return {
      kind: 'boletas',
      current: context.pendingCount,
      target: rule.n,
      pct,
      triggered: context.pendingCount >= rule.n,
      label: `${context.pendingCount} de ${rule.n} boletas`,
    }
  }

  if (rule.kind === 'monto') {
    const pct = rule.umbral > 0 ? Math.min(100, (context.pendingAmount / rule.umbral) * 100) : 0
    return {
      kind: 'monto',
      current: context.pendingAmount,
      target: rule.umbral,
      pct,
      triggered: context.pendingAmount >= rule.umbral,
      label: `${pct.toFixed(0)}% del umbral`,
    }
  }

  let nextDate: Date
  if (rule.kind === 'fecha_dia_mes') {
    const dia = Math.min(rule.dia_mes, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate())
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), dia)
    if (thisMonth >= todayMidnight) {
      nextDate = thisMonth
    } else {
      const lastDayNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0).getDate()
      nextDate = new Date(today.getFullYear(), today.getMonth() + 1, Math.min(rule.dia_mes, lastDayNextMonth))
    }
  } else {
    const thisMonth =
      rule.nth === 5
        ? lastWeekdayOfMonth(today.getFullYear(), today.getMonth(), rule.dow)
        : nthWeekdayOfMonth(today.getFullYear(), today.getMonth(), rule.nth, rule.dow)
    if (thisMonth >= todayMidnight) {
      nextDate = thisMonth
    } else {
      nextDate =
        rule.nth === 5
          ? lastWeekdayOfMonth(today.getFullYear(), today.getMonth() + 1, rule.dow)
          : nthWeekdayOfMonth(today.getFullYear(), today.getMonth() + 1, rule.nth, rule.dow)
    }
  }

  const daysUntil = daysBetween(todayMidnight, nextDate)
  return {
    kind: 'fecha',
    nextDate: isoDate(nextDate),
    daysUntil,
    triggered: daysUntil <= 3,
    label: daysUntil === 0 ? 'hoy' : daysUntil === 1 ? 'mañana' : `en ${daysUntil} días`,
  }
}

export function describePaymentRule(rule: PaymentRule): string {
  if (rule.kind === 'boletas') return `Cada ${rule.n} boletas pendientes`
  if (rule.kind === 'monto')
    return `Al alcanzar $${rule.umbral.toLocaleString('es-AR')} pendientes`
  if (rule.kind === 'fecha_dia_mes') return `Día ${rule.dia_mes} de cada mes`
  return `${NTH_LABELS[rule.nth]} ${DOW_LABELS[rule.dow]} del mes`
}
