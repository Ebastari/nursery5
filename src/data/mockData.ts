import type { PlantStock, ActivityRecord, Shipment, Document, Alert } from './types';
import { fetchApiData, API_URL } from './api';
import type { ApiRow } from './api';

// === Derive PlantStock from live API rows ===
export function derivePlants(rows: ApiRow[]): PlantStock[] {
  const map = new Map<string, { masuk: number; keluar: number; mati: number; lastDate: string }>();

  for (const r of rows) {
    const key = r.bibit.toUpperCase();
    if (!key) continue;
    const entry = map.get(key) ?? { masuk: 0, keluar: 0, mati: 0, lastDate: '' };
    entry.masuk += r.masuk;
    entry.keluar += r.keluar;
    entry.mati += r.mati;
    if (r.tanggal > entry.lastDate) entry.lastDate = r.tanggal;
    map.set(key, entry);
  }

  return [...map.entries()].map(([name, d], i) => {
    const stock = Math.max(0, d.masuk - d.keluar - d.mati);
    const maxStock = Math.max(d.masuk, stock + 500);
    const mortalityRate = d.masuk > 0 ? (d.mati / d.masuk) * 100 : 0;
    const healthScore = Math.max(0, Math.min(100, Math.round(100 - mortalityRate * 5)));
    return {
      id: String(i + 1),
      name,
      stock,
      maxStock,
      healthScore,
      mortalityRate: Math.round(mortalityRate * 10) / 10,
      totalMati: d.mati,
      totalMasuk: d.masuk,
      lastUpdated: d.lastDate || new Date().toISOString().split('T')[0],
    };
  }).sort((a, b) => b.stock - a.stock);
}

// === Derive ActivityRecord from live API rows ===
export function deriveActivities(rows: ApiRow[]): ActivityRecord[] {
  return rows.map((r, i) => ({
    id: String(i + 1),
    tanggal: r.tanggal,
    bibit: r.bibit,
    masuk: r.masuk,
    keluar: r.keluar,
    mati: r.mati,
    sumber: r.sumber,
    tujuan: r.tujuan,
  }));
}

// === Derive Shipments from live rows where keluar > 0 ===
export function deriveShipments(rows: ApiRow[]): Shipment[] {
  return rows
    .filter((r) => r.keluar > 0)
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
    .slice(0, 50)
    .map((r, i) => ({
      id: `SHP-${String(i + 1).padStart(3, '0')}`,
      tanggal: r.tanggal,
      bibit: r.bibit,
      jumlah: r.keluar,
      tujuan: r.tujuan || '-',
      status: r.statusKirim.includes('Terkirim') ? 'diterima' as const : 'dikirim' as const,
      sopir: '-',
      nopol: '-',
    }));
}

// === Derive Alerts dynamically from stock levels ===
export function deriveAlerts(plants: PlantStock[], rows: ApiRow[]): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date().toISOString();
  let id = 1;

  for (const p of plants) {
    if (p.stock <= 0) {
      alerts.push({ id: String(id++), type: 'low-stock', message: `Stok ${p.name} habis (0 bibit)`, severity: 'high', timestamp: now, read: false });
    } else if (p.stock < 500) {
      alerts.push({ id: String(id++), type: 'low-stock', message: `Stok ${p.name} sangat rendah (${p.stock.toLocaleString('id-ID')} bibit)`, severity: 'high', timestamp: now, read: false });
    } else if (p.stock < 1000) {
      alerts.push({ id: String(id++), type: 'low-stock', message: `Stok ${p.name} menipis (${p.stock.toLocaleString('id-ID')} bibit)`, severity: 'medium', timestamp: now, read: false });
    }
    if (p.mortalityRate >= 25) {
      alerts.push({ id: String(id++), type: 'mortality', message: `Mortalitas ${p.name} tinggi (kematian ${p.mortalityRate}%)`, severity: 'high', timestamp: now, read: false });
    }
  }

  // Recent mortality
  const recent = rows.filter((r) => r.mati > 50);
  for (const r of recent) {
    alerts.push({ id: String(id++), type: 'mortality', message: `Kematian ${r.bibit} tinggi pada ${r.tanggal} (${r.mati} bibit)`, severity: 'medium', timestamp: now, read: true });
  }

  return alerts.sort((a, b) => {
    const sev = { high: 0, medium: 1, low: 2 };
    return sev[a.severity] - sev[b.severity];
  });
}

// === The unified API layer ===
export const api = {
  async getPlants(): Promise<PlantStock[]> {
    const rows = await fetchApiData();
    return derivePlants(rows);
  },
  async getActivities(): Promise<ActivityRecord[]> {
    const rows = await fetchApiData();
    return deriveActivities(rows);
  },
  async getShipments(): Promise<Shipment[]> {
    const rows = await fetchApiData();
    return deriveShipments(rows);
  },
  async getDocuments(): Promise<Document[]> {
    // Dummy dokumen distribusi dengan pdfUrl valid
    return [
      {
        id: 'DOC-001',
        shipmentId: 'SHP-001',
        nomor: 'SJ/2026/04/001',
        tanggal: '2026-04-10',
        status: 'success',
        pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        ttdSopir: true,
      },
      {
        id: 'DOC-002',
        shipmentId: 'SHP-002',
        nomor: 'SJ/2026/04/002',
        tanggal: '2026-04-11',
        status: 'success',
        pdfUrl: 'https://www.africau.edu/images/default/sample.pdf',
        ttdSopir: true,
      },
      {
        id: 'DOC-003',
        shipmentId: 'SHP-003',
        nomor: 'SJ/2026/04/003',
        tanggal: '2026-04-11',
        status: 'success',
        pdfUrl: '#', // ini tidak akan tampil tombol PDF
        ttdSopir: true,
      },
    ];
  },
  async getAlerts(): Promise<Alert[]> {
    const rows = await fetchApiData();
    const plants = derivePlants(rows);
    return deriveAlerts(plants, rows);
  },
async submitActivity(record: Omit<ActivityRecord, 'id'>): Promise<ActivityRecord & { linkPdf?: string; nomorSurat?: string }> {
    // Prepare GAS payload - map fields + ensure tanggal
    const today = new Date().toISOString().split('T')[0];
    const gasPayload = {
      tanggal: record.tanggal || today,
      bibit: record.bibit,
      masuk: record.masuk || 0,
      keluar: record.keluar || 0,
      mati: record.mati || 0,
      sumber: record.sumber || '',
      tujuan: record.tujuan || '',
      dibuat_oleh: record.dibuatOleh || '',  // GAS expects snake_case
      driver: record.driver || '',
    };

    const submitUrl = import.meta.env.DEV ? '/api/gas' : API_URL;
    const res = await fetch(submitUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(gasPayload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Gagal menyimpan data');
    return {
      ...record,
      id: `ACT-${json.row || Date.now()}`,
      nomorSurat: json.nomorSurat || '',
      linkPdf: json.linkPdf || '',
    };
  },
  async generateDocument(shipmentId: string): Promise<Document> {
    // Generate dokumen dengan pdfUrl random
    const pdfSamples = [
      'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      'https://www.africau.edu/images/default/sample.pdf',
      'https://file-examples-com.github.io/uploads/2017/10/file-sample_150kB.pdf',
    ];
    const randomUrl = pdfSamples[Math.floor(Math.random() * pdfSamples.length)];
    return {
      id: `DOC-${Date.now()}`,
      shipmentId,
      nomor: `SJ/2026/04/${Math.floor(Math.random() * 999).toString().padStart(3, '0')}`,
      tanggal: new Date().toISOString().split('T')[0],
      status: 'success',
      pdfUrl: randomUrl,
    };
  },
};
