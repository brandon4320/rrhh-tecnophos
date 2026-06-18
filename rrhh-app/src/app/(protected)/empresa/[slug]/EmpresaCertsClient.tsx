'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { getEstadoVencimiento, ESTADO_COLORS } from '@/types'

interface Archivo {
  id: string
  nombre: string
  path: string
}

interface CertEmpresa {
  id: string
  numero_documento?: string | null
  fecha_vencimiento?: string | null
  tipo_nombre_custom?: string | null
  tipo?: { nombre: string } | null
  archivos?: Archivo[]
}

interface Props {
  certs: CertEmpresa[]
  canEdit: boolean
  empresaSlug: string
}

export default function EmpresaCertsClient({ certs: initial, canEdit, empresaSlug }: Props) {
  const [certs, setCerts] = useState<CertEmpresa[]>(initial)
  const [uploadingCert, setUploadingCert] = useState<string | null>(null)

  if (certs.length === 0) return null

  async function verArchivo(path: string) {
    const res = await fetch(`/api/archivo?path=${encodeURIComponent(path)}`)
    if (res.ok) {
      const { url } = await res.json()
      if (url) window.open(url, '_blank')
    } else {
      alert('No se pudo abrir el archivo.')
    }
  }

  async function handleUploadArchivo(certId: string, files: FileList) {
    setUploadingCert(certId)
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('certId', certId)
      fd.append('empresaSlug', empresaSlug)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) {
        const { archivo } = await res.json()
        if (archivo) {
          setCerts((prev) =>
            prev.map((c) =>
              c.id === certId ? { ...c, archivos: [...(c.archivos ?? []), archivo] } : c
            )
          )
        }
      } else {
        const payload = await res.json().catch(() => null)
        alert(payload?.error ?? 'No se pudo subir el archivo.')
      }
    }
    setUploadingCert(null)
  }

  async function handleDeleteArchivo(certId: string, archivoId: string) {
    if (!confirm('¿Eliminar este archivo?')) return
    const res = await fetch(`/api/archivo?id=${archivoId}`, { method: 'DELETE' })
    if (res.ok) {
      setCerts((prev) =>
        prev.map((c) =>
          c.id === certId
            ? { ...c, archivos: (c.archivos ?? []).filter((a) => a.id !== archivoId) }
            : c
        )
      )
    } else {
      alert('No se pudo eliminar el archivo.')
    }
  }

  return (
    <div className="mb-8">
      <h2 className="text-base font-semibold text-foreground mb-3">Habilitaciones de empresa</h2>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="divide-y divide-border">
          {certs.map((cert) => {
            const estado = getEstadoVencimiento(cert.fecha_vencimiento)
            return (
              <div key={cert.id}>
                <div className="flex items-center gap-4 px-5 py-3.5">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {cert.tipo?.nombre ?? cert.tipo_nombre_custom}
                    </p>
                    {cert.numero_documento && (
                      <p className="text-xs text-muted-foreground">{cert.numero_documento}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${ESTADO_COLORS[estado]}`}
                    >
                      {cert.fecha_vencimiento
                        ? format(new Date(cert.fecha_vencimiento + 'T12:00:00'), 'dd/MM/yyyy')
                        : '—'}
                    </span>
                  </div>
                </div>
                <div className="border-t border-border px-5 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {(cert.archivos ?? []).map((a) => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
                      >
                        <button
                          type="button"
                          onClick={() => verArchivo(a.path)}
                          className="max-w-[160px] truncate text-left text-primary hover:underline"
                        >
                          {a.nombre}
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => handleDeleteArchivo(cert.id, a.id)}
                            className="text-muted-foreground hover:text-red-500"
                            aria-label="Eliminar archivo"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                    {(cert.archivos ?? []).length === 0 && (
                      <span className="text-xs text-muted-foreground">Sin archivos</span>
                    )}
                    {canEdit && (
                      <label className="inline-flex cursor-pointer items-center rounded-md border border-input px-2 py-1 text-xs text-muted-foreground hover:bg-accent">
                        {uploadingCert === cert.id ? 'Subiendo…' : '+ Adjuntar'}
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          className="hidden"
                          disabled={uploadingCert === cert.id}
                          onChange={(e) => {
                            if (e.target.files?.length) handleUploadArchivo(cert.id, e.target.files)
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
