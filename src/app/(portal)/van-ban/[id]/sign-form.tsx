"use client";

import { PenLine } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { signDocument } from "../actions";

export function SignForm({ documentId, name }: { documentId: string; name: string }) {
  return (
    <ActionForm action={signDocument} resetOnSuccess={false}>
      <input type="hidden" name="documentId" value={documentId} />
      <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-soft">
        <input type="checkbox" name="agree" className="mt-0.5 size-4 accent-blue-600" />
        Tôi xác nhận đã đọc, nắm rõ nội dung và cam kết thực hiện văn bản này.
      </label>
      <div>
        <label htmlFor="signature" className="label">
          Gõ họ tên để ký
        </label>
        <input id="signature" name="signature" required autoComplete="off" placeholder={name} className="input font-medium" />
        <p className="hint">Chữ ký điện tử được lưu kèm thời gian và địa chỉ IP.</p>
      </div>
      <SubmitButton className="btn btn-success w-full" pendingText="Đang ký…">
        <PenLine className="size-4" aria-hidden /> Ký nhận văn bản
      </SubmitButton>
    </ActionForm>
  );
}
