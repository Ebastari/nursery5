import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Camera, ShieldCheck, ShieldX, Loader2, RotateCcw,
  CheckCircle, MapPin,
} from 'lucide-react';
import { Button } from '../components/Button';
import { verifyCode, confirmDelivery } from '../data/api';
import type { VerifyResult } from '../data/api';
import { Html5Qrcode } from 'html5-qrcode';
import { useStore } from '../store/useStore';

function formatTanggal(tanggal: string): string {
  const d = new Date(tanggal);
  if (isNaN(d.getTime())) return tanggal;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

type ScanState = 'idle' | 'scanning' | 'verifying' | 'valid' | 'invalid' | 'error';
type ScreenMode = 'verify' | 'lapangan';

export function VerifyScreen() {
  const navigate = useNavigate();
  const { isAdmin } = useStore();

  // Mode — lapangan langsung terbuka untuk admin
  const [mode, setMode] = useState<ScreenMode>('verify');
  const [passwordUnlocked, setPasswordUnlocked] = useState(false);

  // Scan
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [scannedCode, setScannedCode] = useState('');

  // Confirm form
  const [showConfirmForm, setShowConfirmForm] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [confirmQty, setConfirmQty] = useState(0);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmSuccess, setConfirmSuccess] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // ref agar handleVerify callback selalu baca mode terbaru
  const modeRef = useRef<ScreenMode>('verify');

  const handleModeSwitch = (newMode: ScreenMode) => {
    stopScanner();
    setScanState('idle');
    setResult(null);
    setErrorMsg('');
    setScannedCode('');
    setShowConfirmForm(false);
    setConfirmName('');
    setConfirmQty(0);
    setConfirmSuccess(false);
    setConfirmError('');
    setMode(newMode);
    modeRef.current = newMode;
    if (newMode === 'verify') {
      setPasswordUnlocked(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2 || state === 3) await scannerRef.current.stop();
      } catch { /* ignore */ }
      scannerRef.current = null;
    }
  };

  const handleVerify = async (code: string) => {
    setScanState('verifying');
    setScannedCode(code);
    try {
      const res = await verifyCode(code);
      setResult(res);
      if (res.valid && res.keluar) setConfirmQty(res.keluar);
      // lapangan mode: form konfirmasi langsung terbuka otomatis
      if (res.valid && modeRef.current === 'lapangan') setShowConfirmForm(true);
      setScanState(res.valid ? 'valid' : 'invalid');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal verifikasi');
      setScanState('error');
    }
  };

  const handleConfirm = async () => {
    const kode = result?.kodeVerifikasi || scannedCode;
    if (!kode || !confirmName.trim()) return;
    setConfirmLoading(true);
    setConfirmError('');
    try {
      await confirmDelivery({ kodeVerifikasi: kode, namaPenerima: confirmName.trim(), jumlahDiterima: confirmQty });
      setConfirmSuccess(true);
      setShowConfirmForm(false);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : 'Konfirmasi gagal');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleImportImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setScanState('verifying');
    setErrorMsg('');
    setScannedCode('');
    setResult(null);
    const tempId = `qr-tmp-${Date.now()}`;
    const tempEl = document.createElement('div');
    tempEl.id = tempId;
    tempEl.style.display = 'none';
    document.body.appendChild(tempEl);
    try {
      const scanner = new Html5Qrcode(tempId);
      const decodedText = await scanner.scanFile(file, false);
      let code = decodedText.trim();
      const urlMatch = code.match(/[?&](?:kode|verify)=([^&]+)/);
      if (urlMatch) code = decodeURIComponent(urlMatch[1]);
      else if (code.startsWith('VERIFY:')) code = code.substring(7);
      handleVerify(code);
    } catch {
      setScanState('error');
      setErrorMsg('QR Code tidak terbaca dari gambar. Pastikan gambar jelas dan berisi QR Code yang valid.');
    } finally {
      document.body.removeChild(tempEl);
    }
    event.target.value = '';
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
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        async (decodedText) => {
          await stopScanner();
          let code = decodedText;
          if (code.startsWith('VERIFY:')) code = code.substring(7);
          handleVerify(code);
        },
        () => {},
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
    setShowConfirmForm(false);
    setConfirmName('');
    setConfirmQty(0);
    setConfirmLoading(false);
    setConfirmSuccess(false);
    setConfirmError('');
  };

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  // Admin langsung punya akses lapangan, user biasa butuh unlock
  const lapanganUnlocked = isAdmin || passwordUnlocked;
  const canScan = mode === 'verify' || (mode === 'lapangan' && lapanganUnlocked);
  const isLapangan = mode === 'lapangan';

  return (
    <div className="fade-in space-y-4 pb-24">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { stopScanner(); navigate(-1); }}
          className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {isLapangan ? 'Konfirmasi Lapangan' : 'Verifikasi Dokumen'}
          </h1>
          <p className="text-xs text-gray-500">
            {isLapangan ? 'Konfirmasi penerimaan bibit di lapangan' : 'Scan QR Code dari Surat Jalan'}
          </p>
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
        <button
          onClick={() => handleModeSwitch('verify')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            mode === 'verify'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Verifikasi Dokumen
        </button>
        <button
          onClick={() => handleModeSwitch('lapangan')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            mode === 'lapangan'
              ? 'bg-white text-orange-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          Konfirmasi Lapangan
        </button>
      </div>

      {/* Info lapangan — hanya muncul untuk non-admin yang belum unlock */}
      {isLapangan && !lapanganUnlocked && scanState === 'idle' && (
        <div className="bg-white rounded-2xl border border-orange-200 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div className="text-white">
              <p className="font-bold text-sm">Konfirmasi Lapangan</p>
              <p className="text-xs text-orange-100">Scan QR untuk konfirmasi penerimaan bibit</p>
            </div>
          </div>
          <div className="p-5">
            <Button
              size="md"
              variant="primary"
              icon={<MapPin className="w-4 h-4" />}
              onClick={() => setPasswordUnlocked(true)}
              className="w-full !bg-orange-500 hover:!bg-orange-600"
            >
              Aktifkan Mode Lapangan
            </Button>
          </div>
        </div>
      )}

      {/* Scanner Area */}
      {canScan && (scanState === 'idle' || scanState === 'scanning') && (
        <div className={`bg-white rounded-2xl border shadow-lg overflow-hidden ${
          isLapangan ? 'border-orange-200' : 'border-gray-200'
        }`}>
          <div className={`px-5 py-3 bg-gradient-to-r ${
            isLapangan ? 'from-orange-500 to-amber-500' : 'from-emerald-600 to-teal-600'
          }`}>
            <p className="text-white text-sm font-semibold flex items-center gap-2">
              <Camera className="w-4 h-4" />
              {isLapangan ? 'Scan QR — Konfirmasi Lapangan' : 'Scanner QR Code'}
            </p>
          </div>

          <div className="p-4 space-y-4">
            {scanState === 'idle' ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${
                  isLapangan ? 'bg-orange-50' : 'bg-emerald-50'
                }`}>
                  <Camera className={`w-10 h-10 ${isLapangan ? 'text-orange-500' : 'text-emerald-600'}`} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-900">
                    {isLapangan ? 'Konfirmasi Surat Jalan Tiba' : 'Verifikasi Surat Jalan'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {isLapangan
                      ? 'Scan QR Code dari surat jalan untuk mengkonfirmasi bibit sudah diterima di lapangan.'
                      : 'Arahkan kamera ke QR Code pada Surat Jalan untuk memverifikasi keaslian dokumen.'}
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <Button
                    size="md"
                    variant="primary"
                    icon={<Camera className="w-4 h-4" />}
                    onClick={startScanner}
                    className={isLapangan ? '!bg-orange-500 hover:!bg-orange-600' : ''}
                  >
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
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImportImage} style={{ display: 'none' }} />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div id="qr-reader" ref={containerRef} className="rounded-xl overflow-hidden bg-black" style={{ minHeight: 300 }} />
                <p className="text-xs text-center text-gray-500 animate-pulse">Arahkan kamera ke QR Code...</p>
                <Button size="sm" variant="secondary" onClick={handleReset} className="w-full">Batal</Button>
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
          {/* Info Card */}
          <div className={`bg-white rounded-2xl border-2 shadow-lg overflow-hidden ${
            isLapangan ? 'border-orange-400' : 'border-emerald-400'
          }`}>
            <div className={`px-5 py-4 flex items-center gap-3 bg-gradient-to-r ${
              isLapangan ? 'from-orange-500 to-amber-500' : 'from-emerald-500 to-teal-500'
            }`}>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                {isLapangan
                  ? <MapPin className="w-6 h-6 text-white" />
                  : <ShieldCheck className="w-6 h-6 text-white" />}
              </div>
              <div className="text-white">
                <p className="font-bold text-base">
                  {isLapangan ? 'Surat Jalan Ditemukan' : 'Dokumen Valid'}
                </p>
                <p className={`text-xs ${isLapangan ? 'text-orange-100' : 'text-emerald-100'}`}>
                  {isLapangan ? 'Lengkapi form konfirmasi penerimaan di bawah' : 'Keaslian dokumen terverifikasi'}
                </p>
              </div>
            </div>

            <div className="px-5 py-5 space-y-3">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                isLapangan ? 'bg-orange-50 border-orange-200' : 'bg-emerald-50 border-emerald-200'
              }`}>
                {isLapangan
                  ? <MapPin className="w-4 h-4 text-orange-600 flex-shrink-0" />
                  : <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                <span className={`text-xs font-medium ${isLapangan ? 'text-orange-700' : 'text-emerald-700'}`}>
                  {isLapangan
                    ? 'Dokumen valid — isi konfirmasi penerimaan bibit di bawah'
                    : 'Kode verifikasi cocok dengan data distribusi resmi'}
                </span>
              </div>

              <div className="space-y-2.5 pt-2">
                <VerifyInfoRow label="Kode" value={result.kodeVerifikasi || scannedCode} mono />
                <VerifyInfoRow label="Tanggal" value={formatTanggal(result.tanggal || '')} />
                <VerifyInfoRow label="Jenis Bibit" value={result.bibit || '-'} highlight />
                {(result.keluar || 0) > 0 && (
                  <VerifyInfoRow label="Jumlah Keluar" value={`${(result.keluar || 0).toLocaleString('id-ID')} polybag`} highlight />
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

          {/* Form Konfirmasi Penerimaan */}
          {!confirmSuccess ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className={`px-5 py-3 flex items-center gap-2 bg-gradient-to-r ${
                isLapangan ? 'from-orange-500 to-amber-500' : 'from-blue-500 to-indigo-500'
              }`}>
                <CheckCircle className="w-4 h-4 text-white" />
                <p className="text-white text-sm font-semibold">Konfirmasi Penerimaan Bibit</p>
                {isLapangan && (
                  <span className="ml-auto text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-semibold">
                    WAJIB
                  </span>
                )}
              </div>
              <div className="p-4 space-y-3">
                {/* verify mode: form hanya muncul setelah tekan tombol */}
                {!showConfirmForm && !isLapangan ? (
                  <Button
                    size="md"
                    variant="primary"
                    icon={<CheckCircle className="w-4 h-4" />}
                    onClick={() => setShowConfirmForm(true)}
                    className="w-full"
                  >
                    Konfirmasi Terima
                  </Button>
                ) : (
                  <>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Nama Penerima</label>
                      <input
                        type="text"
                        value={confirmName}
                        onChange={e => setConfirmName(e.target.value)}
                        placeholder="Masukkan nama penerima..."
                        autoFocus={isLapangan}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Jumlah Diterima (polybag)</label>
                      <input
                        type="number"
                        value={confirmQty}
                        onChange={e => setConfirmQty(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      />
                    </div>
                    {confirmError && <p className="text-xs text-red-600">{confirmError}</p>}
                    <div className="flex gap-2">
                      {!isLapangan && (
                        <Button size="sm" variant="secondary" onClick={() => setShowConfirmForm(false)} className="flex-1">
                          Batal
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="primary"
                        loading={confirmLoading}
                        onClick={handleConfirm}
                        disabled={!confirmName.trim()}
                        className={`flex-1 ${isLapangan ? '!bg-orange-500 hover:!bg-orange-600' : ''}`}
                      >
                        Konfirmasi
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300">
              <CheckCircle className="w-8 h-8 text-emerald-500 shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-800">Penerimaan Terkonfirmasi!</p>
                <p className="text-xs text-emerald-600">
                  Surat jalan berhasil dikonfirmasi tiba di lapangan oleh{' '}
                  <strong>{confirmName}</strong>
                </p>
              </div>
            </div>
          )}

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
          <Button size="md" variant="secondary" icon={<RotateCcw className="w-4 h-4" />} onClick={handleReset} className="w-full">
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
          <Button size="md" variant="secondary" icon={<RotateCcw className="w-4 h-4" />} onClick={handleReset} className="w-full">
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
