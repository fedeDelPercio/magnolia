import { PageHeader } from '@/components/shared/page-header'

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reportes"
        title={
          <>
            <span className="italic">Reportes</span> exportables
          </>
        }
        description="Módulo en desarrollo."
      />

      <div className="card-editorial p-7 text-center">
        <p className="text-sm text-muted-foreground">
          Próximamente: exportá ventas, compras y stock filtrados por período.
        </p>
      </div>
    </div>
  )
}
