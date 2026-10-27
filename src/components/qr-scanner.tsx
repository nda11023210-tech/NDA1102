"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, Keyboard } from "lucide-react";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

/** Trích mã tài sản từ nội dung QR (URL .../tai-san/CODE) hoặc mã thuần */
function extractCode(raw: string) {
  const m = raw.match(/\/tai-san\/([^/?#]+)/);
  return decodeURIComponent(m ? m[1] : raw).trim().toUpperCase();
}

export function QrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);
  const [manual, setManual] = useState("");

  useEffect(() => setSupported(typeof window !== "undefined" && !!window.BarcodeDetector), []);

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const detector = new window.BarcodeDetector!({ formats: ["qr_code"] });
        const tick = async () => {
          if (stopped) return;
          try {
            const codes = await detector.detect(video);
            if (codes[0]?.rawValue) {
              stopped = true;
              router.push(`/tai-san/${encodeURIComponent(extractCode(codes[0].rawValue))}`);
              return;
            }
          } catch {}
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setError("Không truy cập được camera. Hãy cấp quyền camera hoặc nhập mã thủ công.");
        setActive(false);
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active, router]);

  return (
    <div className="space-y-4">
      {supported ? (
        <>
          <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-900">
            <video ref={videoRef} className={active ? "size-full object-cover" : "hidden"} muted playsInline aria-label="Khung hình camera quét QR" />
            {!active && (
              <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-slate-300">
                Bấm “Bật camera” rồi đưa mã QR trên thiết bị vào khung hình.
              </div>
            )}
            {active && <div aria-hidden className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />}
          </div>
          <button type="button" onClick={() => setActive((a) => !a)} className={active ? "btn btn-secondary w-full" : "btn btn-primary w-full"}>
            {active ? <CameraOff className="size-4" aria-hidden /> : <Camera className="size-4" aria-hidden />}
            {active ? "Tắt camera" : "Bật camera"}
          </button>
        </>
      ) : (
        <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-ink-muted">
          Trình duyệt này không hỗ trợ quét QR trực tiếp. Bạn có thể dùng ứng dụng Camera của điện thoại để quét – mã sẽ mở thẳng trang thiết bị.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) router.push(`/tai-san/${encodeURIComponent(extractCode(manual))}`);
        }}
        className="flex gap-2"
      >
        <label htmlFor="manual-code" className="sr-only">
          Nhập mã tài sản
        </label>
        <div className="relative flex-1">
          <Keyboard className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input id="manual-code" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Nhập mã, ví dụ MC-001" className="input pl-9 uppercase" />
        </div>
        <button className="btn btn-secondary">Mở</button>
      </form>
    </div>
  );
}
