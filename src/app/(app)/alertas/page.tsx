import { getProveedoresConRegla, getIvaBalance } from '@/features/alerts/queries'
import { getDigitalTaxRate } from '@/features/config/queries'
import { evaluatePaymentRule } from '@/features/suppliers/payment-rules'
import { IvaBalanceCard } from '@/features/alerts/components/iva-balance-card'
import { RuleAlertCard } from '@/features/alerts/components/rule-alert-card'

export const dynamic = 'force-dynamic'

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default async function Page() {
  const month = currentMonth()
  const [proveedores, taxRate] = await Promise.all([
    getProveedoresConRegla(),
    getDigitalTaxRate(),
  ])
  const balance = await getIvaBalance(month, taxRate)

  const evaluated = proveedores
    .filter((p) => p.payment_rule)
    .map((p) => ({
      proveedor: p,
      evaluation: evaluatePaymentRule(p.payment_rule!, {
        pendingCount: p.pendingCount,
        pendingAmount: p.pendingAmount,
      }),
    }))

  const triggered = evaluated.filter((e) => e.evaluation.triggered)
  const ok = evaluated.filter((e) => !e.evaluation.triggered)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Alertas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Balanza fiscal y reglas de pago a proveedores.
        </p>
      </div>

      <IvaBalanceCard balance={balance} />

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Pagos a proveedores
          </h2>
          {evaluated.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {triggered.length} a revisar · {ok.length} ok
            </span>
          )}
        </div>

        {evaluated.length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Ningún proveedor tiene una regla de pago configurada.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Configurá una regla editando un proveedor en <a href="/proveedores" className="underline">Proveedores</a>.
            </p>
          </div>
        ) : (
          <>
            {triggered.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {triggered.map(({ proveedor, evaluation }) => (
                  <RuleAlertCard
                    key={proveedor.id}
                    proveedorId={proveedor.id}
                    proveedorName={proveedor.name}
                    rule={proveedor.payment_rule!}
                    evaluation={evaluation}
                  />
                ))}
              </div>
            )}
            {ok.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {ok.map(({ proveedor, evaluation }) => (
                  <RuleAlertCard
                    key={proveedor.id}
                    proveedorId={proveedor.id}
                    proveedorName={proveedor.name}
                    rule={proveedor.payment_rule!}
                    evaluation={evaluation}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
