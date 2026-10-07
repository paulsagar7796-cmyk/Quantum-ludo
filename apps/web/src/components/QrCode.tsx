import { useEffect, useState } from "react";

/** Shows a pairing code as a QR code, with the text form for copying or sharing. */
export function QrCode({ code, label }: { code: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Loaded on demand so the QR library isn't part of the main download.
    void import("qrcode").then(({ toDataURL }) =>
      // Short codes leave room for stronger error correction and a proper quiet zone: both help phone cameras.
      toDataURL(code, { errorCorrectionLevel: "M", margin: 4, width: 480 }).then((url) => !cancelled && setSrc(url)),
    );
    return () => {
      cancelled = true;
    };
  }, [code]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setShowText(true);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="aspect-square w-full max-w-72 rounded-xl bg-white p-2">
        {src ? (
          <img src={src} alt={label} className="h-full w-full [image-rendering:pixelated]" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">Preparing code…</div>
        )}
      </div>
      <div className="flex w-full max-w-72 gap-2 text-sm">
        <button
          type="button"
          onClick={copy}
          className="min-h-10 flex-1 rounded-lg border border-line bg-panel-2 font-semibold hover:bg-line"
        >
          {copied ? "Copied!" : "Copy code"}
        </button>
        <button
          type="button"
          onClick={() => setShowText((v) => !v)}
          aria-expanded={showText}
          className="min-h-10 flex-1 rounded-lg border border-line bg-panel-2 font-semibold hover:bg-line"
        >
          {showText ? "Hide text" : "Show text"}
        </button>
      </div>
      {showText && (
        <textarea
          readOnly
          value={code}
          aria-label={`${label} (text)`}
          onFocus={(e) => e.currentTarget.select()}
          className="h-24 w-full max-w-72 rounded-lg border border-line bg-panel-2 p-2 font-mono text-[10px] break-all"
        />
      )}
    </div>
  );
}
