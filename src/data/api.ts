// Kirim data aktivitas ke Google Spreadsheet (Apps Script)
export interface SubmitActivityPayload {
  tanggal: string;
  bibit: string;
  masuk: number;
  keluar: number;
  mati: number;
  sumber: string;
  tujuan: string;
  dibuatOleh?: string;
  driver?: string;
}

export interface SubmitActivityResponse {
  success: boolean;
  message?: string;
  error?: string;
  nomorSurat?: string;
  linkPdf?: string;
}

export async function submitActivity(record: SubmitActivityPayload): Promise<SubmitActivityResponse> {
  const isDev = import.meta.env && import.meta.env.DEV;
  const url = isDev ? 'http://localhost:3001/api/proxy' : API_URL;
  // Apps Script expects snake_case for beberapa field
  const payload = {
    tanggal: record.tanggal,
    bibit: record.bibit,
    masuk: record.masuk || 0,
    keluar: record.keluar || 0,
    mati: record.mati || 0,
    sumber: record.sumber || '',
    tujuan: record.tujuan || '',
    dibuat_oleh: record.dibuatOleh || '',
    driver: record.driver || '',
  };
  // text/plain avoids CORS preflight — GAS cannot respond to OPTIONS requests
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Gagal menyimpan data');
  return json;
}
// === Live API — Google Apps Script ===

import { saveRowsToDB, getRowsFromDB } from './indexedDb';

export interface ApiRow {
  tanggal: string;
  bulan: string;
  bibit: string;
  masuk: number;
  keluar: number;
  mati: number;
  total: number;
  sumber: string;
  tujuan: string;
  nomorSurat?: string;
  statusApproval?: string;
  approvedBy?: string;
  approvedAt?: string;
  statusKirim: string;
  kodeVerifikasi?: string;
  linkPdf?: string;
  dibuatOleh?: string;
  driver?: string;
}

interface ApiResponse {
  data: ApiRow[];
  count: number;
  timestamp: string;
}

export interface DropdownOptions {
  dibuatOleh: string[];
  driver: string[];
}


export const API_URL =
  "https://script.google.com/macros/s/AKfycbz1ihQ483EsmV-f7foHSVe5EJrxQ-l4_pC4tjUM5Ah27uaCc5oiecKupH450_LlvWwc/exec";

let cachedRows: ApiRow[] | null = null;

export interface ApprovalResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function approveDocument(nomorSurat: string, approvedBy: string): Promise<ApprovalResponse> {
  const approvedAt = new Date().toISOString();
  const payload = {
    action: "approve",
    nomorSurat,
    approvedBy,
    approvedAt,
    status: "approved" as const
  };

  const isDev = import.meta.env.DEV;
  const url = isDev 
    ? "http://localhost:3001/api/proxy"
    : API_URL;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Approval failed: ${res.status} ${errorText}`);
  }

  const text = await res.text();
  if (text.trimStart().startsWith("<")) {
    throw new Error("Apps Script proxy error");
  }

  const data: ApprovalResponse = JSON.parse(text);
  if (!data.success) {
    throw new Error(data.error || "Approval failed");
  }

  clearCache();
  return data;
}


// Pola cache-then-network: tampilkan data dari IndexedDB dulu, lalu update dari API jika online
export async function fetchApiData(): Promise<ApiRow[]> {
  const cacheBust = Date.now().toString();
  const apiUrl = `${API_URL}?t=${cacheBust}`;
  
  // 1. Ambil dari cache memory jika ada
  if (cachedRows) return cachedRows;

  // 2. Ambil dari IndexedDB (cache lokal)
  const offlineRows = await getRowsFromDB();
  if (offlineRows.length > 0) {
    cachedRows = offlineRows;
    // Fetch ke API di background untuk update data
    if (navigator.onLine) {
      fetch(apiUrl, { redirect: "follow" })
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const text = await res.text();
          if (text.trimStart().startsWith("<")) throw new Error("Apps Script error — bukan JSON");
          const json: ApiResponse = JSON.parse(text);
          if (!json.data || !Array.isArray(json.data)) throw new Error("Format response tidak sesuai");
          // Jika data baru berbeda, update cache dan IndexedDB
          if (JSON.stringify(json.data) !== JSON.stringify(offlineRows)) {
            cachedRows = json.data;
            try { await saveRowsToDB(json.data); } catch { /* ignore */ }
          }
        })
        .catch(() => {}); // error background fetch diabaikan
    }
    return offlineRows;
  }

  // 3. Jika cache kosong, fetch ke API (pertama kali atau cache hilang)
  if (navigator.onLine) {
    const res = await fetch(apiUrl, { redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text.trimStart().startsWith("<")) throw new Error("Apps Script error — bukan JSON");
    const json: ApiResponse = JSON.parse(text);
    if (!json.data || !Array.isArray(json.data)) throw new Error("Format response tidak sesuai");
    cachedRows = json.data;
    try { await saveRowsToDB(json.data); } catch { /* ignore */ }
    return cachedRows;
  }

  // 4. Jika offline dan cache kosong
  throw new Error("Tidak ada koneksi internet dan tidak ada data tersimpan.");
}

export function invalidateCache() {
  cachedRows = null;
  cachedDropdowns = null;
}

let cachedDropdowns: DropdownOptions | null = null;

export async function fetchDropdowns(): Promise<DropdownOptions> {
  if (cachedDropdowns) return cachedDropdowns;
  try {
    const res = await fetch(`${API_URL}?action=dropdowns`, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: DropdownOptions = await res.json();
    cachedDropdowns = json;
    return json;
  } catch {
    return { dibuatOleh: [], driver: [] };
  }
}

export function clearCache() {
  cachedRows = null;
}

export interface VerifyResult {
  valid: boolean;
  tanggal?: string;
  bibit?: string;
  masuk?: number;
  keluar?: number;
  mati?: number;
  sumber?: string;
  tujuan?: string;
  kodeVerifikasi?: string;
  error?: string;
}

export async function verifyCode(code: string): Promise<VerifyResult> {
  const res = await fetch(`${API_URL}?verify=${encodeURIComponent(code)}`, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (text.trimStart().startsWith('<')) {
    throw new Error('Apps Script error — bukan JSON');
  }
  return JSON.parse(text);
}
