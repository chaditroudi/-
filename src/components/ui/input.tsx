import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, placeholder, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-base pointer-coarse:h-11",
          "ring-offset-background",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground/60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/30",
          "md:text-[15px]",
          className,
        )}
        ref={ref}
        placeholder={placeholder}
        // A field with no label of its own is named by its hint.
        aria-label={props.id || props["aria-labelledby"] ? undefined : placeholder}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
