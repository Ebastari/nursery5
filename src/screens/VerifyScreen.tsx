import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, ShieldCheck, ShieldX, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '../components/Button';
import { verifyCode } from '../data/api';
import type { VerifyResult } from '../data/api';
import { Html5Qrcode } from 'html5-qrcode';

function formatTanggal(tanggal: string): string {
  const d = new Date(tanggal);
  if (isNaN(d.getTime())) return tanggal;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

type ScanState = 'idle' | 'scanning' | 'verifying' | 'valid' | 'invalid' | 'error';

export function VerifyScreen() {
  const navigate = useNavigate();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [scannedCode, setScannedCode] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handler untuk impor gambar — gunakan Html5Qrcode instance.scanFile untuk decode QR
  const handleImportImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setScanState('verifying');
    setErrorMsg('');
    setScannedCode('');
    setResult(null);

    // scanFile adalah instance method, buat container sementara agar constructor tidak error
    const tempId = `qr-tmp-${Date.now()}`;
    const tempEl = document.createElement('div');
    tempEl.id = tempId;
    tempEl.style.display = 'none';
    document.body.appendChild(tempEl);

    try {
      const scanner = new Html5Qrcode(tempId);
      const decodedText = await scanner.scanFile(file, false);
      let code = decodedText.trim();
      // Handle URL format: https://...?kode=XXX atau ?verify=XXX
      const urlMatch = code.match(/[?&](?:kode|verify)=([^&]+)/);
      if (urlMatch) {
        code = decodeURIComponent(urlMatch[1]);
      } else if (code.startsWith('VERIFY:')) {
        code = code.substring(7);
      }
      handleVerify(code);
    } catch {
      setScanState('error');
      setErrorMsg('QR Code tidak terbaca dari gambar. Pastikan gambar jelas dan berisi QR Code yang valid.');
    } finally {
      document.body.removeChild(tempEl);
    }
    event.target.value = '';
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        // 2 = SCANNING, 3 = PAUSED
        if (state === 2 || state === 3) {
          await scannerRef.current.stop();
        }
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
  };

  const handleVerify = async (code: string) => {
    setScanState('verifying');
    setScannedCode(code);
    try {
      const res = await verifyCode(code);
      setResult(res);
      setScanState(res.valid ? 'valid' : 'invalid');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal verifikasi');
      setScanState('error');
    }
  };

  const startScanner = async () => {
    setScanState('scanning');
    setResult(null);
    setErrorMsg('');
    setScannedCode('');

    await stopScanner();

    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        async (decodedText) => {
          // Stop scanning setelah berhasil baca
          await stopScanner();

          // Parse QR content
          let code = decodedText;
          if (code.startsWith('VERIFY:')) {
            code = code.substring(7);
          }

          handleVerify(code);
        },
        () => {
          // QR not detected yet — keep scanning
        },
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Tidak bisa mengakses kamera');
      setScanState('error');
    }
  };

  const handleReset = () => {
    stopScanner();
    setScanState('idle');
    setResult(null);
    setErrorMsg('');
    setScannedCode('');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  return (
    <div className="fade-in space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            stopScanner();
            navigate(-1);
          }}
          className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Verifikasi Dokumen</h1>
          <p className="text-xs text-gray-500">Scan QR Code dari Surat Jalan</p>
        </div>
      </div>

      {/* Scanner Area */}
      {(scanState === 'idle' || scanState === 'scanning') && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3">
            <p className="text-white text-sm font-semibold flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Scanner QR Code
            </p>
          </div>

          <div className="p-4 space-y-4">
            {scanState === 'idle' ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-20 h-20 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <Camera className="w-10 h-10 text-emerald-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-900">Verifikasi Surat Jalan</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Arahkan kamera ke QR Code pada Surat Jalan untuk memverifikasi keaslian dokumen.
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <Button size="md" variant="primary" icon={<Camera className="w-4 h-4" />} onClick={startScanner}>
                    Buka Kamera
                  </Button>
                  <Button
                    size="md"
                    variant="secondary"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Impor Gambar
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImportImage}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  id="qr-reader"
                  ref={containerRef}
                  className="rounded-xl overflow-hidden bg-black"
                  style={{ minHeight: 300 }}
                />
                <p className="text-xs text-center text-gray-500 animate-pulse">
                  Arahkan kamera ke QR Code...
                </p>
                <Button size="sm" variant="secondary" onClick={handleReset} className="w-full">
                  Batal
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Verifying State */}
      {scanState === 'verifying' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-900">Memverifikasi...</p>
            <p className="text-xs text-gray-500 mt-1 font-mono">{scannedCode}</p>
          </div>
        </div>
      )}

      {/* Valid Result */}
      {scanState === 'valid' && result && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border-2 border-emerald-400 shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div className="text-white">
                <p className="font-bold text-base">Dokumen Valid</p>
                <p className="text-xs text-emerald-100">Keaslian dokumen terverifikasi</p>
              </div>
            </div>

            <div className="px-5 py-5 space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="text-xs text-emerald-700 font-medium">
                  Kode verifikasi cocok dengan data distribusi resmi
                </span>
              </div>

              <div className="space-y-2.5 pt-2">
                <VerifyInfoRow label="Kode" value={result.kodeVerifikasi || scannedCode} mono />
                <VerifyInfoRow label="Tanggal" value={formatTanggal(result.tanggal || '')} />
                <VerifyInfoRow label="Jenis Bibit" value={result.bibit || '-'} highlight />
                {(result.keluar || 0) > 0 && (
                  <VerifyInfoRow label="Jumlah Keluar" value={`${(result.keluar || 0).toLocaleString('id-ID')} polybag`} highlight />
                )}
                {(result.masuk || 0) > 0 && (
                  <VerifyInfoRow label="Jumlah Masuk" value={`${(result.masuk || 0).toLocaleString('id-ID')} polybag`} />
                )}
                <VerifyInfoRow label="Sumber" value={result.sumber || '-'} />
                <VerifyInfoRow label="Tujuan" value={result.tujuan || '-'} />
              </div>

              <div className="pt-3 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 text-center">
                  Diverifikasi pada {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                  {' pukul '}
                  {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA
                </p>
              </div>
            </div>
          </div>

          <Button
            size="md"
            variant="secondary"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={handleReset}
            className="w-full"
          >
            Scan Lagi
          </Button>
        </div>
      )}

      {/* Invalid Result */}
      {scanState === 'invalid' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border-2 border-red-300 shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-rose-500 px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <ShieldX className="w-6 h-6 text-white" />
              </div>
              <div className="text-white">
                <p className="font-bold text-base">Dokumen Tidak Valid</p>
                <p className="text-xs text-red-100">Kode verifikasi tidak ditemukan</p>
              </div>
            </div>

            <div className="px-5 py-5 space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
                <ShieldX className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span className="text-xs text-red-700 font-medium">
                  QR Code ini tidak terdaftar dalam sistem distribusi resmi
                </span>
              </div>
              <p className="text-xs text-gray-500 font-mono text-center">{scannedCode}</p>
            </div>
          </div>

          <Button
            size="md"
            variant="secondary"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={handleReset}
            className="w-full"
          >
            Scan Lagi
          </Button>
        </div>
      )}

      {/* Error State */}
      {scanState === 'error' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-amber-300 shadow-lg p-6 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
              <ShieldX className="w-7 h-7 text-amber-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Terjadi Kesalahan</p>
            <p className="text-xs text-gray-500">{errorMsg}</p>
          </div>

          <Button
            size="md"
            variant="secondary"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={handleReset}
            className="w-full"
          >
            Coba Lagi
          </Button>
        </div>
      )}
    </div>
  );
}

function VerifyInfoRow({ label, value, highlight, mono }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="text-gray-500 w-28 flex-shrink-0">{label}</span>
      <span className="text-gray-400">:</span>
      <span className={`${highlight ? 'font-bold text-gray-900' : 'text-gray-700'} ${mono ? 'font-mono text-[11px]' : ''}`}>
        {value}
      </span>
    </div>
  );
}
