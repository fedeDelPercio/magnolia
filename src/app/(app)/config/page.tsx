import { getDigitalTaxRate } from '@/features/config/queries'
import { DigitalTaxForm } from '@/features/config/components/digital-tax-form'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const taxRate = await getDigitalTaxRate()

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Configuración</h1>
        <p className="mt-1 text-sm text-neutral-500">Ajustes generales del negocio.</p>
      </div>

      <section className="rounded-xl border bg-card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Medios de pago digitales</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Porcentaje de impuestos que aplica sobre Tarjetas, QR y Online.
          </p>
        </div>
        <DigitalTaxForm initialValue={taxRate} />
      </section>
    </div>
  )
}
