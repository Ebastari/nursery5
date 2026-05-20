// === Types ===
export type Row = {
  tanggal: string;
  bulan: string;
  bibit: string;
  masuk: number;
  keluar: number;
  mati: number;
  total: number;
  sumber: string;
  tujuan: string;
  statusKirim: string;
};

export type ApiResponse = {
  data: Row[];
  count: number;
  timestamp: string;
};

// === API ===
const API_URL =
  "https://script.google.com/macros/s/AKfycbzaDhpB0PQK2P1IgvglL7pw_1hDgVRzrF6rOiyuNvyrRsi6mp8fMsJCBk5Dj58IMWE/exec";

export async function fetchData(): Promise<Row[]> {
  // Google Apps Script redirects (302) — fetch must follow redirects
  const res = await fetch(API_URL, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

  const text = await res.text();

  // Detect HTML error pages (e.g. "Script function not found: doGet")
  if (text.trimStart().startsWith("<")) {
    throw new Error("Apps Script belum di-deploy ulang. Buka Apps Script → Deploy → New deployment.");
  }

  let json: ApiResponse;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Response bukan JSON: " + text.substring(0, 200));
  }

  if (!json.data || !Array.isArray(json.data)) {
    throw new Error("Format response tidak sesuai: " + text.substring(0, 200));
  }

  return json.data;
}

// === Colors (auto-assigned for up to 12 bibit types) ===
const palette = [
  "#3b82f6", "#10b981", "#a855f7", "#f59e0b", "#ef4444", "#06b6d4",
  "#ec4899", "#84cc16", "#f97316", "#6366f1", "#14b8a6", "#e11d48",
];

export function getBibitColor(index: number): string {
  return palette[index % palette.length];
}

// === Helpers ===
export function uniqueBibit(rows: Row[]): string[] {
  // Hanya bibit yang diizinkan
  const allowed = [
    "SENGON POTTING",
    "NANGKA",
    "AKASIA",
    "MALAPARI",
    "KALIANDRA MERAH",
    "KALIANDRA PUTIH"
  ];
  return allowed.filter((b) => rows.some((r) => r.bibit === b));
}

export function uniqueTujuan(rows: Row[]): string[] {
  return ["Semua", ...[...new Set(rows.map((r) => r.tujuan).filter(Boolean))].sort()];
}

export function uniqueBulan(rows: Row[]): string[] {
  return ["Semua", ...[...new Set(rows.map((r) => r.bulan).filter(Boolean))]];
}

export function filterRows(
  rows: Row[],
  filters: { tujuan: string; bulan: string; bibit: string }
): Row[] {
  // Filter hanya bibit yang diizinkan
  const allowed = [
    "SENGON POTTING",
    "NANGKA",
    "AKASIA",
    "MALAPARI",
    "KALIANDRA MERAH",
    "KALIANDRA PUTIH"
  ];
  return rows.filter((r) => {
    if (!allowed.includes(r.bibit)) return false;
    if (filters.tujuan !== "Semua" && r.tujuan !== filters.tujuan) return false;
    if (filters.bulan !== "Semua" && r.bulan !== filters.bulan) return false;
    if (filters.bibit !== "Semua" && r.bibit !== filters.bibit) return false;
    return true;
  });
}

export type Summary = {
  totalMasuk: number;
  totalKeluar: number;
  totalMati: number;
  stokAkhir: number;
};

export function getSummary(rows: Row[]): Summary {
  // Hanya bibit yang diizinkan
  const allowed = [
    "SENGON POTTING",
    "NANGKA",
    "AKASIA",
    "MALAPARI",
    "KALIANDRA MERAH",
    "KALIANDRA PUTIH"
  ];
  let totalMasuk = 0, totalKeluar = 0, totalMati = 0;
  for (const r of rows) {
    if (!allowed.includes(r.bibit)) continue;
    totalMasuk += r.masuk;
    totalKeluar += r.keluar;
    totalMati += r.mati;
  }
  return {
    totalMasuk,
    totalKeluar,
    totalMati,
    stokAkhir: totalMasuk - totalKeluar - totalMati,
  };
}

// Aggregate keluar per date, broken down by bibit type
export type DailyChart = { tanggal: string; total: number; [bibit: string]: string | number };

export function getDailyData(rows: Row[], bibitTypes: string[]): DailyChart[] {
  const map = new Map<string, DailyChart>();
  // Hanya bibit yang diizinkan
  const allowed = [
    "SENGON POTTING",
    "NANGKA",
    "AKASIA",
    "MALAPARI",
    "KALIANDRA MERAH",
    "KALIANDRA PUTIH"
  ];
  for (const r of rows) {
    if (!r.tanggal) continue;
    if (!allowed.includes(r.bibit)) continue;
    if (!map.has(r.tanggal)) {
      const entry: DailyChart = { tanggal: r.tanggal, total: 0 };
      for (const b of bibitTypes) entry[b] = 0;
      map.set(r.tanggal, entry);
    }
    const entry = map.get(r.tanggal)!;
    entry.total += r.keluar;
    if (r.bibit && bibitTypes.includes(r.bibit)) {
      (entry[r.bibit] as number) += r.keluar;
    }
  }
  return [...map.values()].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
}

// Rekap stok per bibit
export type BibitRekap = { bibit: string; masuk: number; keluar: number; mati: number; stok: number };

export function getRekapPerBibit(rows: Row[]): BibitRekap[] {
  // Hanya bibit yang diizinkan
  const allowed = [
    "SENGON POTTING",
    "NANGKA",
    "AKASIA",
    "MALAPARI",
    "KALIANDRA MERAH",
    "KALIANDRA PUTIH"
  ];
  const map = new Map<string, BibitRekap>();
  for (const b of allowed) {
    map.set(b, { bibit: b, masuk: 0, keluar: 0, mati: 0, stok: 0 });
  }
  for (const r of rows) {
    if (!r.bibit) continue;
    if (!allowed.includes(r.bibit)) continue;
    const entry = map.get(r.bibit)!;
    entry.masuk += r.masuk;
    entry.keluar += r.keluar;
    entry.mati += r.mati;
  }
  for (const entry of map.values()) {
    entry.stok = Math.max(0, entry.masuk - entry.keluar - entry.mati);
  }
  // Tampilkan semua bibit di allowed, meski stok 0, asalkan ada transaksi masuk/keluar
  return [...map.values()].filter(e => e.masuk > 0 || e.keluar > 0 || e.mati > 0).sort((a, b) => a.bibit.localeCompare(b.bibit));
}
