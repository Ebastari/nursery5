import { useState, useEffect, useCallback, useId, useRef } from 'react';
import { Loader2, CheckCircle2, ExternalLink, RefreshCw, AlertCircle, Download } from 'lucide-react';
import { loadOptions } from '../components/chatbot/chatbotLogic';
import type { DropdownData } from '../components/chatbot/chatbotLogic';
import { api } from '../data/mockData';
import { invalidateCache, uploadPdfToDrive } from '../data/api';
import { generateSuratJalanPdf } from '../utils/generateSuratJalanPdf';
import { useStore } from '../store/useStore';

const COMPANY_LOGO = 'https://i.ibb.co/xSTT9wJK/download.png';
const COMPANY_NAME = 'PT Energi Batubara Lestari';
const COMPANY_UNIT = 'Unit Nursery';
const COMPANY_ADDRESS = 'Kalimantan Selatan';

function formatTanggal(tanggal: string): string {
  const d = new Date(tanggal);
  if (isNaN(d.getTime())) return tanggal;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Action = 'masuk' | 'keluar' | 'mati';

interface FormState {
  tanggal: string;
  action: Action;
  bibit: string;
  jumlah: string;
  sumber: string;
  tujuan: string;
  dibuatOleh: string;
  driver: string;
}

interface SuccessData {
  nomorSurat: string;
  kodeVerifikasi: string;
  linkPdf: string;
  formState?: FormState;
  sisaStok?: number;
}

const today = new Date().toISOString().split('T')[0];

const emptyForm = (): FormState => ({
  tanggal: today,
  action: 'masuk',
  bibit: '',
  jumlah: '',
  sumber: '',
  tujuan: '',
  dibuatOleh: '',
  driver: '',
});

// ── Sub-components ────────────────────────────────────────────────────────────

/** Input teks biasa dengan styling seragam. */
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <div className="mt-1">{hint}</div>}
    </div>
  );
}

const inputCls =
  'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-[14px] text-gray-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition ' +
  'disabled:bg-gray-50 disabled:text-gray-400 placeholder:text-gray-400';

/**
 * Combo input: datalist untuk autocomplete dari pilihan yang ada,
 * tapi user tetap bisa ketik bebas.
 */
function ComboInput({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const id = useId();
  return (
    <>
      <input
        list={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={inputCls}
      />
      <datalist id={id}>
        {options.map(o => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}

/**
 * Select native untuk Jenis Bibit — tampil sebagai OS picker di HP,
 * tidak pernah keluar layar. Ada opsi "Lainnya..." untuk ketik nama baru.
 */
const CUSTOM_KEY = '__custom__';
function BibitSelect({
  value,
  onChange,
  options,
  disabled,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
  required?: boolean;
}) {
  const isCustom = value !== '' && !options.includes(value);
  const [selectVal, setSelectVal] = useState(isCustom ? CUSTOM_KEY : value);
  const customRef = useRef<HTMLInputElement>(null);

  // Sync bila value di-reset dari luar
  useEffect(() => {
    const next = value === '' ? '' : options.includes(value) ? value : CUSTOM_KEY;
    setSelectVal(next);
    if (next === CUSTOM_KEY && customRef.current) {
      customRef.current.focus();
    }
  }, [value, options]);

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setSelectVal(v);
    if (v === CUSTOM_KEY) {
      onChange('');
      setTimeout(() => customRef.current?.focus(), 50);
    } else {
      onChange(v);
    }
  };

  return (
    <div className="space-y-2">
      <select
        value={selectVal}
        onChange={handleSelect}
        disabled={disabled}
        required={required && selectVal !== CUSTOM_KEY}
        className={inputCls + ' appearance-none'}
      >
        <option value="">Pilih jenis bibit…</option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
        <option value={CUSTOM_KEY}>— Ketik nama lain —</option>
      </select>
      {selectVal === CUSTOM_KEY && (
        <input
          ref={customRef}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Ketik nama bibit baru"
          required={required}
          disabled={disabled}
          className={inputCls}
        />
      )}
    </div>
  );
}

// ── Success screen ─────────────────────────────────────────────────────────────

function SuccessScreen({ data, onReset }: { data: SuccessData; onReset: () => void }) {
  const [generating, setGenerating] = useState(false);
  const isKeluar = data.formState?.action === 'keluar';

  const handleDownloadPdf = async () => {
    if (!data.formState) return;
    setGenerating(true);
    try {
      let logoDataUrl = '';
      try {
        logoDataUrl = await new Promise<string>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) { ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL('image/png')); }
            else resolve('');
          };
          img.onerror = () => resolve('');
          img.src = COMPANY_LOGO;
        });
      } catch { /* lanjut tanpa logo */ }

      const blob = await generateSuratJalanPdf({
        nomorSurat: data.nomorSurat,
        tanggal: formatTanggal(data.formState.tanggal),
        jenisBibit: data.formState.bibit,
        jumlah: Number(data.formState.jumlah),
        sumber: data.formState.sumber,
        tujuan: data.formState.tujuan,
        sisaStok: data.sisaStok ?? 0,
        dibuatOleh: data.formState.dibuatOleh,
        driver: data.formState.driver,
        kodeVerifikasi: data.kodeVerifikasi,
        logoDataUrl,
        isDraft: false,
        companyName: COMPANY_NAME,
        companyUnit: COMPANY_UNIT,
        companyAddress: COMPANY_ADDRESS,
      });

      const filename = `Surat-Jalan-${data.nomorSurat.replace(/\//g, '-')}.pdf`;

      // Download ke perangkat user
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Upload ke Drive di background — tidak blokir user
      uploadPdfToDrive(blob, filename, data.nomorSurat).catch(() => {});
    } catch (err) {
      console.error('PDF error:', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col items-center text-center gap-5 pt-8 pb-4">
      <div className="w-20 h-20 rounded-3xl bg-emerald-100 flex items-center justify-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-600" strokeWidth={1.8} />
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Data Berhasil Disimpan!</h2>
        <p className="text-sm text-gray-500">Notifikasi WhatsApp telah dikirim ke admin.</p>
      </div>

      {data.nomorSurat && (
        <div className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-left">
          <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">Nomor Surat</p>
          <p className="text-[15px] font-bold text-gray-800 font-mono">{data.nomorSurat}</p>
        </div>
      )}

      {isKeluar && data.linkPdf && (
        <button
          onClick={handleDownloadPdf}
          disabled={generating}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-600 text-white font-semibold text-sm shadow-sm hover:bg-emerald-700 disabled:opacity-60 transition"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {generating ? 'Menyiapkan PDF...' : 'Download Surat Jalan PDF'}
        </button>
      )}

      {data.linkPdf && (
        <a
          href={data.linkPdf}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 font-semibold text-sm hover:bg-blue-100 transition"
        >
          <ExternalLink className="w-4 h-4" />
          Lihat di Spreadsheet
        </a>
      )}

      <button
        onClick={onReset}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition"
      >
        <RefreshCw className="w-4 h-4" />
        Input Data Baru
      </button>
    </div>
  );
}

// ── Skeleton loading ──────────────────────────────────────────────────────────

function FieldSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i}>
          <div className="h-3.5 w-24 bg-gray-200 rounded mb-2 animate-pulse" />
          <div className="h-11 w-full bg-gray-100 rounded-xl animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ── Action tab button ─────────────────────────────────────────────────────────

const ACTION_CONFIG = {
  masuk: { label: ' Masuk', active: 'bg-emerald-600 border-emerald-600 text-white' },
  keluar: { label: ' Keluar', active: 'bg-blue-600 border-blue-600 text-white' },
  mati: { label: 'Mati', active: 'bg-red-500 border-red-500 text-white' },
} as const;

// ── Main component ────────────────────────────────────────────────────────────

export function InputFormScreen() {
  const { authUser } = useStore();
  const [options, setOptions] = useState<DropdownData>({
    bibit: [],
    sumber: [],
    tujuan: [],
    dibuatOleh: [],
    driver: [],
  });
  const [stokMap, setStokMap] = useState<Record<string, number>>({});
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [form, setForm] = useState<FormState>(() => ({
    ...emptyForm(),
    dibuatOleh: authUser?.nama ?? '',
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<SuccessData | null>(null);

  const fetchOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const result = await loadOptions();
      setOptions(result.options);
      setStokMap(result.stokMap);
    } catch {
      // dropdown kosong tapi form tetap bisa dipakai
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  useEffect(() => { fetchOptions(); }, [fetchOptions]);

  const set = useCallback(
    <K extends keyof FormState>(field: K, val: FormState[K]) =>
      setForm(prev => ({ ...prev, [field]: val })),
    [],
  );

  const stokBibit =
    form.bibit ? (stokMap[form.bibit.trim().toUpperCase()] ?? null) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const jumlahNum = Number(form.jumlah);

    if (!form.bibit.trim()) { setError('Jenis bibit wajib diisi.'); return; }
    if (!jumlahNum || jumlahNum < 1) { setError('Jumlah harus lebih dari 0.'); return; }
    if (!form.sumber.trim()) { setError('Sumber wajib diisi.'); return; }
    if (form.action === 'keluar' && !form.tujuan.trim()) {
      setError('Tujuan wajib diisi untuk aktivitas Keluar.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const result = await api.submitActivity({
        tanggal: form.tanggal,
        bibit: form.bibit.trim(),
        masuk:  form.action === 'masuk'  ? jumlahNum : 0,
        keluar: form.action === 'keluar' ? jumlahNum : 0,
        mati:   form.action === 'mati'   ? jumlahNum : 0,
        sumber: form.sumber.trim(),
        tujuan: form.tujuan.trim(),
        dibuatOleh: form.dibuatOleh.trim(),
        driver: form.driver.trim(),
      });
      invalidateCache();
      const bibitKey = form.bibit.trim().toUpperCase();
      const stokSebelum = stokMap[bibitKey] ?? 0;
      const sisaStok = Math.max(0, stokSebelum - (form.action === 'keluar' ? Number(form.jumlah) : 0));
      const res = result as unknown as Record<string, string>;
      setSuccess({
        nomorSurat: res.nomorSurat ?? '',
        kodeVerifikasi: res.kodeVerifikasi ?? '',
        linkPdf: result.linkPdf ?? '',
        formState: form,
        sisaStok,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSuccess(null);
    setForm({ ...emptyForm(), dibuatOleh: authUser?.nama ?? '' });
    fetchOptions();
  };

  // ── Render success ──────────────────────────────────────────────────────────
  if (success) return <SuccessScreen data={success} onReset={handleReset} />;

  // ── Render form ─────────────────────────────────────────────────────────────
  return (
    <div className="pb-4">
      {/* Header info */}
      <div className="mb-5">
        <h2 className="text-[17px] font-bold text-gray-900">Input Aktivitas Bibit</h2>
        <p className="text-[12px] text-gray-400 mt-0.5">
          Data akan otomatis tersimpan ke spreadsheet &amp; dikirim via WhatsApp.
        </p>
      </div>

      {loadingOptions ? (
        <FieldSkeleton />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Tanggal */}
          <Field label="Tanggal">
            <input
              type="date"
              value={form.tanggal}
              max={today}
              onChange={e => set('tanggal', e.target.value)}
              className={inputCls}
              required
            />
          </Field>

          {/* Jenis Aktivitas */}
          <div>
            <label className="block text-[13px] font-semibold text-gray-700 mb-2">
              Jenis Aktivitas
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ACTION_CONFIG) as Action[]).map(act => (
                <button
                  key={act}
                  type="button"
                  onClick={() => set('action', act)}
                  className={`py-2.5 rounded-xl text-[13px] font-semibold border-2 transition-all duration-150 ${
                    form.action === act
                      ? ACTION_CONFIG[act].active
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {ACTION_CONFIG[act].label}
                </button>
              ))}
            </div>
          </div>

          {/* Jenis Bibit */}
          <Field
            label="Jenis Bibit"
            hint={
              stokBibit !== null ? (
                <p
                  className={`text-[12px] font-semibold ${
                    stokBibit <= 0
                      ? 'text-red-500'
                      : stokBibit < 500
                      ? 'text-amber-500'
                      : 'text-emerald-600'
                  }`}
                >
                  Stok saat ini:{' '}
                  <span className="font-bold">{stokBibit.toLocaleString('id-ID')}</span> bibit
                  {stokBibit <= 0 ? ' — Habis' : stokBibit < 500 ? ' — Menipis' : ''}
                </p>
              ) : null
            }
          >
            <BibitSelect
              value={form.bibit}
              onChange={v => set('bibit', v)}
              options={options.bibit}
              required
            />
          </Field>

          {/* Jumlah */}
          <Field
            label={
              form.action === 'masuk'
                ? 'Jumlah Masuk (bibit)'
                : form.action === 'keluar'
                ? 'Jumlah Keluar (bibit)'
                : 'Jumlah Mati (bibit)'
            }
          >
            <input
              type="number"
              min={1}
              step={1}
              value={form.jumlah}
              onChange={e => set('jumlah', e.target.value)}
              placeholder="Masukkan jumlah"
              className={inputCls}
              required
            />
          </Field>

          {/* Sumber */}
          <Field label="Sumber">
            <ComboInput
              value={form.sumber}
              onChange={v => set('sumber', v)}
              options={options.sumber}
              placeholder="Pilih atau ketik sumber bibit"
              required
            />
          </Field>

          {/* Tujuan — hanya untuk keluar */}
          {form.action === 'keluar' && (
            <Field label="Tujuan">
              <ComboInput
                value={form.tujuan}
                onChange={v => set('tujuan', v)}
                options={options.tujuan}
                placeholder="Pilih atau ketik tujuan distribusi"
                required
              />
            </Field>
          )}

          {/* Dibuat Oleh */}
          <Field label="Dibuat Oleh">
            <ComboInput
              value={form.dibuatOleh}
              onChange={v => set('dibuatOleh', v)}
              options={options.dibuatOleh}
              placeholder="Nama petugas (opsional)"
            />
          </Field>

          {/* Driver — hanya untuk keluar */}
          {form.action === 'keluar' && (
            <Field label="Driver / Kurir">
              <ComboInput
                value={form.driver}
                onChange={v => set('driver', v)}
                options={options.driver}
                placeholder="Nama driver (opsional)"
              />
            </Field>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-gray-100 pt-1" />

          {/* Tombol submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-2xl bg-emerald-600 text-white font-bold text-[15px] shadow-md hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 transition-all duration-150 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Menyimpan &amp; Mengirim…
              </>
            ) : (
              '💾  Simpan & Kirim'
            )}
          </button>

          <p className="text-center text-[11px] text-gray-400">
            Data tersimpan otomatis ke spreadsheet Google &amp; notifikasi WhatsApp dikirim ke admin.
          </p>
        </form>
      )}
    </div>
  );
}
