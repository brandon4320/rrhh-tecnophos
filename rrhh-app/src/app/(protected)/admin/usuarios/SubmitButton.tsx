'use client'

import { useFormStatus } from 'react-dom'

export default function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
    >
      {pending ? 'Creando usuario...' : 'Crear usuario'}
    </button>
  )
}
