import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-blue-50 text-blue-700 border-blue-200",
        accredited: "bg-green-50 text-green-700 border-green-200",
        unaccredited: "bg-gray-100 text-gray-600 border-gray-200",
        destructive: "bg-red-50 text-red-700 border-red-200",
        outline: "bg-white text-gray-700 border-gray-300",
        secondary: "bg-gray-100 text-gray-700 border-gray-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
