import { getDigitalTaxRate, getLimiteChequesMensual } from '@/features/config/queries'
import { DigitalTaxForm } from '@/features/config/components/digital-tax-form'
import { LimiteChequesForm } from '@/features/config/components/limite-cheques-form'
import { getGooglePlaceId, getGooglePlaceName } from '@/features/reviews/queries'
import { GooglePlaceForm } from '@/features/reviews/components/google-place-form'
import { getBistroCredentialsMeta, getRecentSyncRuns } from '@/features/bistro/queries'
import { BistroCredentialsForm } from '@/features/bistro/components/bistro-credentials-form'
import { BistroSyncControl } from '@/features/bistro/components/bistro-sync-control'
import { PageHeader } from '@/components/shared/page-header'

export const dynamic = 'force-dynamic'

function formatRunDate(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function Page() {
  const [taxRate, limiteCheques, placeId, placeName, bistroMeta, bistroRuns] = await Promise.all([
    getDigitalTaxRate(),
    getLimiteChequesMensual(),
    getGooglePlaceId(),
    getGooglePlaceName(),
    getBistroCredentialsMeta(),
    getRecentSyncRuns(5),
  ])

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

      <section className="card-editorial p-6">
        <h2 className="text-card-title">Límite mensual de cheques</h2>
        <p className="mt-1 text-card-sub">
          Tope de pagos con cheque que vencen en el mes corriente. Se usa para disparar la alerta de
          consumo en /alertas.
        </p>
        <div className="mt-4">
          <LimiteChequesForm initialValue={limiteCheques} />
        </div>
      </section>

      <section className="card-editorial p-6">
        <h2 className="text-card-title">Reseñas de Google Maps</h2>
        <p className="mt-1 text-card-sub">
          Pegá la URL del lugar para activar la card de calificaciones en el dashboard. Se hace un
          snapshot por día para construir la evolución del rating.
        </p>
        <div className="mt-4">
          <GooglePlaceForm initialPlaceId={placeId} initialPlaceName={placeName} />
        </div>
      </section>

      <section className="card-editorial p-6">
        <h2 className="text-card-title">Conexión Bistrosoft API</h2>
        <p className="mt-1 text-card-sub">
          Sincroniza tickets directamente desde tu cuenta BistroWeb (sin subir el PDF de cierre).
          Conviven ambas fuentes: si un día tiene API y PDF, el dashboard usa la API.
        </p>

        <div className="mt-4 space-y-4">
          <BistroCredentialsForm meta={bistroMeta} />

          {bistroMeta && <BistroSyncControl />}

          {bistroRuns.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Últimas sincronizaciones</p>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium">Iniciada</th>
                      <th className="px-3 py-2 font-medium">Rango</th>
                      <th className="px-3 py-2 font-medium">Estado</th>
                      <th className="px-3 py-2 font-medium text-right">Nuevas</th>
                      <th className="px-3 py-2 font-medium text-right">Actualizadas</th>
                      <th className="px-3 py-2 font-medium text-right">Sin mapear</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bistroRuns.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">
                          {formatRunDate(r.startedAt)}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {r.rangeFrom} → {r.rangeTo}
                        </td>
                        <td className="px-3 py-2">
                          {r.status === 'ok' && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">OK</span>
                          )}
                          {r.status === 'error' && (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700" title={r.errorMessage ?? ''}>
                              Error
                            </span>
                          )}
                          {r.status === 'running' && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">En curso</span>
                          )}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-right">{r.transactionsInserted}</td>
                        <td className="px-3 py-2 tabular-nums text-right">{r.transactionsUpdated}</td>
                        <td className="px-3 py-2 tabular-nums text-right">
                          {r.unmappedItemsCount > 0 ? (
                            <span className="text-amber-700">{r.unmappedItemsCount}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
