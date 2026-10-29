"use client";

import { useState } from "react";

export function SignToggle({ defaultOn = false, defaultDue = "" }: { defaultOn?: boolean; defaultDue?: string }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="rounded-xl border border-line bg-slate-50 p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" name="requireSign" checked={on} onChange={(e) => setOn(e.target.checked)} className="mt-1 size-4 accent-blue-600" />
        <span>
          <span className="block text-sm font-medium text-ink">Yêu cầu ký nhận điện tử</span>
          <span className="block text-xs text-ink-muted">Mỗi cán bộ, giảng viên phải xác nhận đã đọc bằng cách ký tên. Quản lý khoa theo dõi được tiến độ ký nhận.</span>
        </span>
      </label>
      {on && (
        <div className="mt-3 max-w-xs pl-7">
          <label htmlFor="signDueAt" className="label">
            Hạn ký nhận
          </label>
          <input id="signDueAt" name="signDueAt" type="datetime-local" defaultValue={defaultDue} className="input" />
        </div>
      )}
    </div>
  );
}
