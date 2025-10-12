import { toast as sonnerToast } from "sonner"

type ToastProps = {
  title?: string
  description?: string
}

export function useToast() {
  return {
    toast: (props: ToastProps) => {
      sonnerToast(props.title, {
        description: props.description,
      })
    },
    success: (title: string, props?: { description?: string }) => {
      sonnerToast.success(title, props)
    },
    error: (title: string, props?: { description?: string }) => {
      sonnerToast.error(title, props)
    },
    warning: (title: string, props?: { description?: string }) => {
      sonnerToast.warning(title, props)
    },
    info: (title: string, props?: { description?: string }) => {
      sonnerToast.info(title, props)
    },
  }
}

export const toast = {
  success: (title: string, props?: { description?: string }) => {
    sonnerToast.success(title, props)
  },
  error: (title: string, props?: { description?: string }) => {
    sonnerToast.error(title, props)
  },
  warning: (title: string, props?: { description?: string }) => {
    sonnerToast.warning(title, props)
  },
  info: (title: string, props?: { description?: string }) => {
    sonnerToast.info(title, props)
  },
}

