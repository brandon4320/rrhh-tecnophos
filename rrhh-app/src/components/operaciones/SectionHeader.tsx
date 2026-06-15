export function SectionHeader({
  n,
  title,
  subtitle,
  action,
}: {
  n: string
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-lg border border-white/10 bg-slate-900 text-white">
      <div className="flex w-11 shrink-0 items-center justify-center bg-[#ea580c] text-base font-bold">
        {n}
      </div>
      <div className="flex flex-1 items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="font-semibold leading-tight">{title}</p>
          {subtitle && <p className="truncate text-xs text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  )
}
