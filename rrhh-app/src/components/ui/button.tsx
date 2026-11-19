import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,transform] duration-150 ease-out outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/25 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Mismas variantes que el Boton del CRM: principal, secundario, fantasma, peligro.
        // Principal de la skill: acento con sombra propia; en oscuro pasa a blanco (tinta).
        default: "bg-primary font-medium text-primary-foreground shadow-principal hover:bg-primary-hover dark:bg-foreground dark:text-card dark:hover:bg-foreground/90",
        destructive:
          "border border-danger/25 bg-card text-danger-text hover:bg-danger-subtle focus-visible:ring-destructive/20",
        outline:
          "border border-border bg-card text-foreground shadow-min hover:bg-hover",
        secondary:
          "bg-accent text-accent-foreground hover:bg-accent/70",
        ghost:
          "text-texto-2 hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[38px] px-4",
        xs: "h-7 gap-1 rounded-lg px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-lg px-3 text-[13px]",
        lg: "h-12 rounded-[12px] px-5 text-[15px]",
        icon: "size-10",
        "icon-xs": "size-7 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-12 rounded-[12px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
