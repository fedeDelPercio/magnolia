import { notFound } from 'next/navigation'
import { getDia } from '@/features/operations/queries'
import { getCierresByDia, getProductosForMatching } from '@/features/cierres/queries'
import { getDigitalTaxRate } from '@/features/config/queries'
import { DiaClient } from '@/features/operations/components/dia-client'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function DiaPage({ params }: Props) {
  const { id } = await params
  const dia = await getDia(id)
  if (!dia) notFound()

  const [cierres, productosCatalogo, taxRate] = await Promise.all([
    getCierresByDia(id),
    getProductosForMatching(),
    getDigitalTaxRate(),
  ])

  return (
    <div className="space-y-6">
      <DiaClient dia={dia} cierres={cierres} productosCatalogo={productosCatalogo} taxRate={taxRate} />
    </div>
  )
}
