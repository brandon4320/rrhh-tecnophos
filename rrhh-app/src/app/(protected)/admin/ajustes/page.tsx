'use client'

import { useState, useEffect, useRef } from 'react'

export default function AjustesPage() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/config/logo').then(r => r.json()).then(d => {
      if (d.logo) setLogoUrl(d.logo)
    })
  }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 200_000) { setMsg('El archivo debe pesar menos de 200KB'); return }

    setUploading(true)
    setMsg('')
    const fd = new FormData()
    fd.append('logo', file)
    const res = await fetch('/api/config/logo', { method: 'POST', body: fd })
    if (res.ok) {
      setMsg('Logo actualizado')
      const reader = new FileReader()
      reader.onload = () => setLogoUrl(reader.result as string)
      reader.readAsDataURL(file)
    } else {
      setMsg('Error al subir el logo')
    }
    setUploading(false)
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Ajustes del sistema</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Logo de la empresa</h2>
        <p className="text-sm text-gray-500 mb-4">
          Subi una imagen PNG de hasta 200KB. Se muestra en el sidebar.
        </p>

        <div className="flex items-center gap-6">
          <div className="w-48 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="max-h-16 max-w-44 object-contain" />
            ) : (
              <span className="text-sm text-gray-400">Sin logo</span>
            )}
          </div>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {uploading ? 'Subiendo...' : 'Cambiar logo'}
            </button>
            {msg && <p className="text-sm mt-2 text-green-600">{msg}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
