import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function Proximo({ titulo, desc }: { titulo: string; desc: string }) {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{titulo}</h1>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Badge variant="secondary">Próximamente</Badge>
          <p className="max-w-sm text-sm text-muted-foreground">{desc}</p>
        </CardContent>
      </Card>
    </div>
  )
}
