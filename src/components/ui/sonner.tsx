import type { ComponentProps } from "react";
import { Toaster as Sonner, toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

type ToasterProps = ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const isMobile = useIsMobile();
  return (
    <Sonner
      closeButton
      expand={!isMobile}
      pauseWhenPageIsHidden
      // A compact phone preview stays within the two-row header, above register actions.
      // The notification centre retains every full message; desktop previews stay beside the sidebar.
      position={isMobile ? "top-center" : "bottom-left"}
      offset={{ bottom: 88, left: 248 }}
      mobileOffset={{ top: 8 }}
      richColors
      theme="light"
      visibleToasts={isMobile ? 1 : 4}
      toastOptions={{
        classNames: {
          toast:
            "group toast rounded-lg border border-border/70 max-md:p-3 bg-background/95 text-foreground shadow-xl backdrop-blur-xl",
          title: "text-sm font-semibold max-md:line-clamp-1",
          description: "text-[13px] leading-relaxed text-muted-foreground max-md:line-clamp-2",
          actionButton:
            "bg-primary text-primary-foreground hover:bg-primary/90",
          cancelButton:
            "bg-muted text-muted-foreground hover:bg-muted/80",
          success:
            "border-emerald-200/80 bg-emerald-50/95 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-50",
          error:
            "border-red-200/80 bg-red-50/95 text-red-950 dark:border-red-900 dark:bg-red-950 dark:text-red-50",
          warning:
            "border-amber-200/80 bg-amber-50/95 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50",
          info:
            "border-sky-200/80 bg-sky-50/95 text-sky-950 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-50",
          closeButton:
            "border-border/60 bg-background/85 text-muted-foreground hover:bg-background hover:text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
