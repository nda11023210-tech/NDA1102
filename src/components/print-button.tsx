"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "In" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-primary">
      <Printer className="size-4" aria-hidden /> {label}
    </button>
  );
}
