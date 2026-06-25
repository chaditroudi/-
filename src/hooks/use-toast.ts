import * as React from "react";
import { toast as sonnerToast, type ExternalToast } from "sonner";

type ToastVariant = "default" | "destructive";

type ToastActionElement = React.ReactElement<{
  altText?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}>;

type ToastOptions = {
  id?: string | number;
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: ToastVariant;
  duration?: number;
  action?: ToastActionElement;
} & Partial<Pick<ExternalToast, "cancel" | "className" | "dismissible" | "important">>;

type ToastHandle = {
  id: string | number;
  dismiss: () => void;
  update: (next: ToastOptions) => ToastHandle;
};

const toAction = (action?: ToastActionElement): ExternalToast["action"] => {
  if (!action || !React.isValidElement(action)) {
    return undefined;
  }

  const label =
    typeof action.props.children === "string" ? action.props.children : action.props.altText || "Action";

  return {
    label,
    onClick: action.props.onClick,
  };
};

const normalizeToast = (input: ToastOptions, forcedId?: string | number) => {
  const message = input.title ?? input.description ?? "";
  const description = input.title ? input.description : undefined;

  return {
    id: forcedId ?? input.id,
    message,
    options: {
      id: forcedId ?? input.id,
      description,
      duration: input.duration,
      dismissible: input.dismissible,
      important: input.important,
      className: input.className,
      cancel: input.cancel,
      action: toAction(input.action),
    } satisfies ExternalToast,
  };
};

const dispatchToast = (input: ToastOptions): ToastHandle => {
  const normalized = normalizeToast(input);
  const show =
    input.variant === "destructive"
      ? sonnerToast.error
      : sonnerToast;

  const id = show(normalized.message, normalized.options);

  return {
    id,
    dismiss: () => sonnerToast.dismiss(id),
    update: (next) => dispatchToast({ ...input, ...next, id }),
  };
};

type ToastInvoker = ((options: ToastOptions) => ToastHandle) & {
  success: typeof sonnerToast.success;
  error: typeof sonnerToast.error;
  warning: typeof sonnerToast.warning;
  info: typeof sonnerToast.info;
  loading: typeof sonnerToast.loading;
  message: typeof sonnerToast.message;
  promise: typeof sonnerToast.promise;
  custom: typeof sonnerToast.custom;
  dismiss: typeof sonnerToast.dismiss;
};

const toast = Object.assign(
  (options: ToastOptions) => dispatchToast(options),
  {
    success: sonnerToast.success,
    error: sonnerToast.error,
    warning: sonnerToast.warning,
    info: sonnerToast.info,
    loading: sonnerToast.loading,
    message: sonnerToast.message,
    promise: sonnerToast.promise,
    custom: sonnerToast.custom,
    dismiss: sonnerToast.dismiss,
  },
) as ToastInvoker;

function useToast() {
  return {
    toast,
    dismiss: sonnerToast.dismiss,
    toasts: [],
  };
}

export { type ToastActionElement, type ToastOptions, useToast, toast };
