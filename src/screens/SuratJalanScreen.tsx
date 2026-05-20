import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Share2, Printer, Eye, Send } from 'lucide-react';
import DocumentPreview from '../components/DocumentPreview';
import { Button } from '../components/Button';
import { fetchApiData } from '../data/api';
import type { ApiRow } from '../data/api';
import { useStore } from '../store/useStore';
import QRCode from 'qrcode';
import { generateSuratJalanPdf } from '../utils/generateSuratJalanPdf';

const COMPANY_LOGO = 'https://i.ibb.co/xSTT9wJK/download.png';
const COMPANY_NAME = 'PT Energi Batubara Lestari';
const COMPANY_UNIT = 'Unit Nursery';
const COMPANY_ADDRESS = 'Kalimantan Selatan';

function generateNomorSurat(row: ApiRow, index: number): string {
  const d = new Date(row.tanggal);
  const bulanRomawi = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  const bulan = bulanRomawi[d.getMonth()] || 'I';
  const tahun = d.getFullYear();
  const nomor = String(index + 1).padStart(4, '0');
  return `SJ-BIBIT/${nomor}/${bulan}/${tahun}`;
}

function formatTanggal(tanggal: string): string {
  const d = new Date(tanggal);
  if (isNaN(d.getTime())) return tanggal;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function SuratJalanScreen() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const previewRef = useRef<HTMLDivElement>(null);

  const rowIndex = Number(searchParams.get('row') || '0');
  const isFormPreview = searchParams.get('preview') === '1';

  const [row, setRow] = useState<ApiRow | null>(null);
  const [allRows, setAllRows] = useState<ApiRow[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string>(''); // for HTML preview only
  const [logoDataUrl, setLogoDataUrl] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [isDraft, setIsDraft] = useState(true);
  const [kodeVerifikasi, setKodeVerifikasi] = useState<string>('');
  // ...hapus state ApprovalModal...

  const { fetchDocuments } = useStore();
  // Ambil dokumen saat mount
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Nomor surat dan dokumen terkait
  const nomorSurat: string = row ? generateNomorSurat(row, rowIndex) : '';
  // const doc = nomorSurat ? documents.find((d) => d.nomor === nomorSurat) : undefined;

  // ...hapus getApprovalStatus dan logic approval...

  // Load data
  useEffect(() => {
    fetchApiData().then((rows) => {
      setAllRows(rows);

      // Jika preview dari form input â€” buat row virtual dari query params
      if (isFormPreview) {
        const formRow: ApiRow = {
          tanggal: searchParams.get('tanggal') || new Date().toISOString().split('T')[0],
          bulan: '',
          bibit: searchParams.get('bibit') || '-',
          masuk: 0,
          keluar: Number(searchParams.get('keluar')) || 0,
          mati: 0,
          total: 0,
          sumber: searchParams.get('sumber') || '-',
          tujuan: searchParams.get('tujuan') || '-',
          statusKirim: '',
          kodeVerifikasi: 'PREVIEW',
          dibuatOleh: searchParams.get('dibuatOleh') || '-',
          driver: searchParams.get('driver') || '-',
        };
        setRow(formRow);
        setKodeVerifikasi('PREVIEW');
        return;
      }

      // Normal mode: ambil dari data distribusi
      const distribusi = rows.filter((r) => r.keluar > 0);
      const selected = distribusi[rowIndex] || distribusi[distribusi.length - 1];
      if (selected) {
        setRow(selected);
        setKodeVerifikasi(selected.kodeVerifikasi || '');
      }
    });
  }, [rowIndex, isFormPreview, searchParams]);

  // Generate QR code with verification code
  useEffect(() => {
    if (!row || !kodeVerifikasi) return;
    // QR berisi kode verifikasi saja â€” hanya bisa diverifikasi lewat scanner di aplikasi
    const qrContent = `VERIFY:${kodeVerifikasi}`;
    QRCode.toDataURL(qrContent, {
      width: 140,
      margin: 1,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    }).then(setQrDataUrl);
  }, [row, kodeVerifikasi]);

  // Load logo as data URL for PDF
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        setLogoDataUrl(canvas.toDataURL('image/png'));
      }
    };
    img.src = COMPANY_LOGO;
  }, []);

  // Hitung stok per bibit
  const getStokBibit = useCallback(
    (bibit: string) => {
      let stok = 0;
      for (const r of allRows) {
        if (r.bibit.trim().toUpperCase() === bibit.trim().toUpperCase()) {
          stok += r.masuk - r.keluar - r.mati;
        }
      }
      return Math.max(0, stok);
    },
    [allRows],
  );

  if (!row) {
    return (
      <div className="fade-in flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-gray-500">Memuat data surat jalan...</p>
      </div>
    );
  }

  const stokSetelah = getStokBibit(row.bibit);
  // Jika preview dari form input, otomatis approve
  // ...hapus logic approval preview...
  // ...hapus variabel tidak terpakai...

  // === PDF Generation â€” delegates to canonical generateSuratJalanPdf ===
  const generatePDF = useCallback(async (draft: boolean) => {
    if (!row) return;
    setGenerating(true);
    try {
      const blob = await generateSuratJalanPdf({
        nomorSurat,
        tanggal: formatTanggal(row.tanggal),
        jenisBibit: row.bibit,
        jumlah: row.keluar,
        sumber: row.sumber || '',
        tujuan: row.tujuan || '-',
        sisaStok: stokSetelah,
        dibuatOleh: row.dibuatOleh || '-',
        driver: row.driver || '-',
        kodeVerifikasi: kodeVerifikasi || 'PREVIEW',
        logoDataUrl,
        isDraft: draft,
        companyName: COMPANY_NAME,
        companyUnit: COMPANY_UNIT,
        companyAddress: COMPANY_ADDRESS,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${draft ? 'DRAFT-' : ''}Surat-Jalan-${nomorSurat.replace(/\//g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF generation error:', err);
    } finally {
      setGenerating(false);
    }
  }, [row, nomorSurat, stokSetelah, kodeVerifikasi, logoDataUrl]);

  const handleReviewDraft = () => generatePDF(true);
  const handleDownloadFinal = () => {
    setIsDraft(false);
    generatePDF(false);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Surat Jalan ${nomorSurat}`,
          text: `Surat Jalan Distribusi Bibit\nNo: ${nomorSurat}\nJenis: ${row.bibit}\nJumlah: ${row.keluar} polybag\nTujuan: ${row.tujuan}`,
        });
      } catch {
        // user cancelled
      }
    }
  };

  return (
    <div className="fade-in space-y-4 pb-24">
      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Surat Jalan</h1>
          <p className="text-xs text-gray-500">{nomorSurat}</p>
        </div>
      </div>

      {/* Preview Card â€” Surat Jalan */}
      <div ref={previewRef} className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden relative">
        {/* DRAFT Watermark Overlay */}
        {isDraft && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <span
              className="text-[72px] font-black text-red-500/10 select-none tracking-[0.2em]"
              style={{ transform: 'rotate(-35deg)' }}
            >
              DRAFT
            </span>
          </div>
        )}
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4 flex items-center gap-3">
          <img
            src={COMPANY_LOGO}
            alt="Logo"
            className="w-10 h-10 rounded-xl bg-white/20 p-1 object-contain"
          />
          <div className="text-white">
            <p className="font-bold text-sm leading-tight">{COMPANY_NAME}</p>
            <p className="text-[11px] text-emerald-100">
              {COMPANY_UNIT} â€” {COMPANY_ADDRESS}
            </p>
          </div>
        </div>

        {/* Emerald divider */}
        <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500" />

        {/* Document body */}
        <div className="px-5 py-5 space-y-5">
          {/* Title */}
          <div className="text-center">
            <h2 className="text-base font-bold text-gray-900 tracking-wide">
              SURAT JALAN DISTRIBUSI BIBIT
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">No: {nomorSurat}</p>
          </div>

          {/* Info Grid */}
          <div className="space-y-2.5">
            <InfoRow label="Tanggal" value={formatTanggal(row.tanggal)} />
            <InfoRow label="Jenis Bibit" value={row.bibit} highlight />
            <InfoRow label="Jumlah" value={`${row.keluar.toLocaleString('id-ID')} polybag`} highlight />
            <InfoRow label="Asal / Sumber" value={row.sumber || '-'} />
            <InfoRow label="Tujuan / Lokasi" value={row.tujuan || '-'} />
          </div>

          {/* Table */}
          <div className="rounded-xl overflow-hidden border border-gray-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-emerald-600 text-white">
                  <th className="py-2 px-2 text-left font-semibold w-8">No</th>
                  <th className="py-2 px-2 text-left font-semibold">Jenis Bibit</th>
                  <th className="py-2 px-2 text-right font-semibold">Jumlah</th>
                  <th className="py-2 px-2 text-left font-semibold">Satuan</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-100">
                  <td className="py-2.5 px-2 text-gray-600">1</td>
                  <td className="py-2.5 px-2 font-medium text-gray-900">{row.bibit}</td>
                  <td className="py-2.5 px-2 text-right font-bold text-emerald-700">
                    {row.keluar.toLocaleString('id-ID')}
                  </td>
                  <td className="py-2.5 px-2 text-gray-600">polybag</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Stock info */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
            <span className="text-xs text-blue-700">
              ðŸ“¦ Sisa stok <strong>{row.bibit}</strong> setelah distribusi:{' '}
              <strong>{stokSetelah.toLocaleString('id-ID')}</strong> polybag
            </span>
          </div>

          {/* Catatan */}
          <p className="text-[9px] text-gray-400 italic leading-relaxed">
            Catatan: Pastikan bibit dalam kondisi baik saat penyerahan. Surat jalan ini merupakan bukti distribusi resmi.
          </p>

          {/* Signature section */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {([
              { label: 'Dibuat oleh', bold: false, name: row.dibuatOleh && row.dibuatOleh !== '-' ? row.dibuatOleh : '', role: 'Petugas Nursery' },
              { label: 'Disetujui', bold: true, name: 'Mariano Alvarado Simamor', role: 'Dept Head Revegetasi & Rehabilitasi' },
              { label: 'Driver', bold: false, name: row.driver && row.driver !== '-' ? row.driver : '', role: 'Sopir / Kurir' },
            ] as const).map(({ label, bold, name, role }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <p className={`text-[10px] text-gray-700 ${bold ? 'font-bold' : 'font-semibold'}`}>{label}</p>
                <div className="relative flex items-center justify-center w-full" style={{ height: '24px' }}>
                  <div className="absolute inset-x-0 border-b border-gray-300" style={{ top: '50%' }} />
                  <div className="relative z-10 w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold leading-none">âœ“</span>
                  </div>
                </div>
                <p className="text-[9px] font-bold text-emerald-700 text-center leading-tight">{name}</p>
                <p className="text-[8px] text-gray-400 text-center leading-tight">{role}</p>
              </div>
            ))}
          </div>

          {/* QR Code + Footer */}
          <div className="border-t border-gray-200 pt-4 flex items-start gap-3">
            {qrDataUrl && (
              <img src={qrDataUrl} alt="QR Verification" className="w-20 h-20 rounded-lg border border-gray-200" />
            )}
            <div className="flex-1 space-y-1">
              <p className="text-[10px] font-semibold text-gray-700">Scan QR Code untuk verifikasi</p>
              <p className="text-[9px] text-gray-400">
                Verifikasi keaslian dokumen ini melalui fitur Scanner di aplikasi Smart Nursery.
              </p>
              {kodeVerifikasi && kodeVerifikasi !== 'PREVIEW' && (
                <p className="text-[9px] font-mono text-gray-400 mt-0.5">
                  Kode: {kodeVerifikasi}
                </p>
              )}
              <div className="pt-1.5">
                <p className="text-[8px] text-gray-300">
                  Dicetak otomatis oleh Montana AI Engine
                </p>
                <p className="text-[8px] text-gray-300">
                  {COMPANY_NAME} â€” {COMPANY_UNIT}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Draft badge */}
      {isDraft && (
        <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-300">
          <Eye className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-semibold text-amber-800">Mode Draft â€” Review sebelum kirim</span>
        </div>
      )}

      {/* Preview dokumen final jika ada (kolom input) */}
      {row?.linkPdf && row.linkPdf !== '#' && row.linkPdf !== '' && (
        <div className="my-4">
          <div className="text-xs text-gray-500 mb-1 text-center">Preview Dokumen Final:</div>
          <DocumentPreview url={row.linkPdf} height={340} />
        </div>
      )}



      {/* Action buttons */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-[420px] p-4 bg-white/80 backdrop-blur-lg border-t border-gray-100">
        {isDraft ? (
          <div className="flex gap-2">
            <Button
              size="md"
              variant="secondary"
              icon={<Eye className="w-4 h-4" />}
              onClick={handleReviewDraft}
              loading={generating}
              className="flex-1"
            >
              Review Draft
            </Button>
            <Button
              size="md"
              variant="primary"
              icon={<Send className="w-4 h-4" />}
              onClick={handleDownloadFinal}
              loading={generating}
              className="flex-1"
            >
              Kirim Final
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 mb-2">
              <span className="text-xs font-semibold text-emerald-700">âœ… Dokumen Final â€” Siap Distribusi</span>
            </div>
            <div className="flex gap-2">
              <Button
                size="md"
                variant="primary"
                icon={<Download className="w-4 h-4" />}
                onClick={() => generatePDF(false)}
                loading={generating}
                className="flex-1"
              >
                Download PDF
              </Button>
              <Button
                size="md"
                variant="secondary"
                icon={<Printer className="w-4 h-4" />}
                onClick={() => window.print()}
                className="w-12 !px-0"
              />
              {typeof navigator.share === 'function' && (
                <Button
                  size="md"
                  variant="secondary"
                  icon={<Share2 className="w-4 h-4" />}
                  onClick={handleShare}
                  className="w-12 !px-0"
                />
              )}
            </div>
          </div>
        )}

      </div>
      {/* ...hapus ApprovalModal... */}
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="text-gray-500 w-28 flex-shrink-0">{label}</span>
      <span className="text-gray-400">:</span>
      <span className={`${highlight ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{value}</span>
    </div>
  );
}
