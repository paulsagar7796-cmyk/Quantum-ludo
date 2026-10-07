import { useEffect, useRef, useState } from "react";

const PAIRING_CODE = /^QL[12]\./i;

type Detect = (video: HTMLVideoElement) => Promise<string | null>;

interface NativeBarcodeDetector {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}
type BarcodeDetectorClass = {
  new (opts: { formats: string[] }): NativeBarcodeDetector;
  getSupportedFormats: () => Promise<string[]>;
};

/**
 * Prefers the browser's built-in QR reader (fast and forgiving, e.g. Chrome on Android);
 * falls back to jsQR, loaded on demand, on browsers without one (e.g. Safari).
 */
async function makeDetector(): Promise<Detect> {
  const Native = (globalThis as { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector;
  if (Native && (await Native.getSupportedFormats().catch((): string[] => [])).includes("qr_code")) {
    const detector = new Native({ formats: ["qr_code"] });
    return async (video) => (await detector.detect(video).catch(() => []))[0]?.rawValue ?? null;
  }
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  return async (video) => {
    // Up to 1280 px wide: enough detail for a QR code held up to the camera, still fast.
    const scale = Math.min(1, 1280 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
  };
}

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

    (async () => {
      try {
        const [detect, media] = await Promise.all([
          makeDetector(),
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
          }),
        ]);
        stream = media;
        if (stopped || !video.current) return media.getTracks().forEach((t) => t.stop());
        video.current.srcObject = media;
        await video.current.play();
        setCamera("on");
        let last = 0;
        let busy = false;
        const tick = (now: number) => {
          if (stopped) return;
          raf = requestAnimationFrame(tick);
          const v = video.current;
          if (!v || busy || now - last < 120 || v.videoWidth === 0) return;
          last = now;
          busy = true;
          void detect(v)
            .then((text) => {
              if (!stopped && text && PAIRING_CODE.test(text)) {
                stopped = true;
                onCodeRef.current(text);
              }
            })
            .finally(() => (busy = false));
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
          placeholder="QL2.…"
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
