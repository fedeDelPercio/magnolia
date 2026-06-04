import { getProveedoresConRegla, getChequesMesSummary } from '@/features/alerts/queries'
import { evaluatePaymentRule } from '@/features/suppliers/payment-rules'
import { RuleAlertCard } from '@/features/alerts/components/rule-alert-card'
import { ChequesMesCard } from '@/features/alerts/components/cheques-mes-card'
import { getLimiteChequesMensual } from '@/features/config/queries'
import { PageHeader } from '@/components/shared/page-header'
import { SectionHeader } from '@/components/shared/section-header'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ chequesMonth?: string }> }

// "YYYY-MM" → Date al primer día del mes (local). Si inválido, devuelve null.
function parseMonth(s: string | undefined): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})$/.exec(s)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  if (mo < 1 || mo > 12) return null
  return new Date(y, mo - 1, 1)
}

export default async function Page({ searchParams }: Props) {
  const sp = await searchParams
  const chequesMonthRef = parseMonth(sp.chequesMonth) ?? new Date()

  const [proveedores, limiteCheques] = await Promise.all([
    getProveedoresConRegla(),
    getLimiteChequesMensual(),
  ])
  const chequesSummary = await getChequesMesSummary(limiteCheques, chequesMonthRef)

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
      <PageHeader
        eyebrow="Alertas"
        title={
          <>
            <span className="italic">Pagos</span> a proveedores
          </>
        }
        description="Reglas activas evaluadas contra compras pendientes."
      />

      <ChequesMesCard summary={chequesSummary} />

      <section>
        <SectionHeader
          eyebrow="Reglas activas"
          trail={
            evaluated.length > 0 ? (
              <span className="text-metric">
                {triggered.length} a revisar · {ok.length} ok
              </span>
            ) : null
          }
        >
          <span className="italic">Qué</span> hay que pagar
        </SectionHeader>

        {evaluated.length === 0 ? (
          <div className="card-editorial p-7 text-center">
            <p className="text-sm text-muted-foreground">
              Ningún proveedor tiene una regla de pago configurada.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Configurá una regla editando un proveedor en{' '}
              <a href="/proveedores" className="focus-ring rounded-sm underline">
                Proveedores
              </a>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-3">
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
          </div>
        )}
      </section>
    </div>
  )
}
