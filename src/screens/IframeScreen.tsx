import { useState, useRef, useCallback } from 'react';
import { Loader2, RefreshCw, ExternalLink, ZoomIn, ZoomOut } from 'lucide-react';

const APPSHEET_URL = 'https://www.appsheet.com/start/0c6e4948-4c31-419f-a1d7-d6d897d4d742';

const ZOOM_STEPS = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2];
const DEFAULT_ZOOM_INDEX = 3; // 1.0

export function IframeScreen() {
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [zoomIdx, setZoomIdx] = useState(DEFAULT_ZOOM_INDEX);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const zoom = ZOOM_STEPS[zoomIdx];

  const handleLoad = useCallback(() => {
    if (loadTimer.current) clearTimeout(loadTimer.current);
    setLoading(false);
  }, []);

  // AppSheet blocks iframes via X-Frame-Options — detect via timeout
  const handleMountIframe = useCallback(() => {
    if (loadTimer.current) clearTimeout(loadTimer.current);
    loadTimer.current = setTimeout(() => {
      // If onLoad never fires after 8s, assume blocked
      setLoading(false);
      setBlocked(true);
    }, 8000);
  }, []);

  const handleReload = () => {
    setLoading(true);
    setBlocked(false);
    setReloadKey((k) => k + 1);
  };

  const zoomIn = () => setZoomIdx((i) => Math.min(i + 1, ZOOM_STEPS.length - 1));
  const zoomOut = () => setZoomIdx((i) => Math.max(i - 1, 0));

  return (
    // Keluar dari flow Layout, isi penuh antara header (56px) dan footer (68px)
    <div
      className="fixed left-1/2 -translate-x-1/2 w-full max-w-[420px] flex flex-col bg-white"
      style={{ top: 56, bottom: 68, zIndex: 30 }}
    >
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 h-10 bg-emerald-600 shrink-0">
        <span className="flex-1 text-white text-[13px] font-semibold truncate">
          Input Bibit — AppSheet
        </span>

        {/* Zoom out */}
        <button
          onClick={zoomOut}
          disabled={zoomIdx === 0}
          className="w-7 h-7 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center disabled:opacity-30 transition"
          title="Perkecil"
        >
          <ZoomOut className="w-4 h-4 text-white" />
        </button>

        {/* Zoom indicator */}
        <span className="text-white/80 text-[11px] font-mono w-9 text-center">
          {Math.round(zoom * 100)}%
        </span>

        {/* Zoom in */}
        <button
          onClick={zoomIn}
          disabled={zoomIdx === ZOOM_STEPS.length - 1}
          className="w-7 h-7 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center disabled:opacity-30 transition"
          title="Perbesar"
        >
          <ZoomIn className="w-4 h-4 text-white" />
        </button>

        {/* Reload */}
        <button
          onClick={handleReload}
          className="w-7 h-7 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
          title="Muat ulang"
        >
          <RefreshCw className="w-4 h-4 text-white" />
        </button>

        {/* Buka di browser */}
        <a
          href={APPSHEET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-7 h-7 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
          title="Buka di browser"
        >
          <ExternalLink className="w-4 h-4 text-white" />
        </a>
      </div>

      {/* ── Iframe area ── */}
      <div className="relative flex-1 overflow-hidden bg-gray-50">

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-sm text-gray-500 font-medium">Memuat AppSheet…</p>
          </div>
        )}

        {/* Blocked / fallback */}
        {blocked && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-6 bg-white text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center">
              <ExternalLink className="w-7 h-7 text-amber-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-800 mb-1">AppSheet tidak dapat ditampilkan di sini</p>
              <p className="text-sm text-gray-500">
                AppSheet memblokir tampilan di dalam aplikasi. Buka langsung di browser untuk mengisi formulir.
              </p>
            </div>
            <a
              href={APPSHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-md hover:bg-emerald-700 transition"
            >
              <ExternalLink className="w-4 h-4" />
              Buka AppSheet di Browser
            </a>
            <button
              onClick={handleReload}
              className="text-sm text-gray-400 underline underline-offset-2"
            >
              Coba lagi
            </button>
          </div>
        )}

        {/* Iframe dengan zoom */}
        <div
          style={{
            width: `${100 / zoom}%`,
            height: `${100 / zoom}%`,
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
          }}
        >
          <iframe
            key={reloadKey}
            ref={(el) => { if (el) handleMountIframe(); }}
            src={APPSHEET_URL}
            title="Input Bibit AppSheet"
            onLoad={handleLoad}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
              background: 'white',
            }}
            allow="camera; microphone; geolocation; clipboard-write"
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation allow-modals allow-downloads"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </div>
  );
}
