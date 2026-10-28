"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { SubmitButton } from "./forms";

/** Nút xóa nhỏ gọn: hỏi xác nhận, gọi server action và hiện lỗi ngay cạnh nút (ví dụ "đang được dùng") */
export function DeleteButton({
  action,
  id,
  label,
  confirm,
  text,
  fields,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  id: string;
  label: string;
  confirm: string;
  /** Hiện chữ cạnh biểu tượng (mặc định chỉ hiện biểu tượng) */
  text?: string;
  /** Trường ẩn gửi kèm */
  fields?: Record<string, string>;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="inline-flex flex-col items-end">
      <input type="hidden" name="id" value={id} />
      {fields && Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton className={text ? "btn btn-danger-soft" : "btn btn-ghost btn-sm text-red-600 hover:bg-red-50"} confirm={confirm} pendingText="…">
        <Trash2 className="size-4" aria-hidden />
        {text ?? <span className="sr-only">{label}</span>}
      </SubmitButton>
      {state && !state.ok && (
        <p role="alert" className="mt-1 max-w-xs text-right text-xs text-red-700">
          {state.message}
        </p>
      )}
    </form>
  );
}
