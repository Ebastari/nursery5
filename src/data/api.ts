import { saveRowsToDB, getRowsFromDB } from './indexedDb';

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
  kodeVerifikasi?: string;
  linkPdf?: string;
}

export async function submitActivity(record: SubmitActivityPayload): Promise<SubmitActivityResponse> {
  const url = import.meta.env.DEV ? '/api/gas' : API_URL;
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
  statusTerima?: string;
  namaPenerima?: string;
  tanggalTerima?: string;
  jumlahDiterima?: number;
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
  "https://script.google.com/macros/s/AKfycbygs7jwtJElftn0F6ZZbGXU3Zhv0ncD4C2wwit_7AM1qZOhIaXBwOtM7gNp-_dRMwyI/exec";

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

  const url = import.meta.env.DEV ? '/api/gas' : API_URL;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
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

// Selalu ambil dari network (untuk refreshAll agar statusKirim selalu terkini)
export async function fetchFreshFromNetwork(): Promise<ApiRow[]> {
  if (!navigator.onLine) return fetchApiData();
  const apiUrl = `${API_URL}?t=${Date.now()}`;
  const res = await fetch(apiUrl, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (text.trimStart().startsWith('<')) throw new Error('Apps Script error — bukan JSON');
  const json: ApiResponse = JSON.parse(text);
  if (!json.data || !Array.isArray(json.data)) throw new Error('Format response tidak sesuai');
  cachedRows = json.data;
  try { await saveRowsToDB(json.data); } catch { /* ignore */ }
  return cachedRows;
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

export async function uploadPdfToDrive(
  blob: Blob,
  filename: string,
  nomorSurat: string,
): Promise<string> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const url = import.meta.env.DEV ? '/api/gas' : API_URL;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'savePdf', pdfData: base64, filename, nomorSurat }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (text.trimStart().startsWith('<')) throw new Error('Apps Script error');
  const json = JSON.parse(text);
  if (!json.success) throw new Error(json.error || 'Upload gagal');
  return json.link as string;
}

export interface ConfirmDeliveryPayload {
  kodeVerifikasi: string;
  namaPenerima: string;
  jumlahDiterima: number;
}

export interface ConfirmDeliveryResponse {
  success: boolean;
  message?: string;
  error?: string;
  tanggalTerima?: string;
}

export async function confirmDelivery(payload: ConfirmDeliveryPayload): Promise<ConfirmDeliveryResponse> {
  const body = { action: 'confirmDelivery', ...payload };
  const proxyUrl = import.meta.env.DEV ? '/api/gas' : API_URL;
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (text.trimStart().startsWith('<')) throw new Error('Apps Script error — bukan JSON');
  const data: ConfirmDeliveryResponse = JSON.parse(text);
  if (!data.success) throw new Error(data.error || 'Konfirmasi gagal');
  invalidateCache();
  return data;
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

// ── AUTH ──────────────────────────────────────────────────────

function getAuthUrl() {
  return import.meta.env.DEV ? '/api/gas' : API_URL;
}

async function authPost<T>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(getAuthUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (text.trimStart().startsWith('<')) throw new Error('Apps Script error — bukan JSON');
  return JSON.parse(text);
}

export interface RequestOtpResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function requestOtp(nomorHp: string): Promise<RequestOtpResponse> {
  return authPost({ action: 'requestOtp', nomorHp });
}

export interface AuthUser {
  nomorHp: string;
  nama: string;
  role: 'admin' | 'user';
}

export interface RegisterResponse {
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
}

export async function registerUser(
  nomorHp: string,
  nama: string,
  password: string,
  inviteCode: string,
): Promise<RegisterResponse> {
  return authPost({ action: 'register', nomorHp, nama, password, inviteCode });
}

export interface LoginResponse {
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
}

export async function loginUser(nomorHp: string, password: string): Promise<LoginResponse> {
  return authPost({ action: 'login', nomorHp, password });
}

export interface ResetPasswordResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function resetPassword(
  nomorHp: string,
  otp: string,
  newPassword: string,
): Promise<ResetPasswordResponse> {
  return authPost({ action: 'resetPassword', nomorHp, otp, newPassword });
}

export async function changePassword(
  nomorHp: string,
  oldPassword: string,
  newPassword: string,
): Promise<ResetPasswordResponse> {
  return authPost({ action: 'changePassword', nomorHp, oldPassword, newPassword });
}

// ── INVITE CODES ──────────────────────────────────────────────

export interface InviteCode {
  code: string;
  keterangan: string;
  createdAt: string;
  isUsed: boolean;
  usedBy?: string;
  usedAt?: string;
}

export interface InviteCodesResponse {
  success: boolean;
  codes?: InviteCode[];
  error?: string;
}

export interface CreateInviteCodeResponse {
  success: boolean;
  code?: string;
  error?: string;
}

export async function getInviteCodes(): Promise<InviteCodesResponse> {
  const url = `${API_URL}?action=listInviteCodes`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (text.trimStart().startsWith('<')) throw new Error('Apps Script error — bukan JSON');
  return JSON.parse(text);
}

export async function createInviteCode(keterangan: string): Promise<CreateInviteCodeResponse> {
  return authPost({ action: 'createInviteCode', keterangan });
}

export async function deleteInviteCode(code: string): Promise<ResetPasswordResponse> {
  return authPost({ action: 'deleteInviteCode', code });
}

export interface UserRecord {
  nomorHp: string;
  nama: string;
  createdAt: string;
  status: 'active' | 'inactive';
  role: 'admin' | 'user';
}

export interface GetUsersResponse {
  success: boolean;
  users?: UserRecord[];
  error?: string;
}

export async function getUsers(): Promise<GetUsersResponse> {
  const url = `${API_URL}?action=users`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (text.trimStart().startsWith('<')) throw new Error('Apps Script error — bukan JSON');
  return JSON.parse(text);
}

export async function setUserRole(nomorHp: string, role: 'admin' | 'user'): Promise<ResetPasswordResponse> {
  return authPost({ action: 'setUserRole', nomorHp, role });
}

export async function toggleUserStatus(nomorHp: string): Promise<ResetPasswordResponse & { status?: string }> {
  return authPost({ action: 'toggleUserStatus', nomorHp });
}
