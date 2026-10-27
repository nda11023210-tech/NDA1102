"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/action-state";

export function SubmitButton({
  children,
  className = "btn btn-primary",
  pendingText = "Đang xử lý…",
  name,
  value,
  confirm,
  formAction,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
  name?: string;
  value?: string;
  confirm?: string;
  formAction?: (fd: FormData) => void;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-busy={pending}
      formAction={formAction}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) {
          e.preventDefault();
          return;
        }
        // Ghi giá trị của nút vào ô ẩn: form action của React không phải lúc nào cũng gửi kèm nút đã bấm,
        // nên các form có nhiều nút (Duyệt / Trả hồ sơ…) cần cách này để server biết lựa chọn.
        const form = e.currentTarget.form;
        if (form && name) {
          let input = form.querySelector<HTMLInputElement>(`input[type="hidden"][data-submitter="${name}"]`);
          if (!input) {
            input = document.createElement("input");
            input.type = "hidden";
            input.name = name;
            input.dataset.submitter = name;
            form.appendChild(input);
          }
          input.value = value ?? "";
        }
      }}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state?.message) return null;
  return (
    <div
      role={state.ok ? "status" : "alert"}
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm",
        state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800",
      )}
    >
      {state.ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
      ) : (
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      )}
      <span>{state.message}</span>
    </div>
  );
}

/** Form gọi server action, hiển thị thông báo lỗi/thành công, tự reset khi thành công */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = true,
  onSuccess,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form ref={ref} action={formAction} className={cn("space-y-4", className)}>
      <FormMessage state={state} />
      {children}
    </form>
  );
}

/** Nút mở/đóng một vùng nội dung (ví dụ form tạo mới) – dùng <details> để không cần JS */
export function Disclosure({
  summary,
  children,
  className,
  defaultOpen,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  return (
    <details className={cn("group card", className)} open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 font-semibold text-ink select-none sm:px-6 [&::-webkit-details-marker]:hidden">
        {summary}
        <span className="text-ink-muted transition-transform duration-200 group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>
      <div className="border-t border-line px-5 py-5 sm:px-6">{children}</div>
    </details>
  );
}
