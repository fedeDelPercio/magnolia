import { getDigitalTaxRate } from '@/features/config/queries'
import { DigitalTaxForm } from '@/features/config/components/digital-tax-form'
import { PageHeader } from '@/components/shared/page-header'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const taxRate = await getDigitalTaxRate()

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Configuración"
        title={
          <>
            <span className="italic">Ajustes</span> generales
          </>
        }
        description="Parámetros que afectan a las métricas y a las alertas."
        size="md"
      />

      <section className="card-editorial p-6">
        <h2 className="text-card-title">Medios de pago digitales</h2>
        <p className="mt-1 text-card-sub">
          Porcentaje de impuestos que aplica sobre Tarjetas, QR y Online.
        </p>
        <div className="mt-4">
          <DigitalTaxForm initialValue={taxRate} />
        </div>
      </section>
    </div>
  )
}
