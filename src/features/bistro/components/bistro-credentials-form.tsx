'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2Icon, KeyRoundIcon, Loader2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  saveBistroCredentials,
  testBistroConnection,
  clearBistroCredentials,
} from '../actions'
import type { BistroCredentialsMeta } from '../queries'

type Props = { meta: BistroCredentialsMeta | null }

export function BistroCredentialsForm({ meta }: Props) {
  const [editing, setEditing] = useState(meta === null)
  const [username, setUsername] = useState(meta?.username ?? '')
  const [password, setPassword] = useState('')
  const [shopCode, setShopCode] = useState(meta?.shopCode ?? '')
  const [busy, setBusy] = useState<null | 'save' | 'test' | 'clear'>(null)

  async function handleSave() {
    if (!username.trim() || !password) {
      toast.error('Usuario y contraseña son obligatorios')
      return
    }
    setBusy('save')
    const fd = new FormData()
    fd.set('username', username.trim())
    fd.set('password', password)
    if (shopCode.trim()) fd.set('shopCode', shopCode.trim())
    const res = await saveBistroCredentials(fd)
    setBusy(null)
    if (res.error) toast.error(res.error)
    else {
      toast.success('Credenciales guardadas')
      setPassword('')
      setEditing(false)
    }
  }

  async function handleTest() {
    setBusy('test')
    const res = await testBistroConnection()
    setBusy(null)
    if (res.ok) {
      const exp = res.expiresAt ? new Date(res.expiresAt).toLocaleString('es-AR') : ''
      toast.success(`Conexión OK — token válido hasta ${exp}`)
    } else {
      toast.error(res.error ?? 'No se pudo conectar')
    }
  }

  async function handleClear() {
    if (!confirm('¿Borrar las credenciales de Bistrosoft?')) return
    setBusy('clear')
    const res = await clearBistroCredentials()
    setBusy(null)
    if (res.error) toast.error(res.error)
    else {
      toast.success('Credenciales borradas')
      setUsername('')
      setPassword('')
      setShopCode('')
      setEditing(true)
    }
  }

  if (!editing && meta) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <CheckCircle2Icon className="size-4 text-emerald-700" />
          <span className="text-sm text-emerald-900">
            Configurado para <strong>{meta.username}</strong>
            {meta.shopCode ? ` · shop ${meta.shopCode}` : ''}
          </span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleTest} disabled={busy !== null}>
            {busy === 'test' ? <Loader2Icon className="size-3.5 animate-spin" /> : <KeyRoundIcon className="size-3.5" />}
            <span className="ml-1.5">Probar conexión</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={busy !== null}>
            Cambiar
          </Button>
          <Button size="sm" variant="ghost" onClick={handleClear} disabled={busy !== null} className="text-rose-700">
            Borrar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="bistro-username">Usuario BistroWeb (email)</Label>
          <Input
            id="bistro-username"
            type="email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="usuario@local.com"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="bistro-password">Contraseña</Label>
          <Input
            id="bistro-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={meta ? '••••••••' : ''}
            autoComplete="new-password"
          />
        </div>
      </div>
      <div className="space-y-1 max-w-xs">
        <Label htmlFor="bistro-shop">Shop code (opcional)</Label>
        <Input
          id="bistro-shop"
          type="text"
          value={shopCode}
          onChange={(e) => setShopCode(e.target.value)}
          placeholder="123"
        />
        <p className="text-xs text-muted-foreground">
          Sólo si tu cuenta gestiona varios locales. Dejar vacío para sincronizar todos.
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={busy !== null}>
          {busy === 'save' && <Loader2Icon className="size-3.5 animate-spin mr-1.5" />}
          Guardar
        </Button>
        {meta && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy !== null}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  )
}
