import { fetchApiData, fetchDropdowns } from '../../data/api';
import type { ApiRow } from '../../data/api';

// ── Types ──

export type Step =
  | 'greeting'
  | 'action'
  | 'bibit'
  | 'jumlah'
  | 'sumber'
  | 'tujuan'
  | 'dibuat_oleh'
  | 'driver'
  | 'confirm'
  | 'submitting'
  | 'done'
  | 'ask_print';

export type SuratJalanStep =
  | 'sj_start'
  | 'sj_bibit'
  | 'sj_jumlah'
  | 'sj_sumber'
  | 'sj_tujuan'
  | 'sj_dibuat'
  | 'sj_driver'
  | 'sj_confirm'
  | 'sj_done';

export interface FormData {
  action: 'masuk' | 'keluar' | 'mati' | '';
  bibit: string;
  jumlah: string;
  sumber: string;
  tujuan: string;
  dibuatOleh: string;
  driver: string;
}

export interface SuratJalanFormData {
  bibit: string;
  jumlah: string;
  sumber: string;
  tujuan: string;
  dibuatOleh: string;
  driver: string;
}

export const emptySuratJalanForm: SuratJalanFormData = {
  bibit: '', jumlah: '', sumber: '', tujuan: '', dibuatOleh: '', driver: '',
};

export interface QuickReply {
  label: string;
  value: string;
  variant?: 'primary' | 'danger' | 'default';
}

export interface DropdownData {
  bibit: string[];
  sumber: string[];
  tujuan: string[];
  dibuatOleh: string[];
  driver: string[];
}

export interface StokMap {
  [key: string]: number;
}

// ── Constants ──

export const GREETING =
  'Selamat datang di **Fast Input** — asisten pencatatan bibit nursery.\n\nSilakan pilih jenis aktivitas yang ingin dicatat:';

export const STEP_LABELS: Record<Step, string> = {
  greeting: 'Memulai',
  action: 'Langkah 1 / 7 — Jenis Aktivitas',
  bibit: 'Langkah 2 / 7 — Jenis Bibit',
  jumlah: 'Langkah 3 / 7 — Jumlah',
  sumber: 'Langkah 4 / 7 — Sumber',
  tujuan: 'Langkah 5 / 7 — Tujuan',
  dibuat_oleh: 'Langkah 6 / 7 — Pembuat',
  driver: 'Langkah 7 / 7 — Driver',
  confirm: 'Konfirmasi Data',
  submitting: 'Menyimpan data...',
  done: 'Tersimpan',
  ask_print: 'Cetak Surat Jalan',
};

// ── Data loader ──

export async function loadOptions(): Promise<{ options: DropdownData; stokMap: StokMap }> {
  const [rows, dropdowns] = await Promise.all([fetchApiData(), fetchDropdowns()]);
  const bibitSet = new Set<string>();
  const sumberSet = new Set<string>();
  const tujuanSet = new Set<string>();
  const stok: StokMap = {};

  for (const r of rows) {
    if (r.bibit) bibitSet.add(r.bibit.trim());
    if (r.sumber) sumberSet.add(r.sumber.trim());
    if (r.tujuan) tujuanSet.add(r.tujuan.trim());
    const key = r.bibit.trim().toUpperCase();
    if (!stok[key]) stok[key] = 0;
    stok[key] += (r.masuk || 0) - (r.keluar || 0) - (r.mati || 0);
  }
  for (const k of Object.keys(stok)) {
    if (stok[k] < 0) stok[k] = 0;
  }

  return {
    options: {
      bibit: [...bibitSet].sort(),
      sumber: [...sumberSet].sort(),
      tujuan: [...tujuanSet].sort(),
      dibuatOleh: dropdowns.dibuatOleh || [],
      driver: dropdowns.driver || [],
    },
    stokMap: stok,
  };
}

// ── Helper ──

export function fmt(n: number) {
  return n.toLocaleString('id-ID');
}

function stokBadge(stok: number): string {
  if (stok <= 0) return ' — Habis';
  if (stok < 1000) return ' — Menipis';
  return '';
}

// ── Quick reply builders ──

export function getQuickReplies(step: Step, options: DropdownData, stokMap: StokMap): QuickReply[] {
  const common = [
    { label: '**Input Bibit Manual** (bebas tulis)', value: '__free_input__', variant: 'primary' as const }
  ];

  switch (step) {
    case 'action':
    case 'greeting':
      return [
        ...common,
        { label: 'Bibit Masuk', value: 'masuk', variant: 'default' },
        { label: 'Bibit Keluar', value: 'keluar', variant: 'default' },
        { label: 'Bibit Mati', value: 'mati', variant: 'default' },
      ];
    case 'bibit':
      return options.bibit.map((b) => {
        const stok = stokMap[b.toUpperCase()] ?? 0;
        const badge = stokBadge(stok);
        return { label: `${b}${badge}`, value: b };
      });
    case 'sumber':
      return options.sumber.map((s) => ({ label: s, value: s }));
    case 'tujuan':
      return options.tujuan.map((t) => ({ label: t, value: t }));
    case 'dibuat_oleh':
      return options.dibuatOleh.map((d) => ({ label: d, value: d }));
    case 'driver':
      return options.driver.map((d) => ({ label: d, value: d }));
    case 'confirm':
      return [
        { label: 'Kirim Data', value: 'submit', variant: 'primary' },
        { label: 'Ulangi', value: 'reset', variant: 'default' },
      ];
    case 'ask_print':
      return [
        { label: 'Cetak Surat Jalan', value: 'print', variant: 'primary' },
        { label: 'Input Lagi', value: 'new', variant: 'default' },
        { label: 'Selesai', value: 'close', variant: 'default' },
      ];
    case 'done':
      return [
        { label: 'Input Lagi', value: 'new', variant: 'default' },
      ];
    default:
      return [];
  }
}

// ── Natural Language Parser ──
export interface ParsedInput {
  complete: boolean;
  formData: Partial<FormData>;
  missing: string[];
  confidence: number;
}

export function parseFreeInput(text: string, options: DropdownData, stokMap: StokMap): ParsedInput | null {
  const lower = text.toLowerCase().trim();

  const actionMatch = lower.match(/(input|catat|masuk[kan]?|keluar|mati)/);
  const rawAction = actionMatch?.[1] || '';
  const actionMap: Record<string, FormData['action']> = {
    'masuk': 'masuk',
    'masukkan': 'masuk',
    'input': 'masuk',
    'keluar': 'keluar',
    'mati': 'mati',
    'catat': 'masuk'
  };
  const action = actionMap[rawAction] || '';

  const numMatch = lower.match(/(\d+(?:\.\d+)?)/);
  const jumlah = numMatch ? numMatch[1] : '';

  let bibit = '';
  for (const b of options.bibit) {
    if (lower.includes(b.toLowerCase()) || lower.includes(b.toLowerCase().replace(/ /g, ''))) {
      bibit = b;
      const hasStock = stokMap[b.toUpperCase()] ?? 0 > 0;
      if (!hasStock) console.warn(`Low stock warning for bibit: ${b}`);
      break;
    }
  }

  const sumberMatch = lower.match(/(?:dari|sumber|asal)\s*([^\s,.;]+(?:\s+[^\s,.;]+)?)/i);
  const tujuanMatch = lower.match(/(?:ke|tujuan)\s*([^\s,.;]+(?:\s+[^\s,.;]+)?)/i);
  const dibuatMatch = lower.match(/(?:oleh|dibuat)\s*([^\s,.;]+(?:\s+[^\s,.;]+)?)/i);
  const driverMatch = lower.match(/(?:driver|sopir)\s*([^\s,.;]+)/i);

  const parsed: Partial<FormData> = {
    action,
    bibit,
    jumlah,
    sumber: sumberMatch?.[1]?.trim() || '',
    tujuan: tujuanMatch?.[1]?.trim() || '',
    dibuatOleh: dibuatMatch?.[1]?.trim() || '',
    driver: driverMatch?.[1]?.trim() || ''
  };

  const filledCount = Object.values(parsed).filter(Boolean).length;
  const confidence = filledCount / 7;

  const required = ['action', 'bibit', 'jumlah'];
  const missing = required.filter(field => !parsed[field as keyof typeof parsed]);

  return {
    complete: confidence >= 0.8 && missing.length === 0,
    formData: parsed,
    missing,
    confidence: Math.round(confidence * 100) / 100
  };
}

// ── Step processor ──

export function processStep(
  step: Step,
  value: string,
  formData: FormData,
  stokMap: StokMap,
): { message: string; nextStep: Step; updatedForm: Partial<FormData> } | null {
  switch (step) {
    case 'action': {
      const map: Record<string, FormData['action']> = { masuk: 'masuk', keluar: 'keluar', mati: 'mati' };
      const action = map[value];
      if (!action) return null;

      const labels = { masuk: 'Bibit Masuk', keluar: 'Bibit Keluar', mati: 'Bibit Mati' };
      return {
        message: `**${labels[action]}** — dicatat.\n\nPilih jenis bibit:`,
        nextStep: 'bibit',
        updatedForm: { action },
      };
    }

    case 'bibit': {
      const stok = stokMap[value.toUpperCase()] ?? 0;
      const stokInfo = `Stok saat ini: **${fmt(stok)}** bibit`;
      return {
        message: `Bibit: **${value}**\n${stokInfo}\n\nMasukkan jumlah:`,
        nextStep: 'jumlah',
        updatedForm: { bibit: value },
      };
    }

    case 'jumlah': {
      const num = parseInt(value);
      if (isNaN(num) || num <= 0) return null;

      let warning = '';
      if (formData.action === 'keluar' || formData.action === 'mati') {
        const stok = stokMap[formData.bibit.toUpperCase()] ?? 0;
        if (num > stok) {
          warning = `\n\n**Perhatian:** Jumlah melebihi stok tersedia (${fmt(stok)}).`;
        }
      }

      return {
        message: `Jumlah: **${fmt(num)}** bibit${warning}\n\nPilih sumber / asal bibit:`,
        nextStep: 'sumber',
        updatedForm: { jumlah: String(num) },
      };
    }

    case 'sumber': {
      if (formData.action === 'keluar') {
        return {
          message: `Sumber: **${value}**\n\nPilih tujuan distribusi:`,
          nextStep: 'tujuan',
          updatedForm: { sumber: value },
        };
      }
      return {
        message: `Sumber: **${value}**\n\n${buildSummary({ ...formData, sumber: value })}`,
        nextStep: 'confirm',
        updatedForm: { sumber: value },
      };
    }

    case 'tujuan': {
      return {
        message: `Tujuan: **${value}**\n\nPilih nama pembuat dokumen:`,
        nextStep: 'dibuat_oleh',
        updatedForm: { tujuan: value },
      };
    }

    case 'dibuat_oleh': {
      return {
        message: `Dibuat oleh: **${value}**\n\nPilih driver / pengantar:`,
        nextStep: 'driver',
        updatedForm: { dibuatOleh: value },
      };
    }

    case 'driver': {
      const updated = { ...formData, driver: value };
      return {
        message: `Driver: **${value}**\n\n${buildSummary(updated)}`,
        nextStep: 'confirm',
        updatedForm: { driver: value },
      };
    }

    default:
      return null;
  }
}

// ── Summary builder ──

function buildSummary(data: FormData): string {
  const labels = { masuk: 'Bibit Masuk', keluar: 'Bibit Keluar', mati: 'Bibit Mati' };
  const jumlah = fmt(Number(data.jumlah));

  let text = '━━━━━━━━━━━━━━━━━━\n';
  text += '**Ringkasan Data**\n\n';
  text += `Aktivitas: **${labels[data.action as keyof typeof labels] || '-'}**\n`;
  text += `Bibit: **${data.bibit}**\n`;
  text += `Jumlah: **${jumlah}** bibit\n`;
  text += `Sumber: **${data.sumber || '-'}**\n`;

  if (data.action === 'keluar') {
    text += `Tujuan: **${data.tujuan || '-'}**\n`;
    text += `Dibuat oleh: **${data.dibuatOleh || '-'}**\n`;
    text += `Driver: **${data.driver || '-'}**\n`;
  }

  text += '━━━━━━━━━━━━━━━━━━\n';
  text += 'Periksa data di atas. Jika sudah benar, tekan **Kirim Data**.';
  return text;
}

// ── After-submit messages ──

export function getSuccessMessage(formData: FormData): string {
  const jumlah = fmt(Number(formData.jumlah));
  const labels = { masuk: 'Bibit Masuk', keluar: 'Bibit Keluar', mati: 'Bibit Mati' };
  const label = labels[formData.action as keyof typeof labels] || '-';

  let msg = '**Data berhasil disimpan.**\n\n';
  msg += `${label} — ${formData.bibit} — ${jumlah} bibit\n`;
  msg += 'Notifikasi WhatsApp telah dikirim ke grup admin.';

  if (formData.action === 'keluar' && Number(formData.jumlah) > 0) {
    msg += '\n\nApakah Anda ingin mencetak **Surat Jalan** untuk distribusi ini?';
  }

  return msg;
}

export function getSuccessStep(formData: FormData): Step {
  if (formData.action === 'keluar' && Number(formData.jumlah) > 0) {
    return 'ask_print';
  }
  return 'done';
}

// ────────────────────────────────────────────────
//  SURAT JALAN CHAT FLOW
// ────────────────────────────────────────────────

export function getSuratJalanQuickReplies(
  step: SuratJalanStep,
  options: DropdownData,
  stokMap: StokMap,
): QuickReply[] {
  switch (step) {
    case 'sj_start':
    case 'sj_bibit':
      return options.bibit.map((b) => {
        const stok = stokMap[b.toUpperCase()] ?? 0;
        const badge = stok <= 0 ? ' — Habis' : stok < 1000 ? ' — Menipis' : '';
        return { label: `${b}${badge}`, value: b };
      });
    case 'sj_sumber':
      return options.sumber.map((s) => ({ label: s, value: s }));
    case 'sj_tujuan':
      return options.tujuan.map((t) => ({ label: t, value: t }));
    case 'sj_dibuat':
      return options.dibuatOleh.map((d) => ({ label: d, value: d }));
    case 'sj_driver':
      return options.driver.map((d) => ({ label: d, value: d }));
    case 'sj_confirm':
      return [
        { label: 'Buat Surat Jalan (PDF)', value: 'generate_pdf', variant: 'primary' },
        { label: 'Ulangi Input', value: 'reset_sj', variant: 'default' },
      ];
    case 'sj_done':
      return [
        { label: 'Buat Surat Jalan Baru', value: 'new_sj', variant: 'default' },
      ];
    default:
      return [];
  }
}

export function processSuratJalanStep(
  step: SuratJalanStep,
  value: string,
  form: SuratJalanFormData,
  stokMap: StokMap,
): { message: string; nextStep: SuratJalanStep; updatedForm: Partial<SuratJalanFormData> } | null {
  switch (step) {
    case 'sj_start':
    case 'sj_bibit': {
      if (!value) return null;
      const stok = stokMap[value.toUpperCase()] ?? 0;
      return {
        message: `Jenis Bibit: **${value}**\nStok tersedia: **${fmt(stok)}** bibit\n\nMasukkan jumlah yang akan didistribusikan:`,
        nextStep: 'sj_jumlah',
        updatedForm: { bibit: value },
      };
    }
    case 'sj_jumlah': {
      const num = parseInt(value);
      if (isNaN(num) || num <= 0) return null;
      const stok = stokMap[form.bibit.toUpperCase()] ?? 0;
      const warning = num > stok ? `\n⚠️ **Perhatian:** Jumlah melebihi stok tersedia (${fmt(stok)}).` : '';
      return {
        message: `Jumlah: **${fmt(num)}** polybag${warning}\n\nPilih sumber / lokasi asal bibit:`,
        nextStep: 'sj_sumber',
        updatedForm: { jumlah: String(num) },
      };
    }
    case 'sj_sumber': {
      return {
        message: `Sumber: **${value}**\n\nPilih tujuan distribusi:`,
        nextStep: 'sj_tujuan',
        updatedForm: { sumber: value },
      };
    }
    case 'sj_tujuan': {
      return {
        message: `Tujuan: **${value}**\n\nPilih nama petugas pembuat surat:`,
        nextStep: 'sj_dibuat',
        updatedForm: { tujuan: value },
      };
    }
    case 'sj_dibuat': {
      return {
        message: `Dibuat oleh: **${value}**\n\nPilih driver / pengantar:`,
        nextStep: 'sj_driver',
        updatedForm: { dibuatOleh: value },
      };
    }
    case 'sj_driver': {
      const updated = { ...form, driver: value };
      return {
        message: buildSuratJalanSummary(updated),
        nextStep: 'sj_confirm',
        updatedForm: { driver: value },
      };
    }
    default:
      return null;
  }
}

export function buildSuratJalanSummary(data: SuratJalanFormData): string {
  const jumlah = fmt(Number(data.jumlah));
  let text = '━━━━━━━━━━━━━━━━━━\n';
  text += '**Ringkasan Surat Jalan**\n\n';
  text += `Jenis Bibit    : **${data.bibit}**\n`;
  text += `Jumlah         : **${jumlah}** polybag\n`;
  text += `Asal / Sumber  : **${data.sumber || '-'}**\n`;
  text += `Tujuan         : **${data.tujuan || '-'}**\n`;
  text += `Dibuat oleh    : **${data.dibuatOleh || '-'}**\n`;
  text += `Driver         : **${data.driver || '-'}**\n`;
  text += '━━━━━━━━━━━━━━━━━━\n';
  text += 'Tekan **Buat Surat Jalan (PDF)** untuk menghasilkan dokumen.';
  return text;
}

// ────────────────────────────────────────────────
//  DEEP INFO ANALYSIS ENGINE
// ────────────────────────────────────────────────

export interface AnalysisResult {
  title: string;
  body: string;
}

// Mortalitas benchmarks — nursery revegetasi industry standard
function labelMortalitas(rate: number): string {
  if (rate < 2) return 'sangat baik';
  if (rate < 5) return 'normal';
  if (rate < 10) return 'perlu perhatian';
  return 'kritis';
}

function interpretasiMortalitas(rate: number, nama: string, jumlahMati: number, periode = 'kumulatif'): string {
  const angka = rate.toFixed(1);
  if (rate < 2)
    return `Angka kematian ${nama} sebesar ${angka}% (${fmt(jumlahMati)} tanaman, ${periode}) tergolong **sangat baik** — berada di bawah ambang 2% yang menjadi standar pembibitan intensif revegetasi. Kondisi ini mencerminkan pengelolaan yang efektif.`;
  if (rate < 5)
    return `Tingkat kehilangan ${nama} sebesar ${angka}% (${fmt(jumlahMati)} tanaman, ${periode}) masih dalam **rentang normal** (2–5%) yang dapat diterima pada kegiatan nursery skala lapangan. Pemantauan rutin tetap disarankan untuk mencegah tren kenaikan.`;
  if (rate < 10)
    return `Angka kematian ${nama} sebesar ${angka}% (${fmt(jumlahMati)} tanaman, ${periode}) telah **melampaui ambang toleransi** normal (< 5%). Berdasarkan standar pembibitan revegetasi, kondisi ini memerlukan investigasi terhadap faktor lingkungan, media tanam, dan pola penyiraman.`;
  return `Tingkat kehilangan ${nama} sebesar ${angka}% (${fmt(jumlahMati)} tanaman, ${periode}) tergolong **kritis** dan jauh di atas standar industri (< 5%). Kehilangan pada skala ini berpotensi mengganggu target revegetasi — diperlukan penanganan mendesak untuk mengidentifikasi akar masalah.`;
}

function labelStok(stok: number): string {
  if (stok <= 0) return 'Stok habis';
  if (stok < 500) return 'Kritis';
  if (stok < 1000) return 'Menipis';
  if (stok < 2000) return 'Cukup';
  return 'Aman';
}

export async function analyzeDeepInfo(
  query: string,
  options: DropdownData,
  stokMap: StokMap,
): Promise<AnalysisResult | null> {
  const q = query.toLowerCase().trim();

  let apiRows: ApiRow[] = [];
  try {
    apiRows = await fetchApiData();
  } catch {
    return { title: 'Koneksi Gagal', body: 'Data tidak dapat diambil saat ini. Pastikan koneksi internet tersedia dan coba kembali.' };
  }

  // ── Analisis lengkap / ringkasan ──
  if (
    q.includes('analisis') ||
    q.includes('laporan lengkap') ||
    q.includes('ringkasan') ||
    q.includes('semua data') ||
    q.includes('full report')
  ) {
    let totalStok = 0, totalMasuk = 0, totalKeluar = 0, totalMati = 0;
    const perBibit: Array<{ bibit: string; stok: number; masuk: number; keluar: number; mati: number }> = [];

    for (const b of options.bibit) {
      const key = b.toUpperCase();
      const stok = stokMap[key] || 0;
      let masuk = 0, keluar = 0, mati = 0;
      for (const r of apiRows) {
        if (r.bibit.trim().toUpperCase() === key) {
          masuk += r.masuk || 0;
          keluar += r.keluar || 0;
          mati += r.mati || 0;
        }
      }
      totalStok += stok;
      totalMasuk += masuk;
      totalKeluar += keluar;
      totalMati += mati;
      perBibit.push({ bibit: b, stok, masuk, keluar, mati });
    }

    perBibit.sort((a, b) => b.stok - a.stok);
    const kritisArr = perBibit.filter((b) => b.stok > 0 && b.stok < 500);
    const habisArr = perBibit.filter((b) => b.stok <= 0);
    const mortalitasRate = totalMasuk > 0 ? (totalMati / totalMasuk) * 100 : 0;
    const mortalitasLabel = labelMortalitas(mortalitasRate);
    const efisiensi = totalMasuk > 0 ? ((totalKeluar / totalMasuk) * 100).toFixed(1) : '0';

    let body = `Nursery saat ini mengelola **${options.bibit.length} jenis bibit** dengan total stok aktif **${fmt(totalStok)} polybag**. `;
    body += `Secara kumulatif, sebanyak ${fmt(totalMasuk)} bibit telah masuk, ${fmt(totalKeluar)} bibit terdistribusi (efisiensi distribusi ${efisiensi}%), `;
    body += `dan ${fmt(totalMati)} bibit tidak dapat diselamatkan — menghasilkan tingkat mortalitas keseluruhan **${mortalitasRate.toFixed(1)}%** yang tergolong **${mortalitasLabel}** `;
    body += `berdasarkan standar pembibitan revegetasi (target < 5%).\n\n`;

    body += '**Kondisi Stok per Jenis Bibit:**\n';
    for (const b of perBibit) {
      const mortalitas = b.masuk > 0 ? ((b.mati / b.masuk) * 100).toFixed(1) : '0.0';
      const statusStok = labelStok(b.stok);
      body += `• **${b.bibit}** — ${fmt(b.stok)} polybag _(${statusStok})_, mortalitas ${mortalitas}%\n`;
    }

    if (kritisArr.length > 0 || habisArr.length > 0) {
      body += '\n**Peringatan Pengadaan:**\n';
      if (habisArr.length > 0)
        body += `Stok habis — perlu pengisian segera: **${habisArr.map((b) => b.bibit).join(', ')}**.\n`;
      if (kritisArr.length > 0)
        body += `Stok kritis (< 500) — perlu pengadaan prioritas: **${kritisArr.map((b) => b.bibit).join(', ')}**.\n`;
    }

    return { title: 'Analisis Komprehensif Stok Bibit', body };
  }

  // ── Stok kritis / menipis / habis ──
  if (
    q.includes('kritis') ||
    q.includes('menipis') ||
    q.includes('habis') ||
    q.includes('darurat') ||
    q.includes('bahaya')
  ) {
    const habisArr: string[] = [];
    const kritisArr: Array<{ nama: string; stok: number }> = [];
    const menipisArr: Array<{ nama: string; stok: number }> = [];

    for (const b of options.bibit) {
      const stok = stokMap[b.toUpperCase()] || 0;
      if (stok <= 0) habisArr.push(b);
      else if (stok < 500) kritisArr.push({ nama: b, stok });
      else if (stok < 1000) menipisArr.push({ nama: b, stok });
    }

    if (habisArr.length === 0 && kritisArr.length === 0 && menipisArr.length === 0) {
      return {
        title: 'Status Stok — Kondisi Baik',
        body: 'Seluruh jenis bibit yang dipantau saat ini memiliki stok di atas 1.000 polybag. Tidak ada kondisi kritis maupun menipis yang perlu ditindaklanjuti. Pastikan monitoring stok tetap dilakukan secara berkala untuk antisipasi dini.',
      };
    }

    let body = '';
    if (habisArr.length > 0) {
      body += `**Stok Habis (0 polybag) — Tindakan Segera:**\nJenis bibit berikut tidak lagi memiliki stok tersedia: ${habisArr.map((b) => `**${b}**`).join(', ')}. Kekosongan ini dapat menghambat jadwal distribusi ke lokasi revegetasi — pengisian ulang perlu diprioritaskan.\n\n`;
    }
    if (kritisArr.length > 0) {
      body += `**Stok Kritis (< 500 polybag) — Prioritas Pengadaan:**\n`;
      for (const { nama, stok } of kritisArr) {
        body += `• **${nama}**: tersisa ${fmt(stok)} polybag — berada di bawah ambang minimum operasional.\n`;
      }
      body += '\n';
    }
    if (menipisArr.length > 0) {
      body += `**Stok Menipis (500–1.000 polybag) — Perlu Pemantauan:**\n`;
      for (const { nama, stok } of menipisArr) {
        body += `• **${nama}**: tersisa ${fmt(stok)} polybag — masih beroperasi namun memerlukan perhatian.\n`;
      }
    }

    return { title: 'Status Stok — Peringatan Dini', body };
  }

  // ── Tingkat mortalitas / kematian ──
  if (
    q.includes('mortalitas') ||
    q.includes('tingkat kematian') ||
    q.includes('persentase mati') ||
    q.includes('persentase kematian') ||
    q.includes('rate kematian')
  ) {
    const results: Array<{ bibit: string; mati: number; masuk: number; rate: number }> = [];

    for (const b of options.bibit) {
      const key = b.toUpperCase();
      let masuk = 0, mati = 0;
      for (const r of apiRows) {
        if (r.bibit.trim().toUpperCase() === key) {
          masuk += r.masuk || 0;
          mati += r.mati || 0;
        }
      }
      if (masuk > 0 || mati > 0)
        results.push({ bibit: b, mati, masuk, rate: masuk > 0 ? (mati / masuk) * 100 : 0 });
    }
    results.sort((a, b) => b.rate - a.rate);

    const totalMasuk = results.reduce((s, r) => s + r.masuk, 0);
    const totalMati = results.reduce((s, r) => s + r.mati, 0);
    const rateGlobal = totalMasuk > 0 ? (totalMati / totalMasuk) * 100 : 0;

    let body = `Berdasarkan seluruh data historis nursery, tingkat mortalitas bibit secara keseluruhan adalah **${rateGlobal.toFixed(1)}%** — dikategorikan **${labelMortalitas(rateGlobal)}**. `;
    body += `Standar pembibitan revegetasi yang umum digunakan dalam kegiatan reklamasi lahan menargetkan angka ini di bawah 5%, dengan nilai ideal kurang dari 2%.\n\n`;
    body += '**Rincian per Jenis Bibit (diurutkan dari tertinggi):**\n';

    for (const r of results) {
      const status = labelMortalitas(r.rate);
      body += `• **${r.bibit}**: ${r.rate.toFixed(1)}% (${fmt(r.mati)} dari ${fmt(r.masuk)} bibit) — _${status}_\n`;
    }

    if (results.length > 0) {
      const terburuk = results[0];
      if (terburuk.rate >= 5) {
        body += `\n${interpretasiMortalitas(terburuk.rate, terburuk.bibit, terburuk.mati)}`;
      }
    }

    return { title: 'Analisis Tingkat Mortalitas Bibit', body };
  }

  // ── Tren aktivitas terbaru ──
  if (
    q.includes('tren') ||
    q.includes('minggu ini') ||
    q.includes('7 hari') ||
    q.includes('seminggu') ||
    (q.includes('terbaru') && !q.includes('stok'))
  ) {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recent = apiRows.filter((r) => new Date(r.tanggal) >= cutoff);

    if (recent.length === 0) {
      return {
        title: 'Aktivitas 7 Hari Terakhir',
        body: 'Tidak ada transaksi yang tercatat dalam tujuh hari terakhir. Pastikan pencatatan aktivitas harian dilakukan secara konsisten untuk membantu analisis tren.',
      };
    }

    let totalMasuk = 0, totalKeluar = 0, totalMati = 0;
    const byBibit: Record<string, { masuk: number; keluar: number; mati: number }> = {};

    for (const r of recent) {
      totalMasuk += r.masuk || 0;
      totalKeluar += r.keluar || 0;
      totalMati += r.mati || 0;
      const key = r.bibit.trim();
      if (!byBibit[key]) byBibit[key] = { masuk: 0, keluar: 0, mati: 0 };
      byBibit[key].masuk += r.masuk || 0;
      byBibit[key].keluar += r.keluar || 0;
      byBibit[key].mati += r.mati || 0;
    }

    const rateMingguan = totalMasuk > 0 ? ((totalMati / totalMasuk) * 100) : 0;
    const labelRate = labelMortalitas(rateMingguan);

    let body = `Dalam tujuh hari terakhir, nursery mencatat **${recent.length} transaksi** dengan volume masuk **${fmt(totalMasuk)} bibit**, keluar **${fmt(totalKeluar)} bibit**, dan kehilangan **${fmt(totalMati)} bibit**.\n\n`;

    if (totalMati > 0) {
      body += `Tingkat kehilangan minggu ini sebesar **${rateMingguan.toFixed(1)}%** — tergolong **${labelRate}**. `;
      if (rateMingguan >= 5) {
        body += `Angka ini perlu mendapat perhatian; dibandingkan standar nursery revegetasi yang menargetkan kehilangan di bawah 5%, kondisi minggu ini menunjukkan indikasi tekanan pada bibit yang perlu ditelusuri lebih lanjut.\n\n`;
      } else {
        body += `Angka ini masih berada dalam rentang yang dapat diterima untuk kegiatan pembibitan skala lapangan.\n\n`;
      }
    }

    body += '**Rincian per Jenis Bibit:**\n';
    for (const [b, act] of Object.entries(byBibit)) {
      if (act.masuk + act.keluar + act.mati > 0) {
        const parts: string[] = [];
        if (act.masuk > 0) parts.push(`masuk ${fmt(act.masuk)}`);
        if (act.keluar > 0) parts.push(`distribusi ${fmt(act.keluar)}`);
        if (act.mati > 0) parts.push(`kehilangan ${fmt(act.mati)}`);
        body += `• **${b}**: ${parts.join(', ')}\n`;
      }
    }

    return { title: 'Tren Aktivitas 7 Hari Terakhir', body };
  }

  // ── Performa distribusi / ranking tujuan ──
  if (
    q.includes('performa') ||
    q.includes('ranking') ||
    q.includes('terbaik') ||
    q.includes('distribusi terbanyak') ||
    (q.includes('distribusi') && (q.includes('semua') || q.includes('total') || q.includes('per tim')))
  ) {
    const timDist: Record<string, { total: number; frekuensi: number }> = {};
    for (const r of apiRows) {
      if (r.tujuan && r.keluar > 0) {
        const key = r.tujuan.trim();
        if (!timDist[key]) timDist[key] = { total: 0, frekuensi: 0 };
        timDist[key].total += r.keluar;
        timDist[key].frekuensi += 1;
      }
    }
    const sorted = Object.entries(timDist).sort(([, a], [, b]) => b.total - a.total);

    if (sorted.length === 0) {
      return { title: 'Distribusi Bibit', body: 'Belum terdapat data distribusi yang tersedia untuk dianalisis.' };
    }

    const grandTotal = sorted.reduce((s, [, v]) => s + v.total, 0);
    const rataRata = grandTotal / sorted.length;

    let body = `Total bibit yang telah terdistribusi mencapai **${fmt(grandTotal)} polybag** yang disalurkan ke **${sorted.length} lokasi tujuan**, dengan rata-rata **${fmt(Math.round(rataRata))} polybag per tujuan**.\n\n`;
    body += `Lokasi dengan penyerapan tertinggi adalah **${sorted[0][0]}** (${fmt(sorted[0][1].total)} polybag, ${sorted[0][1].frekuensi} kali pengiriman), yang menerima ${((sorted[0][1].total / grandTotal) * 100).toFixed(1)}% dari seluruh distribusi.\n\n`;
    body += '**Rincian per Lokasi Tujuan:**\n';
    sorted.forEach(([tujuan, { total, frekuensi }], i) => {
      const pct = ((total / grandTotal) * 100).toFixed(1);
      body += `${i + 1}. **${tujuan}** — ${fmt(total)} polybag (${pct}%, ${frekuensi}x pengiriman)\n`;
    });

    return { title: 'Analisis Performa Distribusi', body };
  }

  // ── Perbandingan dua bibit ──
  if (q.includes('bandingkan') || q.includes('vs') || q.includes('perbandingan bibit')) {
    const bibitMentioned = options.bibit.filter((b) => q.includes(b.toLowerCase()));
    if (bibitMentioned.length >= 2) {
      const targets = bibitMentioned.slice(0, 3);
      const stats = targets.map((b) => {
        const key = b.toUpperCase();
        const stok = stokMap[key] || 0;
        let masuk = 0, keluar = 0, mati = 0;
        for (const r of apiRows) {
          if (r.bibit.trim().toUpperCase() === key) {
            masuk += r.masuk || 0;
            keluar += r.keluar || 0;
            mati += r.mati || 0;
          }
        }
        const mortalitas = masuk > 0 ? (mati / masuk) * 100 : 0;
        return { bibit: b, stok, masuk, keluar, mati, mortalitas };
      });

      let body = `Perbandingan ${targets.length} jenis bibit berdasarkan data kumulatif nursery:\n\n`;
      for (const s of stats) {
        body += `**${s.bibit}**\n`;
        body += `  Stok saat ini : ${fmt(s.stok)} polybag _(${labelStok(s.stok)})_\n`;
        body += `  Total masuk   : ${fmt(s.masuk)} | Distribusi: ${fmt(s.keluar)} | Kehilangan: ${fmt(s.mati)}\n`;
        body += `  Mortalitas    : ${s.mortalitas.toFixed(1)}% — _${labelMortalitas(s.mortalitas)}_\n\n`;
      }

      const terbaikMortalitas = [...stats].sort((a, b) => a.mortalitas - b.mortalitas)[0];
      const terbanyakKeluar = [...stats].sort((a, b) => b.keluar - a.keluar)[0];
      body += `Dari perbandingan ini, **${terbaikMortalitas.bibit}** menunjukkan performa ketahanan terbaik dengan mortalitas ${terbaikMortalitas.mortalitas.toFixed(1)}%. `;
      body += `Sementara **${terbanyakKeluar.bibit}** merupakan jenis yang paling banyak terdistribusi (${fmt(terbanyakKeluar.keluar)} polybag).`;

      return { title: 'Perbandingan Jenis Bibit', body };
    }
  }

  // ── Rekomendasi / saran ──
  if (
    q.includes('rekomen') ||
    q.includes('saran') ||
    q.includes('apa yang harus') ||
    q.includes('tindakan')
  ) {
    const habisArr: string[] = [];
    const kritisArr: string[] = [];
    let totalMati = 0, totalMasuk = 0;

    for (const b of options.bibit) {
      const stok = stokMap[b.toUpperCase()] || 0;
      if (stok <= 0) habisArr.push(b);
      else if (stok < 500) kritisArr.push(b);
    }
    for (const r of apiRows) {
      totalMati += r.mati || 0;
      totalMasuk += r.masuk || 0;
    }
    const mortalitasGlobal = totalMasuk > 0 ? (totalMati / totalMasuk) * 100 : 0;

    let body = 'Berdasarkan kondisi nursery saat ini, berikut adalah rekomendasi prioritas:\n\n';

    if (habisArr.length > 0) {
      body += `**1. Pengisian Stok Mendesak**\nStok ${habisArr.map((b) => `**${b}**`).join(', ')} telah habis. Kekosongan ini perlu segera ditangani untuk menghindari penundaan distribusi ke lokasi revegetasi.\n\n`;
    }
    if (kritisArr.length > 0) {
      body += `**${habisArr.length > 0 ? '2' : '1'}. Pengadaan Prioritas**\nJenis bibit ${kritisArr.map((b) => `**${b}**`).join(', ')} mendekati batas minimum (< 500 polybag). Proses pengadaan sebaiknya dimulai dalam waktu dekat.\n\n`;
    }

    const noPriorStok = habisArr.length === 0 && kritisArr.length === 0;
    if (mortalitasGlobal > 10) {
      body += `**${noPriorStok ? '1' : habisArr.length + kritisArr.length + 1}. Peningkatan Perawatan Intensif**\nTingkat mortalitas global sebesar **${mortalitasGlobal.toFixed(1)}%** tergolong kritis. Perlu evaluasi menyeluruh terhadap prosedur pemeliharaan, kondisi naungan, dan ketersediaan air.\n\n`;
    } else if (mortalitasGlobal > 5) {
      body += `**${noPriorStok ? '1' : habisArr.length + kritisArr.length + 1}. Pemantauan Kondisi Bibit**\nMortalitas global **${mortalitasGlobal.toFixed(1)}%** sedikit melampaui ambang normal. Lakukan pemantauan harian dan identifikasi jenis bibit dengan angka kehilangan tertinggi.\n\n`;
    } else if (noPriorStok) {
      body += `Kondisi nursery secara umum **baik**. Mortalitas global ${mortalitasGlobal.toFixed(1)}% masih dalam rentang yang dapat diterima. Pertahankan rutinitas pemeliharaan yang ada dan pastikan pencatatan data tetap konsisten.\n\n`;
    }

    body += '_Dihasilkan berdasarkan data aktual AppScript — perbarui data secara berkala untuk akurasi analisis._';

    return { title: 'Rekomendasi Tindakan — AI Montana', body };
  }

  // ── Top bibit (paling banyak terdistribusi) ──
  if (
    q.includes('top') ||
    q.includes('terbanyak') ||
    q.includes('paling banyak') ||
    q.includes('terpopuler')
  ) {
    const byKeluar: Record<string, number> = {};
    for (const r of apiRows) {
      if (r.keluar > 0) {
        const key = r.bibit.trim();
        byKeluar[key] = (byKeluar[key] || 0) + r.keluar;
      }
    }
    const sorted = Object.entries(byKeluar).sort(([, a], [, b]) => b - a).slice(0, 5);

    if (sorted.length === 0) {
      return { title: 'Distribusi Bibit', body: 'Belum terdapat data distribusi yang dapat dianalisis.' };
    }

    const grandTotal = sorted.reduce((s, [, v]) => s + v, 0);
    let body = `Lima jenis bibit dengan volume distribusi tertinggi mencakup **${fmt(grandTotal)} polybag** — gambaran ini mencerminkan preferensi dan kebutuhan lahan revegetasi yang dilayani nursery.\n\n`;

    sorted.forEach(([b, jumlah], i) => {
      const pct = ((jumlah / grandTotal) * 100).toFixed(1);
      const stok = stokMap[b.toUpperCase()] || 0;
      body += `${i + 1}. **${b}** — ${fmt(jumlah)} polybag (${pct}% dari top 5), stok saat ini: ${fmt(stok)}\n`;
    });

    const [topBibit] = sorted;
    body += `\n**${topBibit[0]}** mendominasi distribusi dengan porsi ${((topBibit[1] / grandTotal) * 100).toFixed(1)}% dari kelima bibit teratas. Pastikan stok jenis ini selalu terjaga untuk memenuhi permintaan lapangan.`;

    return { title: 'Top 5 Bibit — Volume Distribusi Tertinggi', body };
  }

  return null;
}

// ────────────────────────────────────────────────
//  LAPORAN AGENT
// ────────────────────────────────────────────────

export async function generateLaporan(
  query: string,
  options: DropdownData,
  stokMap: StokMap,
): Promise<string> {
  const q = query.toLowerCase();
  let apiRows: ApiRow[] = [];
  try {
    apiRows = await fetchApiData();
  } catch {
    return 'Data tidak dapat dimuat saat ini. Pastikan koneksi internet tersedia dan coba kembali.';
  }

  if (q.includes('stok') || q.includes('stock')) {
    let total = 0;
    const sorted = [...options.bibit].map((b) => ({
      bibit: b,
      stok: stokMap[b.toUpperCase()] || 0,
    })).sort((a, b) => b.stok - a.stok);

    for (const { stok } of sorted) total += stok;

    const aman = sorted.filter((s) => s.stok >= 2000).length;
    const kritis = sorted.filter((s) => s.stok > 0 && s.stok < 500).length;
    const habis = sorted.filter((s) => s.stok <= 0).length;

    let msg = `**Laporan Stok Bibit Nursery**\n\n`;
    msg += `Total stok aktif: **${fmt(total)} polybag** tersebar dalam ${options.bibit.length} jenis bibit. `;
    msg += `Dari jumlah tersebut, ${aman} jenis berada pada kondisi aman (≥ 2.000), `;
    msg += `${kritis} jenis kritis (< 500), dan ${habis} jenis tidak memiliki stok tersedia.\n\n`;
    msg += '**Rincian per Jenis Bibit:**\n';

    for (const { bibit: b, stok } of sorted) {
      const status = labelStok(stok);
      msg += `• **${b}**: ${fmt(stok)} polybag — _${status}_\n`;
    }

    msg += `\n_Total keseluruhan: **${fmt(total)} polybag**_`;
    return msg;
  }

  if (q.includes('distribusi') || q.includes('keluar') || q.includes('pengiriman')) {
    const grouped: Record<string, { total: number; count: number }> = {};
    for (const r of apiRows) {
      if (r.keluar > 0 && r.tujuan) {
        const key = r.tujuan.trim();
        if (!grouped[key]) grouped[key] = { total: 0, count: 0 };
        grouped[key].total += r.keluar;
        grouped[key].count += 1;
      }
    }
    const sorted = Object.entries(grouped).sort(([, a], [, b]) => b.total - a.total);
    const grandTotal = sorted.reduce((s, [, v]) => s + v.total, 0);
    const totalMasukAll = apiRows.reduce((s, r) => s + (r.masuk || 0), 0);
    const efisiensi = totalMasukAll > 0 ? ((grandTotal / totalMasukAll) * 100).toFixed(1) : '0';

    let msg = `**Laporan Distribusi Bibit Nursery**\n\n`;
    msg += `Total bibit yang telah terdistribusi: **${fmt(grandTotal)} polybag** ke **${sorted.length} lokasi tujuan** — setara dengan efisiensi distribusi **${efisiensi}%** terhadap total penerimaan.\n\n`;
    msg += '**Rincian per Lokasi:**\n';

    for (const [tujuan, { total, count }] of sorted) {
      const pct = grandTotal > 0 ? ((total / grandTotal) * 100).toFixed(1) : '0';
      msg += `• **${tujuan}**: ${fmt(total)} polybag, ${count}x pengiriman (${pct}%)\n`;
    }
    return msg;
  }

  if (q.includes('kematian') || q.includes('mati') || q.includes('mortalitas')) {
    const grouped: Record<string, number> = {};
    let grandTotal = 0;
    for (const r of apiRows) {
      if (r.mati > 0) {
        const key = r.bibit.trim();
        grouped[key] = (grouped[key] || 0) + r.mati;
        grandTotal += r.mati;
      }
    }
    const sorted = Object.entries(grouped).sort(([, a], [, b]) => b - a);
    const totalMasukAll = apiRows.reduce((s, r) => s + (r.masuk || 0), 0);
    const rateGlobal = totalMasukAll > 0 ? (grandTotal / totalMasukAll) * 100 : 0;

    let msg = `**Laporan Kehilangan Bibit Nursery**\n\n`;
    msg += `Total bibit yang tidak dapat diselamatkan: **${fmt(grandTotal)} polybag**, mencerminkan tingkat mortalitas kumulatif **${rateGlobal.toFixed(1)}%** — tergolong **${labelMortalitas(rateGlobal)}** berdasarkan standar pembibitan revegetasi.\n\n`;
    msg += '**Rincian per Jenis Bibit:**\n';

    for (const [b, mati] of sorted) {
      const masuk = apiRows.filter((r) => r.bibit.trim() === b).reduce((s, r) => s + (r.masuk || 0), 0);
      const rate = masuk > 0 ? (mati / masuk) * 100 : 0;
      const status = labelMortalitas(rate);
      msg += `• **${b}**: ${fmt(mati)} polybag, mortalitas ${rate.toFixed(1)}% — _${status}_\n`;
    }
    return msg;
  }

  if (q.includes('mingguan') || q.includes('minggu') || q.includes('weekly')) {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recent = apiRows.filter((r) => new Date(r.tanggal) >= cutoff);
    let masuk = 0, keluar = 0, mati = 0;
    for (const r of recent) {
      masuk += r.masuk || 0;
      keluar += r.keluar || 0;
      mati += r.mati || 0;
    }

    const rateMingguan = masuk > 0 ? ((mati / masuk) * 100) : 0;
    const efisiensiMinggu = masuk > 0 ? ((keluar / masuk) * 100).toFixed(1) : '0';

    let msg = `**Laporan Mingguan Nursery (7 Hari Terakhir)**\n\n`;
    msg += `Dalam periode ini tercatat **${recent.length} transaksi** dengan penerimaan **${fmt(masuk)} bibit**, distribusi **${fmt(keluar)} bibit**, dan kehilangan **${fmt(mati)} bibit**.\n\n`;

    if (masuk > 0) {
      msg += `Efisiensi distribusi minggu ini: **${efisiensiMinggu}%** dari total penerimaan berhasil disalurkan ke lapangan. `;
      msg += `Tingkat kehilangan: **${rateMingguan.toFixed(1)}%** — tergolong **${labelMortalitas(rateMingguan)}**`;
      if (rateMingguan >= 5) {
        msg += ` — angka ini melampaui ambang normal dan perlu mendapat perhatian.`;
      } else {
        msg += `, masih dalam rentang yang dapat diterima.`;
      }
    }
    return msg;
  }

  return (
    'Pilih jenis laporan yang ingin dihasilkan:\n\n' +
    '• Ketik **"laporan stok"** — kondisi stok seluruh jenis bibit saat ini\n' +
    '• Ketik **"laporan distribusi"** — rekap pengiriman bibit ke semua lokasi\n' +
    '• Ketik **"laporan kematian"** — analisis kehilangan bibit per jenis\n' +
    '• Ketik **"laporan mingguan"** — ringkasan aktivitas 7 hari terakhir'
  );
}
