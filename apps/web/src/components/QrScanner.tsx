import { useEffect, useRef, useState } from "react";

/**
 * Reads a pairing code with the camera, or lets the player paste it.
 * The camera needs a secure page (https or localhost); otherwise only pasting is offered.
 */
export function QrScanner({ label, onCode, busy }: { label: string; onCode: (code: string) => void; busy?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<"off" | "starting" | "on" | "unavailable">("off");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  });

  const canUseCamera = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && isSecureContext;

  useEffect(() => {
    if (camera !== "starting") return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      try {
        const [{ default: jsQR }, media] = await Promise.all([
          import("jsqr"),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }),
        ]);
        stream = media;
        if (stopped || !video.current) return media.getTracks().forEach((t) => t.stop());
        video.current.srcObject = media;
        await video.current.play();
        setCamera("on");
        let last = 0;
        const tick = (now: number) => {
          if (stopped) return;
          raf = requestAnimationFrame(tick);
          const v = video.current;
          if (!v || !ctx || now - last < 150 || v.videoWidth === 0) return;
          last = now;
          // Scan a downscaled frame: plenty for a QR code held up to the camera.
          const scale = Math.min(1, 720 / v.videoWidth);
          canvas.width = Math.round(v.videoWidth * scale);
          canvas.height = Math.round(v.videoHeight * scale);
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const found = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
          if (found?.data.startsWith("QL1.")) {
            stopped = true;
            onCodeRef.current(found.data);
          }
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        setCamera("unavailable");
        setCameraError(
          (e as Error).name === "NotAllowedError" ? "Camera permission was denied." : "No camera available.",
        );
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [camera]);

  return (
    <div className="flex flex-col gap-3">
      {canUseCamera && camera !== "unavailable" && (
        <div className="overflow-hidden rounded-xl border border-line bg-black">
          {camera === "off" ? (
            <button
              type="button"
              onClick={() => setCamera("starting")}
              className="flex aspect-video w-full items-center justify-center text-sm font-semibold text-text hover:bg-panel-2"
            >
              Scan with camera
            </button>
          ) : (
            <video ref={video} muted playsInline className="aspect-video w-full object-cover" aria-label="Camera" />
          )}
        </div>
      )}
      {cameraError && <p className="text-xs text-amber-200">{cameraError}</p>}
      {!canUseCamera && (
        <p className="text-xs text-muted">
          The camera can only be used on a secure (https) page. Paste the code instead.
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{label}</span>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="QL1.…"
          className="h-20 rounded-lg border border-line bg-panel-2 p-2 font-mono text-xs"
        />
      </label>
      <button
        type="button"
        disabled={!pasted.trim() || busy}
        onClick={() => onCode(pasted.trim())}
        className="min-h-11 rounded-xl bg-white font-semibold text-ink hover:bg-slate-200 disabled:opacity-40"
      >
        Use pasted code
      </button>
    </div>
  );
}
