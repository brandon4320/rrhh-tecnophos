'use client'

// Piezas del formulario del login que necesitan el navegador: ver/ocultar la contraseña y el
// botón que muestra "Entrando…" mientras el server action trabaja.
import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'

export function CampoClave() {
  const [ver, setVer] = useState(false)
  return (
    <div className="relative">
      <Input
        id="password"
        name="password"
        type={ver ? 'text' : 'password'}
        required
        autoComplete="current-password"
        className="h-12 pr-12 text-[15px]"
      />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        aria-label={ver ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
        aria-pressed={ver}
        className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {ver ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </button>
    </div>
  )
}

export function BotonEntrar() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.985] disabled:cursor-default disabled:opacity-80"
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? 'Entrando…' : 'Entrar'}
    </button>
  )
}
