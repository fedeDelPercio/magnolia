'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { DownloadCloudIcon, Loader2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { syncBistroNow } from '../actions'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysAgoISO(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function BistroSyncControl() {
  const [from, setFrom] = useState(daysAgoISO(1))
  const [to, setTo] = useState(todayISO())
  const [running, setRunning] = useState(false)

  async function handleSync() {
    setRunning(true)
    const fd = new FormData()
    fd.set('from', from)
    fd.set('to', to)
    const res = await syncBistroNow(fd)
    setRunning(false)

    if ('error' in res) {
      toast.error(res.error)
      return
    }
    if (res.status === 'ok') {
      toast.success(
        `Sync OK — ${res.transactionsInserted} nuevas, ${res.transactionsUpdated} actualizadas` +
          (res.unmappedItemsCount > 0 ? ` · ${res.unmappedItemsCount} ítems sin mapear` : ''),
      )
    } else {
      toast.error(res.errorMessage ?? 'Sync con errores')
    }
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <p className="text-sm font-medium">Sincronizar ahora</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="bistro-from">Desde</Label>
          <Input id="bistro-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="bistro-to">Hasta</Label>
          <Input id="bistro-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button onClick={handleSync} disabled={running}>
          {running ? <Loader2Icon className="size-4 animate-spin mr-1.5" /> : <DownloadCloudIcon className="size-4 mr-1.5" />}
          Sincronizar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Trae todas las transacciones del rango. Es idempotente: se puede correr varias veces sin duplicar.
      </p>
    </div>
  )
}
