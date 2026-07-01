import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default: "border-border-strong bg-elevated text-muted",
        danger:
          "border-danger/40 bg-danger/15 text-danger [&_svg]:text-danger",
        warn: "border-warn/40 bg-warn/12 text-warn [&_svg]:text-warn",
        good: "border-good/40 bg-good/12 text-good [&_svg]:text-good",
        info: "border-info/40 bg-info/12 text-info [&_svg]:text-info",
        accent: "border-accent/40 bg-accent/12 text-accent [&_svg]:text-accent",
        violet:
          "border-violet/40 bg-violet/12 text-violet [&_svg]:text-violet",
        outline: "border-border-strong bg-transparent text-faint",
      },
      size: {
        sm: "px-1.5 py-0.5 text-[10px]",
        md: "px-2 py-0.5 text-[11px]",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { badgeVariants };
