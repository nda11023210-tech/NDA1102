"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { loginAction } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginAction, null);
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="mt-8 space-y-5">
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" placeholder="ten@cntt.bnic.edu.vn" />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Mật khẩu
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            className="input pr-11"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 grid w-11 cursor-pointer place-items-center text-ink-muted hover:text-ink"
            aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        </div>
      </div>
      <SubmitButton className="btn btn-brand w-full" pendingText="Đang đăng nhập…">
        <LogIn className="size-4" aria-hidden /> Đăng nhập
      </SubmitButton>
    </form>
  );
}
