import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-95",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground active:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground active:bg-secondary/70",
        destructive:
          "bg-destructive text-destructive-foreground active:bg-destructive/90",
        warning:
          "bg-orange-500 text-white active:bg-orange-600",
        info: "bg-sky-500 text-white active:bg-sky-600",
        outline: "border border-border bg-transparent active:bg-secondary",
        ghost: "active:bg-secondary",
      },
      size: {
        default: "min-h-[44px] px-4 py-2",
        sm: "min-h-[38px] px-3 text-xs",
        lg: "min-h-[52px] px-6 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
