import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md hover:shadow-lg",
        outline:
          "border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-sm hover:shadow-md",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm hover:shadow-md",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 text-sm leading-none min-w-[2.5rem]",
        sm: "h-9 px-3 text-xs leading-none min-w-[2rem]",
        lg: "h-12 px-6 text-base leading-none min-w-[3rem]",
        xl: "h-14 px-8 text-lg leading-none min-w-[3.5rem]",
        icon: "h-10 w-10 p-0 text-sm leading-none",
        "icon-sm": "h-8 w-8 p-0 text-xs leading-none",
        "icon-lg": "h-12 w-12 p-0 text-base leading-none",
      },
      responsive: {
        default: "",
        wrap: "whitespace-normal break-words",
        nowrap: "whitespace-nowrap",
        truncate: "whitespace-nowrap overflow-hidden text-ellipsis",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      responsive: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, responsive, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, responsive }), className)}
        ref={ref}
        {...props}
      >
        {children}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants } 