/**
 * Canonical Surat Jalan PDF Generator
 * Single source of truth for all PDF generation across the app.
 * Design aligned with generateDistributionPdf.ts for visual consistency.
 */
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

// ── Constants ──────────────────────────────────────────────────────────────────
const COMPANY_NAME_DEFAULT = 'PT Energi Batubara Lestari';
const COMPANY_UNIT_DEFAULT = 'Unit Nursery';
const COMPANY_ADDRESS_DEFAULT = 'Kalimantan Selatan';
const APPROVER_TITLE_DEFAULT = 'Dept Head Revegetasi & Rehabilitasi';
const GREEN: [number, number, number] = [5, 150, 105];
const LIGHT_BLUE: [number, number, number] = [239, 246, 255];
const BLUE_BORDER: [number, number, number] = [191, 219, 254];
const GRAY_900: [number, number, number] = [17, 24, 39];
const GRAY_500: [number, number, number] = [107, 114, 128];
const GRAY_400: [number, number, number] = [156, 163, 175];
const EMERALD_700: [number, number, number] = [17, 94, 89];
const BLUE_800: [number, number, number] = [30, 58, 138];
const BLUE_600: [number, number, number] = [37, 99, 235];

// ── Canonical Data Interface ───────────────────────────────────────────────────
export interface SuratJalanPdfData {
  /** No. dokumen: SJ-BIBIT/XXXX/BULAN/TAHUN */
  nomorSurat: string;
  /** Tanggal formatted: "01 Januari 2026" */
  tanggal: string;
  /** Nama jenis bibit */
  jenisBibit: string;
  /** Jumlah bibit yang dikirim */
  jumlah: number;
  /** Satuan, default "polybag" */
  satuan?: string;
  /** Lokasi asal bibit */
  sumber?: string;
  /** Lokasi tujuan distribusi */
  tujuan: string;
  /** Stok tersisa setelah distribusi */
  sisaStok: number;
  /** Nama petugas pembuat surat */
  dibuatOleh: string;
  /** Jabatan pembuat, default "Petugas Nursery" */
  dibuatOlehJabatan?: string;
  /** Nama penyetuju (opsional) */
  disetujuiOleh?: string;
  /** Jabatan penyetuju, default APPROVER_TITLE_DEFAULT */
  disetujuiOlehJabatan?: string;
  /** Nama driver / pengantar */
  driver: string;
  /** Jabatan driver, default "Sopir / Kurir" */
  driverJabatan?: string;
  /** Kode verifikasi singkat untuk QR — isi dengan 8-char code */
  kodeVerifikasi: string;
  /** Logo perusahaan sebagai data URL (opsional) */
  logoDataUrl?: string;
  /** Watermark DRAFT (default false) */
  isDraft?: boolean;
  companyName?: string;
  companyUnit?: string;
  companyAddress?: string;
  /** Bukti penerimaan — diisi setelah konfirmasi lapangan */
  namaPenerima?: string;
  tanggalTerima?: string;
  jumlahDiterima?: number;
}

// ── Main generator ─────────────────────────────────────────────────────────────
export async function generateSuratJalanPdf(data: SuratJalanPdfData): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentW = pageW - margin * 2;

  // Resolve defaults
  const satuan = data.satuan ?? 'polybag';
  const companyName = data.companyName ?? COMPANY_NAME_DEFAULT;
  const companyUnit = data.companyUnit ?? COMPANY_UNIT_DEFAULT;
  const companyAddress = data.companyAddress ?? COMPANY_ADDRESS_DEFAULT;
  const dibuatOlehJabatan = data.dibuatOlehJabatan ?? 'Petugas Nursery';
  const disetujuiOleh = data.disetujuiOleh ?? '';
  const disetujuiOlehJabatan = data.disetujuiOlehJabatan ?? APPROVER_TITLE_DEFAULT;
  const driverJabatan = data.driverJabatan ?? 'Sopir / Kurir';

  doc.setFont('helvetica', 'normal');
  let y = 16;

  // ── Header: Logo + Company Info ──
  if (data.logoDataUrl) {
    doc.addImage(data.logoDataUrl, 'PNG', margin, y, 14, 14);
  }
  const textX = margin + (data.logoDataUrl ? 18 : 0);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GRAY_900);
  doc.text(companyName, textX, y + 5);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY_500);
  doc.text(`${companyUnit} — ${companyAddress}`, textX, y + 11);
  y += 20;

  // ── Emerald separator ──
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 9;

  // ── Document title ──
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GREEN);
  doc.text('SURAT JALAN DISTRIBUSI BIBIT', pageW / 2, y, { align: 'center' });
  y += 6.5;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(`No: ${data.nomorSurat}`, pageW / 2, y, { align: 'center' });
  y += 13;

  // ── Info section ──
  const infoLabelX = margin;
  const infoColonX = margin + 38;
  const infoValX = margin + 40;

  const infoRows: [string, string][] = [
    ['Tanggal', data.tanggal],
    ['Jenis Bibit', data.jenisBibit],
    ['Jumlah', `${data.jumlah.toLocaleString('id-ID')} ${satuan}`],
    ...(data.sumber ? [['Asal / Sumber', data.sumber] as [string, string]] : []),
    ['Tujuan / Lokasi', data.tujuan],
  ];

  doc.setFontSize(9.5);
  doc.setTextColor(40, 40, 40);
  for (const [label, value] of infoRows) {
    doc.setFont('helvetica', 'bold');
    doc.text(label, infoLabelX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(':', infoColonX, y);
    doc.text(value, infoValX, y);
    y += 5.5;
  }
  y += 5;

  // ── Table ──
  const colWidths = [11, contentW * 0.38, contentW * 0.22, contentW * 0.4 - 11];
  const colX = [margin];
  for (let i = 1; i < colWidths.length; i++) colX.push(colX[i - 1] + colWidths[i - 1]);
  const headerH = 9;
  const rowH = 11;

  // Table header
  doc.setFillColor(...GREEN);
  doc.roundedRect(margin, y, contentW, headerH, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  ['No', 'Jenis Bibit', 'Jumlah', 'Satuan / Keterangan'].forEach((h, i) => {
    doc.text(h, colX[i] + 2, y + 6.2);
  });
  y += headerH;

  // Table data row
  doc.setFillColor(255, 255, 255);
  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'normal');
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentW, rowH, 2, 2, 'FD');

  const cells = ['1', data.jenisBibit, data.jumlah.toLocaleString('id-ID'), satuan];
  cells.forEach((cell, i) => {
    if (i === 2) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GREEN);
      doc.text(cell, colX[i] + colWidths[i] - 3, y + 7.5, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
    } else {
      doc.text(cell, colX[i] + 2, y + 7.5);
    }
  });
  y += rowH + 7;

  // ── Sisa stok info box ──
  const boxH = 14;
  doc.setFillColor(...LIGHT_BLUE);
  doc.roundedRect(margin, y, contentW, boxH, 1.5, 1.5, 'F');
  doc.setDrawColor(...BLUE_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentW, boxH, 1.5, 1.5, 'S');
  doc.setFontSize(8.5);
  doc.setTextColor(...BLUE_800);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Sisa stok ${data.jenisBibit.toUpperCase()} setelah distribusi ini:`,
    margin + 4,
    y + 5.5
  );
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLUE_600);
  doc.text(
    `${data.sisaStok.toLocaleString('id-ID')} ${satuan}`,
    margin + 4,
    y + 10.5
  );
  y += boxH + 9;

  // ── Catatan ──
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text(
    'Catatan: Pastikan bibit dalam kondisi baik saat penyerahan. Surat jalan ini merupakan bukti distribusi resmi.',
    margin,
    y,
    { maxWidth: contentW }
  );
  y += 11;

  // ── Signature section ──
  const sigW = contentW / 3;
  const sigLabels = ['Dibuat oleh', 'Disetujui', 'Driver'];
  const sigNames = [data.dibuatOleh, disetujuiOleh, data.driver];
  const sigRoles = [dibuatOlehJabatan, disetujuiOlehJabatan, driverJabatan];

  // Labels row
  doc.setFontSize(9.5);
  for (let i = 0; i < 3; i++) {
    const cx = margin + sigW * i + sigW / 2;
    doc.setFont('helvetica', i === 1 ? 'bold' : 'normal');
    doc.setTextColor(55, 65, 81);
    doc.text(sigLabels[i], cx, y, { align: 'center' });
  }
  y += 9;

  // Signature lines with verification circles
  for (let i = 0; i < 3; i++) {
    const cx = margin + sigW * i + sigW / 2;
    doc.setDrawColor(...GRAY_400);
    doc.setLineWidth(0.5);
    doc.line(cx - 17, y, cx + 17, y);
    doc.setFillColor(...GREEN);
    doc.circle(cx, y - 3.5, 3.5, 'F');
    // Draw checkmark with lines — helvetica tidak support karakter ✓
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.7);
    doc.line(cx - 1.4, y - 3.5, cx - 0.3, y - 2.3);
    doc.line(cx - 0.3, y - 2.3, cx + 1.7, y - 4.9);
  }
  y += 11;

  // Names and roles
  doc.setFontSize(8.5);
  for (let i = 0; i < 3; i++) {
    const cx = margin + sigW * i + sigW / 2;
    if (sigNames[i]) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...EMERALD_700);
      doc.text(sigNames[i], cx, y + 2, { align: 'center' });
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY_400);
    doc.text(sigRoles[i], cx, y + 7, { align: 'center' });
  }
  y += 15;

  // ── Separator ──
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  // ── QR Code (30mm, medium error correction for scan reliability) ──
  const qrSize = 30;
  const qrContent = `VERIFY:${data.kodeVerifikasi}`;
  const qrDataUrl = await QRCode.toDataURL(qrContent, {
    width: qrSize * 5,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
  // ── Bukti Penerimaan (jika sudah dikonfirmasi) ──
  if (data.namaPenerima && data.tanggalTerima) {
    const TEAL: [number, number, number] = [13, 148, 136];
    doc.setFillColor(...TEAL);
    doc.roundedRect(margin, y, contentW, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('BUKTI PENERIMAAN', margin + contentW / 2, y + 5.5, { align: 'center' });
    y += 11;

    doc.setFillColor(240, 253, 250);
    doc.setDrawColor(...TEAL);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentW, 20, 2, 2, 'FD');

    doc.setTextColor(40, 40, 40);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    const col2 = margin + contentW / 2;
    doc.text('Nama Penerima', margin + 4, y + 6);
    doc.text(':', col2 - 10, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.text(data.namaPenerima, col2 - 6, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.text('Tanggal Terima', margin + 4, y + 12);
    doc.text(':', col2 - 10, y + 12);
    doc.setFont('helvetica', 'bold');
    const tgl = data.tanggalTerima
      ? new Date(data.tanggalTerima).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
      : data.tanggalTerima;
    doc.text(tgl, col2 - 6, y + 12);

    doc.setFont('helvetica', 'normal');
    doc.text('Jumlah Diterima', margin + 4, y + 18);
    doc.text(':', col2 - 10, y + 18);
    doc.setFont('helvetica', 'bold');
    doc.text(`${(data.jumlahDiterima ?? 0).toLocaleString('id-ID')} polybag`, col2 - 6, y + 18);

    y += 24;
  }

  doc.addImage(qrDataUrl, 'PNG', margin, y, qrSize, qrSize);

  const qrTextX = margin + qrSize + 6;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Scan QR Code untuk Verifikasi', qrTextX, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('Verifikasi keaslian dokumen melalui fitur', qrTextX, y + 12);
  doc.text('Scanner di aplikasi Smart Nursery.', qrTextX, y + 17);
  if (data.kodeVerifikasi && data.kodeVerifikasi !== 'PREVIEW') {
    doc.setFontSize(7.5);
    doc.setFont('courier', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Kode: ${data.kodeVerifikasi}`, qrTextX, y + 23);
  }
  y = Math.max(y + qrSize, y + 30);
  y += 8;

  if (y > pageH - 18) y = pageH - 18;

  // ── Footer ──
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(140, 140, 140);
  doc.text('Dicetak otomatis oleh Montana AI Engine — Smart Nursery System', margin, y);
  doc.text(`${companyName} — ${companyUnit}`, margin, y + 4);

  // Final status badge (bottom right)
  const badgeW = 68;
  const badgeH = 9;
  doc.setFillColor(...GREEN);
  doc.roundedRect(pageW - margin - badgeW, y, badgeW, badgeH, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(
    data.isDraft ? 'DOKUMEN DRAFT' : data.namaPenerima ? 'Terkirim & Diterima — Dokumen Selesai' : 'Dokumen Resmi — Siap Distribusi',
    pageW - margin - badgeW + badgeW / 2,
    y + 5.8,
    { align: 'center' }
  );

  // ── Draft watermark ──
  if (data.isDraft) {
    doc.saveGraphicsState();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gState = (doc as any).GState({ opacity: 0.07 });
    doc.setGState(gState);
    doc.setFontSize(110);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text('DRAFT', pageW / 2, pageH / 2, { align: 'center', angle: 45 });
    doc.restoreGraphicsState();
  }

  return doc.output('blob');
}

// ── Convenience download helper ────────────────────────────────────────────────
export async function downloadSuratJalanPdf(
  data: SuratJalanPdfData,
  filename?: string
): Promise<void> {
  const blob = await generateSuratJalanPdf(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename ?? `Surat-Jalan-${data.nomorSurat.replace(/\//g, '-')}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
