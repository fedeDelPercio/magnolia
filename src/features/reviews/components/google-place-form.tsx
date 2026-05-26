'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveGooglePlaceUrl, syncGoogleReviews } from '../actions'

type Props = {
  /** Place ID y nombre actuales si ya hay algo guardado. */
  initialPlaceId: string | null
  initialPlaceName: string | null
}

export function GooglePlaceForm({ initialPlaceId, initialPlaceName }: Props) {
  const [url, setUrl] = useState('')
  const [placeId, setPlaceId] = useState(initialPlaceId ?? '')
  const [placeName, setPlaceName] = useState(initialPlaceName ?? '')
  const [pending, startTransition] = useTransition()
  const [syncing, startSync] = useTransition()

  function handleSave() {
    const trimmed = url.trim()
    if (!trimmed) {
      toast.error('Pegá la URL del lugar en Google Maps.')
      return
    }
    if (!/^https?:\/\/(www\.)?google\.[a-z.]+\/maps\//i.test(trimmed)) {
      toast.error('La URL no parece ser de Google Maps.')
      return
    }
    startTransition(async () => {
      const r = await saveGooglePlaceUrl(trimmed)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setPlaceId(r.data.placeId)
      setPlaceName(r.data.displayName)
      setUrl('')
      toast.success(`Conectado: ${r.data.displayName}`)
    })
  }

  function handleSync() {
    startSync(async () => {
      const r = await syncGoogleReviews({ force: true })
      if (!r.ok) toast.error(r.error)
      else toast.success('Snapshot actualizado')
    })
  }

  return (
    <div className="space-y-4">
      {placeId && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <p className="text-card-sub">Lugar conectado</p>
          <p className="mt-0.5 font-medium">{placeName || '—'}</p>
          <p className="mt-0.5 text-[11px] text-metric text-muted-foreground">{placeId}</p>
          <div className="mt-3">
            <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm">
              {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="maps-url">
          {placeId ? 'Cambiar lugar (pegá una nueva URL)' : 'URL del lugar en Google Maps'}
        </Label>
        <div className="flex items-stretch gap-2">
          <Input
            id="maps-url"
            type="url"
            placeholder="https://www.google.com/maps/place/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleSave} disabled={pending} size="sm">
            {pending ? 'Guardando…' : placeId ? 'Reemplazar' : 'Conectar'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Buscá tu negocio en Google Maps, abrí la ficha y copiá la URL del navegador. Resolvemos
          el Place ID automáticamente y traemos el primer snapshot.
        </p>
      </div>
    </div>
  )
}
