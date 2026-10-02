export default function QRNoEncontrado() {
  return (
    <main className="mx-auto max-w-md px-5 py-16 text-center">
      <p className="text-lg font-semibold">Este QR no está activo</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Puede que se haya reemplazado por uno nuevo. Avisale a tu encargado para que te pase el actual.
      </p>
    </main>
  )
}
