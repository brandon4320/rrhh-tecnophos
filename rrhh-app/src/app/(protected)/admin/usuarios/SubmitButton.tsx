'use client'

import { useFormStatus } from 'react-dom'

export default function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-sm font-semibold px-4 py-2.5 rounded-[10px] transition-[background-color,transform] active:scale-[0.97]"
    >
      {pending ? 'Creando usuario...' : 'Crear usuario'}
    </button>
  )
}
