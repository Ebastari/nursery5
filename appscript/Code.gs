// ============================================================
//  MONTANA AI ENGINE — Google Apps Script
//  PT Energi Batubara Lestari, Unit Nursery
//  Versi: 2.0 — PDF premium, bug CORS diperbaiki, doGet tanpa setHeaders
// ============================================================

// ============================================================
//  KONFIGURASI GLOBAL
// ============================================================
const SHEET_NAME         = "Bibit";
const MASTER_SHEET_NAME  = "Master";
const FOLDER_SURAT_JALAN = "Surat Jalan Bibit";
const NOMOR_ADMIN        = "6281122220044";
const TOKEN_FONNTE       = "VDFAKtD3JhwNymAf6Sgz";

// Konfigurasi Approver (ubah di Script Properties jika perlu)
const DEFAULT_APPROVER_NAME     = "Mariano Alvarado Simamora";
const DEFAULT_APPROVER_JABATAN  = "Dept Head Revegetasi & Rehabilitasi";

// URL logo perusahaan (digunakan di PDF)
const LOGO_URL = "https://i.ibb.co.com/xSTT9wJK/download.png";

function getToken() {
  return PropertiesService.getScriptProperties().getProperty("TOKEN_FONNTE") || TOKEN_FONNTE;
}

function getApproverName() {
  return PropertiesService.getScriptProperties().getProperty("APPROVER_NAME") || DEFAULT_APPROVER_NAME;
}

function getApproverJabatan() {
  return PropertiesService.getScriptProperties().getProperty("APPROVER_JABATAN") || DEFAULT_APPROVER_JABATAN;
}


// ============================================================
//  UTILITY
// ============================================================

function safeGet(row, idx, fallback) {
  if (typeof idx === "undefined" || idx < 0) return (typeof fallback !== "undefined") ? fallback : "";
  if (!row || typeof row[idx] === "undefined") return (typeof fallback !== "undefined") ? fallback : "";
  return row[idx];
}

function safeNum(row, idx, fallback) {
  const val = safeGet(row, idx, fallback);
  const num = Number(val);
  return isNaN(num) ? (typeof fallback !== "undefined" ? fallback : 0) : num;
}

function buildHeaderMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  for (let i = 0; i < headers.length; i++) {
    const key = headers[i].toString().trim().toLowerCase()
      .replace(/ /g, "")
      .replace(/[^a-z0-9_]/g, "");
    map[key] = i;
  }
  if (map["dibuatoleh"] === undefined && map["dibuat_oleh"] !== undefined) {
    map["dibuatoleh"] = map["dibuat_oleh"];
  }
  if (map["nomorsurat"] === undefined && map["no"] !== undefined) {
    map["nomorsurat"] = map["no"];
  }
  return map;
}

function ensureColumns(sheet, colsNeeded) {
  let headerMap = buildHeaderMap(sheet);
  let totalCols = sheet.getLastColumn();
  for (const col of colsNeeded) {
    if (headerMap[col.mapKey] === undefined) {
      totalCols++;
      sheet.getRange(1, totalCols).setValue(col.name);
    }
  }
  return buildHeaderMap(sheet);
}

function generateVerificationCode(length) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < length; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function generateKode() { return generateVerificationCode(10); }

function buatQR(kode) {
  return "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(kode);
}

function generateNomorSurat(rowNum, tanggal) {
  const bulanRomawi = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
  let d = new Date(tanggal + "T00:00:00");
  if (isNaN(d.getTime())) d = new Date();
  const bulan = bulanRomawi[d.getMonth()] || "I";
  const tahun = d.getFullYear();
  const nomor = ("0000" + rowNum).slice(-4);
  return "SJ-BIBIT/" + nomor + "/" + bulan + "/" + tahun;
}

function generateNomorSuratFromSheet(sheet, row) {
  const tanggal = sheet.getRange(row, 3).getValue();
  if (!tanggal) return "";
  const date = new Date(tanggal);
  const bulanRomawi = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
  const bulan = bulanRomawi[date.getMonth()];
  const tahun = date.getFullYear();
  const lastRow = sheet.getLastRow();
  let count = 0;
  for (let i = 2; i <= lastRow; i++) {
    if (sheet.getRange(i, 13).getValue()) count++;
  }
  return `SJ-BIBIT/${String(count + 1).padStart(4, "0")}/${bulan}/${tahun}`;
}

function formatTanggalWITA(tanggalStr) {
  try {
    const d = new Date(tanggalStr + "T00:00:00");
    return Utilities.formatDate(d, "Asia/Makassar", "dd MMMM yyyy");
  } catch (e) { return tanggalStr; }
}

function getWitaNow() {
  return Utilities.formatDate(new Date(), "Asia/Makassar", "HH:mm 'WITA'");
}

function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
}

/** Fetch gambar dari URL → base64 data URI. Kembalikan "" jika gagal. */
function fetchImageBase64(url, mimeType) {
  try {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() !== 200) return "";
    const mime = mimeType || res.getBlob().getContentType() || "image/png";
    return "data:" + mime + ";base64," + Utilities.base64Encode(res.getBlob().getBytes());
  } catch (e) {
    Logger.log("[fetchImageBase64] Error: " + e);
    return "";
  }
}


// ============================================================
//  SHEET MASTER (Dropdown Dibuat Oleh & Driver)
// ============================================================

function initMasterSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let master = ss.getSheetByName(MASTER_SHEET_NAME);
  if (!master) {
    master = ss.insertSheet(MASTER_SHEET_NAME);
    master.getRange(1, 1).setValue("Dibuat Oleh");
    master.getRange(1, 2).setValue("Driver");
    master.getRange(2, 1).setValue("Admin Nursery");
    master.getRange(3, 1).setValue("Petugas Nursery");
    master.getRange(2, 2).setValue("Sopir 1");
    master.getRange(3, 2).setValue("Sopir 2");
    master.autoResizeColumns(1, 2);
  }
  return master;
}

/**
 * Ambil semua opsi dropdown.
 * Termasuk bibit, sumber, tujuan dari sheet Bibit (untuk autocomplete di form).
 */
function getDropdownOptions() {
  // Dari sheet Master: dibuatOleh & driver
  const master = initMasterSheet();
  const masterData = master.getDataRange().getValues();
  const dibuatOleh = [];
  const driver     = [];
  for (let i = 1; i < masterData.length; i++) {
    const nama = (masterData[i][0] || "").toString().trim();
    const drv  = (masterData[i][1] || "").toString().trim();
    if (nama) dibuatOleh.push(nama);
    if (drv)  driver.push(drv);
  }

  // Dari sheet Bibit: bibit, sumber, tujuan (nilai unik)
  const bibitSet  = new Set();
  const sumberSet = new Set();
  const tujuanSet = new Set();
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (sheet) {
      const headerMap = buildHeaderMap(sheet);
      const allData   = sheet.getDataRange().getValues();
      for (let i = 1; i < allData.length; i++) {
        const r = allData[i];
        const b = safeGet(r, headerMap.bibit,  "").toString().trim();
        const s = safeGet(r, headerMap.sumber, "").toString().trim();
        const t = safeGet(r, headerMap.tujuan, "").toString().trim();
        if (b) bibitSet.add(b);
        if (s) sumberSet.add(s);
        if (t) tujuanSet.add(t);
      }
    }
  } catch (e) {
    Logger.log("[getDropdownOptions] Bibit sheet error: " + e);
  }

  return {
    dibuatOleh,
    driver,
    bibit:  [...bibitSet].sort(),
    sumber: [...sumberSet].sort(),
    tujuan: [...tujuanSet].sort(),
  };
}


// ============================================================
//  SIMPAN LINK PDF KE SHEET KHUSUS
// ============================================================

function savePdfLinkToSheet(nomorSurat, tanggal, bibit, tujuan, linkPdf, dibuatOleh, driver) {
  const SHEET_LINKS = "SuratJalanLinks";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_LINKS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_LINKS);
    sheet.appendRow(["Nomor Surat","Tanggal","Bibit","Tujuan","Link PDF","Dibuat Oleh","Driver"]);
  }
  sheet.appendRow([nomorSurat, tanggal, bibit, tujuan, linkPdf, dibuatOleh, driver]);
}


// ============================================================
//  GENERATE QR CODE (Base64) — untuk PDF
//  Gunakan ukuran besar (500px) + error correction tinggi agar tajam di PDF.
//  Primary: api.qrserver.com  |  Fallback: Google Charts API
// ============================================================

function generateQrBase64(qrText) {
  // Primary: qrserver.com — 500×500, error correction H (high)
  const primary = "https://api.qrserver.com/v1/create-qr-code/?size=500x500&ecc=H&data="
    + encodeURIComponent(qrText);
  let result = fetchImageBase64(primary, "image/png");
  if (result) return result;

  // Fallback: Google Charts — lebih andal karena infrastruktur Google
  const fallback = "https://chart.googleapis.com/chart?chs=500x500&cht=qr&chld=H%7C1&chl="
    + encodeURIComponent(qrText);
  return fetchImageBase64(fallback, "image/png");
}


// ============================================================
//  GENERATE PDF SURAT JALAN — Desain Premium
// ============================================================

/**
 * Menghasilkan PDF Surat Jalan dengan desain profesional:
 * - Header logo + nama perusahaan
 * - Tabel info (tanggal, bibit, jumlah, sumber, tujuan)
 * - Tabel data bibit
 * - Kotak tanda tangan dengan centang hijau
 * - QR Code besar di bawah
 */
function generateSuratJalanPdf(tanggal, bibit, keluar, sumber, tujuan, kodeVerifikasi,
                                nomorSurat, dibuatOleh, driver, approvedBy, jabatanApprover) {
  dibuatOleh      = dibuatOleh      || "-";
  driver          = driver          || "-";
  approvedBy      = approvedBy      || getApproverName();
  jabatanApprover = jabatanApprover || getApproverJabatan();

  const folder           = getOrCreateFolder(FOLDER_SURAT_JALAN);
  const tanggalFormatted = formatTanggalWITA(tanggal);
  const jumlahFormatted  = Number(keluar).toLocaleString("id-ID");

  // QR code → URL verifikasi
  const qrValue = "https://smartnursery.montana.id/verify?kode=" + encodeURIComponent(kodeVerifikasi);
  const qrBase64 = generateQrBase64(qrValue);

  // Logo perusahaan
  const logoBase64 = fetchImageBase64(LOGO_URL);

  // Logo HTML — gunakan base64 jika berhasil, fallback ke lingkaran CSS
  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" width="52" height="52" alt="Logo EBL" style="border-radius:6px;object-fit:contain;">`
    : `<div style="width:52px;height:52px;border-radius:50%;background:#f97316;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:bold;color:white;">H</div>`;

  // QR HTML
  // Tampilkan QR besar (240px) agar tajam saat dicetak di PDF
  const qrHtml = qrBase64
    ? `<img src="${qrBase64}" width="240" height="240" alt="QR Code" style="image-rendering:crisp-edges;">`
    : `<p style="font-family:monospace;font-size:13px;color:#333;letter-spacing:2px;">${kodeVerifikasi}</p>`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, sans-serif;
    color: #1a1a1a;
    font-size: 12px;
    padding: 32px 44px;
    background: #fff;
  }

  /* ── Header ── */
  .header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding-bottom: 12px;
    border-bottom: 3px solid #10b981;
    margin-bottom: 22px;
  }
  .company-name { font-size: 16px; font-weight: bold; color: #1a1a1a; }
  .company-sub  { font-size: 11px; color: #666; margin-top: 3px; }

  /* ── Title ── */
  .title {
    text-align: center;
    margin: 0 0 24px;
  }
  .title h1 {
    font-size: 17px;
    font-weight: bold;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }

  /* ── Info table ── */
  .info-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
  }
  .info-table td {
    padding: 3px 0;
    vertical-align: top;
    font-size: 12px;
  }
  .info-table .lbl  { width: 130px; color: #333; }
  .info-table .sep  { width: 14px;  color: #333; }
  .info-table .val  { font-weight: 500; color: #111; }

  /* ── Data table ── */
  .data-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 14px;
  }
  .data-table th {
    background: #10b981;
    color: #fff;
    padding: 7px 10px;
    text-align: left;
    font-size: 11px;
    font-weight: bold;
  }
  .data-table td {
    padding: 7px 10px;
    border: 1px solid #e0e0e0;
    font-size: 11px;
    vertical-align: middle;
  }
  .data-table tbody tr:first-child td { border-top: none; }
  .data-table .num { text-align: center; }

  /* ── Note ── */
  .note {
    font-style: italic;
    font-size: 10px;
    color: #666;
    margin-bottom: 30px;
    line-height: 1.5;
  }

  /* ── Signatures ── */
  .sig-section {
    display: flex;
    justify-content: space-around;
    margin-bottom: 28px;
  }
  .sig-box      { text-align: center; width: 30%; }
  .sig-label    { font-size: 11px; font-weight: bold; margin-bottom: 8px; }
  .sig-check    {
    font-size: 38px;
    color: #10b981;
    line-height: 1;
    font-weight: bold;
    margin: 4px 0 10px;
  }
  .sig-name     { font-size: 11px; font-weight: bold; margin-top: 4px; }
  .sig-jabatan  { font-size: 10px; color: #555; margin-top: 2px; }
  .sig-role     { font-size: 9px;  color: #888; margin-top: 1px; }

  /* ── QR section ── */
  .qr-section {
    text-align: center;
    padding-top: 16px;
    border-top: 1px solid #e0e0e0;
    margin-bottom: 16px;
  }
  .qr-label {
    font-size: 10px;
    color: #555;
    margin-bottom: 10px;
    line-height: 1.5;
  }
  .kode-ver {
    font-family: monospace;
    font-size: 11px;
    color: #444;
    margin-top: 8px;
  }

  /* ── Footer ── */
  .footer {
    text-align: center;
    font-size: 9px;
    color: #aaa;
    border-top: 1px solid #eee;
    padding-top: 10px;
    line-height: 1.6;
  }
</style>
</head>
<body>

<!-- ── HEADER ── -->
<div class="header">
  ${logoHtml}
  <div>
    <div class="company-name">PT Energi Batubara Lestari</div>
    <div class="company-sub">Unit Nursery &mdash; Kalimantan Selatan</div>
  </div>
</div>

<!-- ── TITLE ── -->
<div class="title">
  <h1>Surat Jalan Distribusi Bibit</h1>
</div>

<!-- ── INFO ── -->
<table class="info-table">
  <tr>
    <td class="lbl">Tanggal</td>
    <td class="sep">:</td>
    <td class="val">${tanggalFormatted}</td>
  </tr>
  <tr>
    <td class="lbl">Jenis Bibit</td>
    <td class="sep">:</td>
    <td class="val">${bibit}</td>
  </tr>
  <tr>
    <td class="lbl">Jumlah</td>
    <td class="sep">:</td>
    <td class="val">${jumlahFormatted}</td>
  </tr>
  <tr>
    <td class="lbl">Asal / Sumber</td>
    <td class="sep">:</td>
    <td class="val">${sumber}</td>
  </tr>
  <tr>
    <td class="lbl">Tujuan / Lokasi</td>
    <td class="sep">:</td>
    <td class="val">${tujuan}</td>
  </tr>
</table>

<!-- ── DATA TABLE ── -->
<table class="data-table">
  <thead>
    <tr>
      <th style="width:32px">No</th>
      <th>Jenis Bibit</th>
      <th style="width:70px">Jumlah</th>
      <th style="width:60px">Satuan</th>
      <th>Keterangan</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="num">1</td>
      <td>${bibit}</td>
      <td class="num">${jumlahFormatted}</td>
      <td class="num">Bibit</td>
      <td></td>
    </tr>
  </tbody>
</table>

<p class="note">
  Catatan: Pastikan bibit dalam kondisi baik saat penyerahan.
  Surat jalan ini sebagai bukti distribusi resmi.
</p>

<!-- ── SIGNATURES ── -->
<div class="sig-section">
  <div class="sig-box">
    <div class="sig-label">Dibuat oleh</div>
    <div class="sig-check">&#10003;</div>
    <div class="sig-name">${dibuatOleh}</div>
    <div class="sig-role">Petugas Nursery</div>
  </div>
  <div class="sig-box">
    <div class="sig-label">Disetujui</div>
    <div class="sig-check">&#10003;</div>
    <div class="sig-name">${approvedBy}</div>
    <div class="sig-jabatan">${jabatanApprover}</div>
  </div>
  <div class="sig-box">
    <div class="sig-label">Driver</div>
    <div class="sig-check">&#10003;</div>
    <div class="sig-name">${driver}</div>
    <div class="sig-role">Sopir / Kur</div>
  </div>
</div>

<!-- ── QR CODE ── -->
<div class="qr-section">
  <p class="qr-label">
    Scan QR Code untuk verifikasi<br>
    keaslian dokumen via aplikasi Smart Nursery
  </p>
  ${qrHtml}
  <p class="kode-ver">Kode: ${kodeVerifikasi}</p>
</div>

<!-- ── FOOTER ── -->
<div class="footer">
  Dicetak otomatis oleh Montana AI Engine PT Energi Batubara<br>
  Lestari &mdash; Unit Nursery
</div>

</body>
</html>`;

  const blob    = Utilities.newBlob(html, "text/html", "suratjalan.html");
  const pdfBlob = blob.getAs("application/pdf");
  const file    = folder.createFile(pdfBlob).setName("SuratJalan_" + nomorSurat + ".pdf");
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}


// ============================================================
//  SIMPAN DATA KE SHEET
// ============================================================

const COLS_NEEDED = [
  { name: "Nomor Surat",     mapKey: "nomorsurat"     },
  { name: "Status Approval", mapKey: "statusapproval" },
  { name: "Approved By",     mapKey: "approvedby"     },
  { name: "Approved At",     mapKey: "approvedat"     },
  { name: "Dibuat Oleh",     mapKey: "dibuatoleh"     },
  { name: "Driver",          mapKey: "driver"         },
  { name: "Kode Verifikasi", mapKey: "kodeverifikasi" },
  { name: "Link PDF",        mapKey: "linkpdf"        },
  { name: "Status Kirim",    mapKey: "statuskirim"    },
];

function saveToSheet(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Sheet tidak ditemukan: " + SHEET_NAME);

  let headerMap = ensureColumns(sheet, COLS_NEEDED);
  const newRow  = sheet.getLastRow() + 1;
  const totalCols = sheet.getLastColumn();
  const rowData = new Array(totalCols).fill("");

  if (headerMap.tanggal >= 0) rowData[headerMap.tanggal] = data.tanggal || "";
  if (headerMap.bulan   >= 0 && data.tanggal) {
    const d = new Date(data.tanggal + "T00:00:00");
    if (!isNaN(d.getTime())) {
      rowData[headerMap.bulan] = Utilities.formatDate(d, "Asia/Makassar", "MMMM yyyy");
    }
  }
  if (headerMap.bibit  >= 0) rowData[headerMap.bibit]  = data.bibit  || "";
  if (headerMap.masuk  >= 0) rowData[headerMap.masuk]  = Number(data.masuk)  || 0;
  if (headerMap.keluar >= 0) rowData[headerMap.keluar] = Number(data.keluar) || 0;
  if (headerMap.mati   >= 0) rowData[headerMap.mati]   = Number(data.mati)   || 0;
  if (headerMap.sumber >= 0) rowData[headerMap.sumber] = data.sumber || "";
  if (headerMap.tujuan >= 0) rowData[headerMap.tujuan] = data.tujuan || "";

  if (headerMap.dibuatoleh >= 0) {
    rowData[headerMap.dibuatoleh] = data.dibuatOleh || data.dibuat_oleh || "";
  }
  if (headerMap.driver >= 0) rowData[headerMap.driver] = data.driver || "";

  if (headerMap.total >= 0) {
    rowData[headerMap.total] = (Number(data.masuk) || 0)
                             - (Number(data.keluar) || 0)
                             - (Number(data.mati)   || 0);
  }

  const kodeVer    = generateVerificationCode(10);
  const nomorSurat = generateNomorSurat(newRow, data.tanggal || new Date().toISOString().split("T")[0]);

  if (headerMap.kodeverifikasi >= 0) rowData[headerMap.kodeverifikasi] = kodeVer;
  if (headerMap.nomorsurat     >= 0) rowData[headerMap.nomorsurat]     = nomorSurat;

  sheet.getRange(newRow, 1, 1, totalCols).setValues([rowData]);

  return { nomorSurat, kodeVer, newRow, headerMap };
}


// ============================================================
//  APPROVAL
// ============================================================

function approveSurat(body) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Sheet tidak ditemukan");

  let headerMap = ensureColumns(sheet, [
    { name: "Status Approval", mapKey: "statusapproval" },
    { name: "Approved By",     mapKey: "approvedby"     },
    { name: "Approved At",     mapKey: "approvedat"     },
  ]);

  const nomorSuratCol = headerMap.nomorsurat;
  if (nomorSuratCol === undefined) {
    return { success: false, error: "Kolom Nomor Surat tidak ditemukan" };
  }

  const allData = sheet.getDataRange().getValues();
  for (let i = 1; i < allData.length; i++) {
    const val = (allData[i][nomorSuratCol] || "").toString().trim();
    if (val === body.nomorSurat) {
      sheet.getRange(i + 1, headerMap.statusapproval + 1).setValue(body.status     || "approved");
      sheet.getRange(i + 1, headerMap.approvedby     + 1).setValue(body.approvedBy || "");
      sheet.getRange(i + 1, headerMap.approvedat     + 1).setValue(body.approvedAt || new Date());
      return { success: true, message: "Approval berhasil disimpan" };
    }
  }
  return { success: false, error: "Nomor Surat tidak ditemukan: " + body.nomorSurat };
}


// ============================================================
//  KIRIM WHATSAPP — Pesan singkat (dipanggil dari doPost)
// ============================================================

function sendWhatsApp(data, nomorSurat, linkPdf) {
  const token = getToken();
  if (!token) return { code: 0, error: "Token tidak tersedia" };

  const message =
    "✅ Data Bibit Berhasil Dicatat\n" +
    "No. Surat: " + nomorSurat + "\n" +
    "Bibit: "    + (data.bibit   || "-") + "\n" +
    "Tanggal: "  + (data.tanggal || "-") + "\n" +
    "Tujuan: "   + (data.tujuan  || "-") + "\n" +
    (linkPdf ? "📄 PDF: " + linkPdf + "\n" : "");

  try {
    const res = UrlFetchApp.fetch("https://api.fonnte.com/send", {
      method: "post",
      headers: { Authorization: token },
      payload: { target: NOMOR_ADMIN, message },
      muteHttpExceptions: true,
    });
    return { code: res.getResponseCode(), body: res.getContentText() };
  } catch (err) {
    Logger.log("[sendWhatsApp] Error: " + err);
    return { code: 0, error: err.toString() };
  }
}


// ============================================================
//  KIRIM WHATSAPP — Pesan lengkap analisis (dipanggil dari trigger / manual)
// ============================================================

function kirimPesanFonnte(sheet, row, headerMap, allData, rowValues) {
  const token = getToken();
  if (!token) { Logger.log("[kirimPesanFonnte] TOKEN_FONNTE belum diset."); return; }

  const statusCol = headerMap.statuskirim !== undefined
    ? headerMap.statuskirim + 1
    : sheet.getLastColumn() + 1;

  if (headerMap.statuskirim === undefined) {
    sheet.getRange(1, statusCol).setValue("Status Kirim");
    headerMap.statuskirim = statusCol - 1;
  }

  const vals = rowValues || (row > 1 ? allData[row - 1] : []);
  const tanggalRaw = safeGet(vals, headerMap.tanggal, "");
  const tanggalFormatted = tanggalRaw
    ? Utilities.formatDate(
        new Date(tanggalRaw instanceof Date ? tanggalRaw : tanggalRaw + "T00:00:00"),
        "Asia/Makassar", "dd MMMM yyyy"
      )
    : "";
  const jamWita    = Utilities.formatDate(new Date(), "Asia/Makassar", "HH.mm 'WITA'");
  const bibit      = safeGet(vals, headerMap.bibit,       "-").toString().trim() || "-";
  const masuk      = safeNum(vals, headerMap.masuk,       0);
  const keluar     = safeNum(vals, headerMap.keluar,      0);
  const sumber     = safeGet(vals, headerMap.sumber,      "-").toString().trim() || "-";
  const tujuan     = safeGet(vals, headerMap.tujuan,      "-").toString().trim() || "-";
  const dibuatOleh = safeGet(vals, headerMap.dibuatoleh,  "-").toString().trim() || "-";
  const driverName = safeGet(vals, headerMap.driver,      "-").toString().trim() || "-";
  const nomorSurat = safeGet(vals, headerMap.nomorsurat,  "").toString().trim();

  // Threshold stok menipis
  const THRESHOLD_MENIPIS = parseInt(
    PropertiesService.getScriptProperties().getProperty("THRESHOLD_MENIPIS") || "500"
  );

  // Rekap stok per bibit
  const stokPerBibit = {};
  for (let i = 1; i < allData.length; i++) {
    const r     = allData[i];
    const jenis = (safeGet(r, headerMap.bibit, "") || "").toString().trim().toUpperCase();
    if (!jenis) continue;
    if (!stokPerBibit[jenis]) stokPerBibit[jenis] = 0;
    stokPerBibit[jenis] += safeNum(r, headerMap.masuk,  0)
                         - safeNum(r, headerMap.keluar, 0)
                         - safeNum(r, headerMap.mati,   0);
  }

  const sortedBibit = Object.keys(stokPerBibit).sort();
  let teksRekap = "Rekapitulasi Jumlah Bibit:\n";
  sortedBibit.forEach(jenis => {
    const stok   = Math.max(0, stokPerBibit[jenis]);
    const status = stok === 0 ? "🚨 Habis" : stok < THRESHOLD_MENIPIS ? "⚠ Menipis" : "✅ Aman";
    teksRekap += "* " + jenis + ": " + stok.toLocaleString("id-ID") + " (" + status + ")\n";
  });

  // Agregat keseluruhan
  let totalMasukAgregat = 0, totalHidupAgregat = 0, totalMatiAgregat = 0;
  for (let i = 1; i < allData.length; i++) {
    const r  = allData[i];
    const m  = safeNum(r, headerMap.masuk,  0);
    const k  = safeNum(r, headerMap.keluar, 0);
    const mt = safeNum(r, headerMap.mati,   0);
    totalMasukAgregat += m;
    totalMatiAgregat  += mt;
    totalHidupAgregat += (m - k - mt);
  }
  const sr = totalMasukAgregat > 0 ? (totalHidupAgregat / totalMasukAgregat) * 100 : 0;
  const rp = totalMasukAgregat > 0
    ? ((totalMasukAgregat - totalHidupAgregat) / totalMasukAgregat) * 100 : 0;

  // Analisis tim lapangan
  const timNames = {};
  for (let i = 1; i < allData.length; i++) {
    const r   = allData[i];
    const tuj = safeGet(r, headerMap.tujuan, "").toString().toUpperCase();
    if (!tuj.includes("TIM")) continue;
    const match = tuj.match(/TIM\s+(\w+)/);
    if (!match) continue;
    const nama = match[1];
    if (!timNames[nama]) timNames[nama] = [];
    timNames[nama].push(r);
  }

  const timKeys   = Object.keys(timNames).sort();
  const timTotals = {};
  let teksTim = "";

  timKeys.forEach(nama => {
    const rows = timNames[nama];
    let totalKeluar = 0;
    const detailBibit = {};
    rows.forEach(r => {
      const kel   = safeNum(r, headerMap.keluar, 0);
      totalKeluar += kel;
      const jenis = (safeGet(r, headerMap.bibit, "") || "").toString().trim().toUpperCase();
      if (jenis && kel > 0) detailBibit[jenis] = (detailBibit[jenis] || 0) + kel;
    });
    timTotals[nama] = totalKeluar;
    if (totalKeluar > 0) {
      const avg = Math.round(totalKeluar / (rows.length || 1));
      teksTim += "👷‍♂️ Tim " + nama.charAt(0) + nama.slice(1).toLowerCase() + ":\n";
      teksTim += "Total Realisasi : " + totalKeluar.toLocaleString("id-ID") + " bibit\n";
      teksTim += "Rata-rata : " + avg + " bibit/hari\n";
      teksTim += "__KONTRIBUSI_" + nama + "__\n";
      const bibitKeys = Object.keys(detailBibit).sort();
      if (bibitKeys.length > 0) {
        teksTim += "Detail Bibit:\n";
        bibitKeys.forEach(b => {
          teksTim += "  • " + b + ": " + detailBibit[b].toLocaleString("id-ID") + " bibit\n";
        });
      }
      teksTim += "\n";
    }
  });

  const totalGabungan = timKeys.reduce((s, k) => s + (timTotals[k] || 0), 0);
  timKeys.forEach(nama => {
    const placeholder = "__KONTRIBUSI_" + nama + "__\n";
    if (totalGabungan > 0 && (timTotals[nama] || 0) > 0) {
      const kontri = ((timTotals[nama] / totalGabungan) * 100).toFixed(1);
      teksTim = teksTim.replace(placeholder, "Kontribusi : " + kontri + "%\n");
    } else {
      teksTim = teksTim.replace(placeholder, "");
    }
  });

  const activeTimKeys = timKeys.filter(k => (timTotals[k] || 0) > 0);
  let diffPercent   = "0.0";
  let kondisiSistem = "✅ Stabil & Sinkron";
  if (activeTimKeys.length >= 2) {
    let maxTim = 0, minTim = Infinity;
    activeTimKeys.forEach(k => {
      if (timTotals[k] > maxTim) maxTim = timTotals[k];
      if (timTotals[k] < minTim) minTim = timTotals[k];
    });
    diffPercent = totalGabungan > 0
      ? ((Math.abs(maxTim - minTim) / totalGabungan) * 100).toFixed(1) : "0.0";
    if (parseFloat(diffPercent) > 30) kondisiSistem = "⚠ Ketimpangan Terdeteksi";
  }

  // Stok Sengon Potting
  let pottingMasuk = 0, pottingKeluar = 0, pottingMati = 0;
  const allDataPotting = [];
  for (let i = 1; i < allData.length; i++) {
    const r = allData[i];
    if (safeGet(r, headerMap.bibit, "").toString().toUpperCase().includes("SENGON POTTING")) {
      allDataPotting.push(r);
      pottingMasuk  += safeNum(r, headerMap.masuk,  0);
      pottingKeluar += safeNum(r, headerMap.keluar, 0);
      pottingMati   += safeNum(r, headerMap.mati,   0);
    }
  }
  const totalStokPotting = Math.max(0, pottingMasuk - pottingKeluar - pottingMati);

  const today       = new Date(); today.setHours(23, 59, 59, 999);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const potting7Hari = allDataPotting.filter(r => {
    const d = new Date(safeGet(r, headerMap.tanggal, ""));
    return !isNaN(d) && d >= sevenDaysAgo && d <= today;
  });
  let avgDaily = potting7Hari.reduce((a, r) => a + safeNum(r, headerMap.keluar, 0), 0) / 7;
  if (avgDaily <= 0 && allDataPotting.length > 0) {
    const firstDate = new Date(safeGet(allDataPotting[0], headerMap.tanggal, ""));
    const totalDays = Math.max(1, Math.round((today - firstDate) / 86400000));
    avgDaily = pottingKeluar / totalDays;
  }
  if (avgDaily <= 0) avgDaily = 400;
  avgDaily = Math.round(avgDaily);

  const daysLeft = (avgDaily > 0 && totalStokPotting > 0) ? Math.ceil(totalStokPotting / avgDaily) : 0;
  const predDate = daysLeft > 0
    ? new Date(Date.now() + daysLeft * 86400000).toLocaleDateString("id-ID", {
        day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Makassar"
      })
    : "-";

  // Kesimpulan AI
  let kesimpulan;
  if (sr >= 97 && rp >= 90 && parseFloat(diffPercent) <= 15) {
    kesimpulan = "Distribusi lapangan berjalan efisien dan seimbang antar-tim.";
  } else if (sr >= 90 && rp >= 80 && parseFloat(diffPercent) <= 30) {
    kesimpulan = "Aktivitas lapangan terpantau stabil dan terkendali.";
  } else if (sr < 90 || rp < 70) {
    kesimpulan = "AI mendeteksi potensi penurunan kinerja nursery. Disarankan evaluasi penyiraman dan distribusi.";
  } else if (parseFloat(diffPercent) > 30) {
    kesimpulan = "Terdapat ketimpangan signifikan antar tim. AI merekomendasikan rotasi area kerja.";
  } else if (daysLeft <= 7 && daysLeft > 0) {
    kesimpulan = "Stok SENGON POTTING kurang dari seminggu. Segera rencanakan pembibitan ulang.";
  } else {
    kesimpulan = "Distribusi lapangan berjalan efisien tanpa anomali stok.";
  }

  // Link merged doc (Autocrat)
  const mergedIdx = (function () {
    if (headerMap["mergeddocurlaplikasiqr"] !== undefined) return headerMap["mergeddocurlaplikasiqr"];
    const k = Object.keys(headerMap).find(k => k.includes("mergeddoc") && k.includes("url"));
    return k !== undefined ? headerMap[k] : -1;
  })();
  const linkMerged = mergedIdx >= 0 ? safeGet(vals, mergedIdx, "").toString().trim() : "";

  // Susun pesan
  let pesan =
    "RINGKASAN DISTRIBUSI LAPANGAN – MONTANA AI ENGINE\n" +
    "Unit Nursery PT Energi Batubara Lestari (EBL)\n" +
    "📅 " + (tanggalFormatted ? tanggalFormatted + " pukul " + jamWita : "pukul " + jamWita) + "\n" +
    "Jenis Bibit : " + bibit + "\n" +
    (nomorSurat ? "No. Surat   : " + nomorSurat + "\n" : "") +
    (masuk  > 0 ? "Jumlah Masuk  : " + masuk.toLocaleString("id-ID")  + " bibit\n" : "") +
    (keluar > 0 ? "Jumlah Keluar : " + keluar.toLocaleString("id-ID") + " bibit\n" : "") +
    "\nSumber : " + sumber + "\n" +
    "Tujuan : " + tujuan + "\n" +
    (dibuatOleh !== "-" ? "Dibuat Oleh : " + dibuatOleh + "\n" : "") +
    (driverName !== "-" ? "Driver      : " + driverName + "\n" : "") +
    "\n" + teksRekap +
    "----------------------------------\n" +
    "📊 Analisis Aktivitas:\n" +
    "AI mendeteksi aktivitas distribusi " + bibit + " sebanyak " +
    keluar.toLocaleString("id-ID") + " bibit dari " + sumber +
    " menuju *" + tujuan + "*.\n";

  if (teksTim) {
    pesan += "----------------------------------\n" + teksTim;
    if (activeTimKeys.length >= 2) {
      pesan +=
        "----------------------------------\n" +
        "📈 Analisis Komparatif:\n" +
        "Selisih distribusi antar-tim: " + diffPercent + "%\n" +
        "Kondisi sistem: " + kondisiSistem + "\n";
    }
  }

  pesan +=
    "----------------------------------\n" +
    "📦 Stok Akhir (SENGON POTTING):\n" +
    "Sisa SENGON POTTING: " + totalStokPotting.toLocaleString("id-ID") + " bibit\n" +
    "Rata-rata keluar: " + avgDaily.toLocaleString("id-ID") + " bibit/hari\n" +
    "Estimasi habis: ±" + daysLeft + " hari lagi (" + predDate + ")\n" +
    "----------------------------------\n" +
    "🌱 Kinerja Nursery (Agregat):\n" +
    "Bibit Masuk : " + totalMasukAgregat.toLocaleString("id-ID") + " bibit\n" +
    "Bibit Hidup : " + totalHidupAgregat.toLocaleString("id-ID") + " bibit\n" +
    "Bibit Mati  : " + totalMatiAgregat.toLocaleString("id-ID")  + " bibit\n" +
    "Persentase Hidup     : " + sr.toFixed(1) + "%\n" +
    "Realisasi Penyerapan : " + rp.toFixed(1) + "%\n" +
    "Status Efisiensi : " +
      (sr >= 97 && rp >= 90 ? "✅ Sangat Baik" : sr >= 90 && rp >= 80 ? "⚙ Stabil" : "⚠ Perlu Evaluasi") + "\n" +
    "----------------------------------\n" +
    "🧠 Kesimpulan:\n" + kesimpulan + "\n" +
    "> Dikirim otomatis via Fonnte\n" +
    "> Montana AI Engine 🌱";

  // Tambahkan link PDF — utamakan Autocrat jika ada
  const linkToSend = linkMerged || "";
  if (linkToSend) {
    const labelSurat = nomorSurat ? "*Surat Jalan " + nomorSurat + ":*" : "*Surat Jalan (PDF):*";
    pesan += "\n📄 " + labelSurat + "\n" + linkToSend + "\n> _Sent via fonnte.com_";
  }

  // Kirim ke semua target
  const targets = NOMOR_ADMIN.split(",");
  let allOk = true;
  for (const target of targets) {
    try {
      const res = UrlFetchApp.fetch("https://api.fonnte.com/send", {
        method: "post",
        headers: { Authorization: token },
        payload: { target: target.trim(), message: pesan },
        muteHttpExceptions: true,
      });
      const resCode = res.getResponseCode();
      Logger.log("Fonnte [" + target.trim() + "]: " + resCode + " - " + res.getContentText());
      if (resCode !== 200) allOk = false;
    } catch (err) {
      Logger.log("[kirimPesanFonnte] Gagal kirim ke " + target + ": " + err);
      allOk = false;
    }
  }

  sheet.getRange(row, statusCol).setValue((allOk ? "✅ Terkirim " : "❌ Gagal ") + getWitaNow());
}


// ============================================================
//  INPUT DATA BIBIT (dipanggil dari HTML form GAS)
// ============================================================

function inputDataBibit(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Sheet tidak ditemukan");

  const result    = saveToSheet(data);
  const { nomorSurat, kodeVer, newRow } = result;
  let   headerMap = buildHeaderMap(sheet);

  let pdfUrl = "";
  try {
    pdfUrl = generateSuratJalanPdf(
      data.tanggal || new Date().toISOString().split("T")[0],
      data.bibit   || "-",
      Number(data.keluar) || 0,
      data.sumber  || "-",
      data.tujuan  || "-",
      kodeVer,
      nomorSurat,
      data.dibuatOleh || data.dibuat_oleh || "-",
      data.driver  || "-"
    );
    if (pdfUrl && headerMap.linkpdf !== undefined) {
      sheet.getRange(newRow, headerMap.linkpdf + 1).setValue(pdfUrl);
      savePdfLinkToSheet(nomorSurat, data.tanggal, data.bibit, data.tujuan, pdfUrl,
                         data.dibuatOleh || "-", data.driver || "-");
    }
  } catch (pdfErr) {
    Logger.log("[inputDataBibit] PDF gagal: " + pdfErr.message);
  }

  try {
    const allData = sheet.getDataRange().getValues();
    headerMap = buildHeaderMap(sheet);
    kirimPesanFonnte(sheet, newRow, headerMap, allData, allData[newRow - 1]);
  } catch (err) {
    Logger.log("[inputDataBibit] Fonnte gagal: " + err.message);
  }

  return { success: true, nomorSurat, linkPdf: pdfUrl };
}


// ============================================================
//  WEB API — doPost
//  Menerima POST dari React form (Content-Type: text/plain + JSON body)
// ============================================================

function doPost(e) {
  Logger.log("=== [doPost] Incoming request ===");
  Logger.log("Raw body: " + (e && e.postData ? e.postData.contents : "(no data)"));

  // ── Parse body ──
  // React form mengirim Content-Type: text/plain dengan body JSON
  // untuk menghindari CORS preflight OPTIONS yang tidak didukung GAS.
  let body = {};
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    body = JSON.parse(raw);
    Logger.log("[doPost] Parsed body: " + JSON.stringify(body));
  } catch (err) {
    // Fallback ke form parameters
    body = (e && e.parameter) ? e.parameter : {};
    Logger.log("[doPost] Fallback to e.parameter: " + JSON.stringify(body));
  }

  // ── Handler Approval ──
  if (body.action === "approve" && body.nomorSurat) {
    try {
      return ContentService.createTextOutput(JSON.stringify(approveSurat(body)))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false, message: "Approval gagal", error: err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // ── Validasi field wajib ──
  if (!body.tanggal || !body.bibit) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Field 'tanggal' dan 'bibit' wajib diisi.",
      error: "Missing required fields"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // ── Simpan ke sheet ──
  let nomorSurat = "", kodeVer = "", newRow = 0, headerMap = {};
  try {
    const sheetResult = saveToSheet(body);
    nomorSurat = sheetResult.nomorSurat;
    kodeVer    = sheetResult.kodeVer;
    newRow     = sheetResult.newRow;
    headerMap  = sheetResult.headerMap;
    Logger.log("[doPost] nomorSurat: " + nomorSurat + ", row: " + newRow);
  } catch (err) {
    Logger.log("[doPost] saveToSheet error: " + err);
    return ContentService.createTextOutput(JSON.stringify({
      success: false, message: "Gagal menyimpan data ke sheet", error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // ── Generate PDF ──
  let linkPdf  = "";
  let pdfError = "";
  try {
    linkPdf = generateSuratJalanPdf(
      body.tanggal || new Date().toISOString().split("T")[0],
      body.bibit   || "-",
      Number(body.keluar) || 0,
      body.sumber  || "-",
      body.tujuan  || "-",
      kodeVer,
      nomorSurat,
      body.dibuatOleh || body.dibuat_oleh || "-",
      body.driver  || "-"
    );
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (linkPdf && sheet && headerMap.linkpdf !== undefined) {
      sheet.getRange(newRow, headerMap.linkpdf + 1).setValue(linkPdf);
      savePdfLinkToSheet(nomorSurat, body.tanggal, body.bibit, body.tujuan, linkPdf,
                         body.dibuatOleh || body.dibuat_oleh || "-", body.driver || "-");
    }
    Logger.log("[doPost] PDF URL: " + linkPdf);
  } catch (err) {
    pdfError = err.toString();
    Logger.log("[doPost] PDF error: " + pdfError);
  }

  // ── Kirim WhatsApp singkat ──
  let fonnteResp = {};
  try {
    fonnteResp = sendWhatsApp(body, nomorSurat, linkPdf);
    Logger.log("[doPost] Fonnte: " + JSON.stringify(fonnteResp));
  } catch (err) {
    Logger.log("[doPost] Fonnte error: " + err);
  }

  return ContentService.createTextOutput(JSON.stringify({
    success:    true,
    message:    pdfError ? "Data tersimpan, PDF gagal: " + pdfError : "Data tersimpan & PDF berhasil",
    error:      pdfError,
    nomorSurat,
    linkPdf,
    row:        newRow,
    fonnte:     fonnteResp,
  })).setMimeType(ContentService.MimeType.JSON);
}


// ============================================================
//  WEB API — doGet
//  CATATAN: ContentService.TextOutput TIDAK mendukung setHeaders().
//  CORS ditangani otomatis oleh Google saat script di-deploy sebagai
//  "Execute as: Me, Who has access: Anyone".
// ============================================================

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Sheet not found" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const headerMap = buildHeaderMap(sheet);
  const allData   = sheet.getDataRange().getValues();
  const action    = (e && e.parameter && e.parameter.action) ? e.parameter.action.toString().trim() : "";

  // --- Dropdowns (bibit, sumber, tujuan, dibuatOleh, driver) ---
  if (action === "dropdowns") {
    return ContentService.createTextOutput(JSON.stringify(getDropdownOptions()))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // --- Verify kode ---
  const verifyCode = (e && e.parameter && e.parameter.verify) ? e.parameter.verify.toString().trim() : "";
  if (verifyCode) {
    return handleVerify(verifyCode, headerMap, allData);
  }

  // --- List semua data ---
  const rows = [];
  for (let i = 1; i < allData.length; i++) {
    const r          = allData[i];
    const tanggalRaw = safeGet(r, headerMap.tanggal, "");
    let tanggal = "";
    if (tanggalRaw instanceof Date && !isNaN(tanggalRaw)) {
      tanggal = Utilities.formatDate(tanggalRaw, "Asia/Makassar", "yyyy-MM-dd");
    } else if (tanggalRaw) {
      tanggal = tanggalRaw.toString();
    }
    if (!tanggal) continue;

    // Cari link Autocrat (Merged Doc URL)
    const mergedIdx = (function () {
      if (headerMap["mergeddocurlaplikasiqr"] !== undefined) return headerMap["mergeddocurlaplikasiqr"];
      const k = Object.keys(headerMap).find(k => k.includes("mergeddoc") && k.includes("url"));
      return k !== undefined ? headerMap[k] : -1;
    })();
    const linkMerged = mergedIdx >= 0 ? safeGet(r, mergedIdx, "").toString().trim() : "";

    rows.push({
      no:             i,
      tanggal,
      bulan:          safeGet(r, headerMap.bulan,          "").toString().trim(),
      bibit:          safeGet(r, headerMap.bibit,          "").toString().trim(),
      masuk:          safeNum(r, headerMap.masuk,          0),
      keluar:         safeNum(r, headerMap.keluar,         0),
      mati:           safeNum(r, headerMap.mati,           0),
      total:          safeNum(r, headerMap.total,          0),
      sumber:         safeGet(r, headerMap.sumber,         "").toString().trim(),
      tujuan:         safeGet(r, headerMap.tujuan,         "").toString().trim(),
      nomorSurat:     safeGet(r, headerMap.nomorsurat,     "").toString().trim(),
      statusApproval: safeGet(r, headerMap.statusapproval, "").toString().trim(),
      approvedBy:     safeGet(r, headerMap.approvedby,     "").toString().trim(),
      approvedAt:     safeGet(r, headerMap.approvedat,     "").toString().trim(),
      statusKirim:    safeGet(r, headerMap.statuskirim,    "").toString().trim(),
      kodeVerifikasi: safeGet(r, headerMap.kodeverifikasi, "").toString().trim(),
      // Utamakan Autocrat PDF, fallback ke GAS PDF
      linkPdf:        linkMerged || safeGet(r, headerMap.linkpdf, "").toString().trim(),
      dibuatOleh:     safeGet(r, headerMap.dibuatoleh,     "").toString().trim(),
      driver:         safeGet(r, headerMap.driver,         "").toString().trim(),
    });
  }

  return ContentService.createTextOutput(
    JSON.stringify({ data: rows, count: rows.length, timestamp: new Date().toISOString() })
  ).setMimeType(ContentService.MimeType.JSON);
}

/** CORS preflight — GAS tidak benar-benar menerima OPTIONS, tapi ini sebagai fallback. */
function doOptions() {
  return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.JSON);
}

/** Cari kode verifikasi di sheet. */
function handleVerify(code, headerMap, allData) {
  for (let i = 1; i < allData.length; i++) {
    const r    = allData[i];
    const kode = safeGet(r, headerMap.kodeverifikasi, "").toString().trim();
    if (kode === code) {
      const tanggalRaw = safeGet(r, headerMap.tanggal, "");
      let tanggal = "";
      if (tanggalRaw instanceof Date && !isNaN(tanggalRaw)) {
        tanggal = Utilities.formatDate(tanggalRaw, "Asia/Makassar", "yyyy-MM-dd");
      } else if (tanggalRaw) {
        tanggal = tanggalRaw.toString();
      }
      return ContentService.createTextOutput(JSON.stringify({
        valid:          true,
        tanggal,
        bibit:          safeGet(r, headerMap.bibit,  "").toString().trim(),
        masuk:          safeNum(r, headerMap.masuk,  0),
        keluar:         safeNum(r, headerMap.keluar, 0),
        mati:           safeNum(r, headerMap.mati,   0),
        sumber:         safeGet(r, headerMap.sumber, "").toString().trim(),
        tujuan:         safeGet(r, headerMap.tujuan, "").toString().trim(),
        kodeVerifikasi: kode,
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(JSON.stringify({
    valid: false, error: "Kode verifikasi tidak ditemukan"
  })).setMimeType(ContentService.MimeType.JSON);
}


// ============================================================
//  onEdit — Sinkronisasi QR & Nomor Surat
// ============================================================

function onEdit(e) {
  const sheet = e.range.getSheet();
  const row   = e.range.getRow();
  const col   = e.range.getColumn();

  if (col === 2 || col === 16) {
    const id       = sheet.getRange(row, 2).getValue();
    const kodeCell = sheet.getRange(row, 16);
    const qrCell   = sheet.getRange(row, 18);
    let kode       = kodeCell.getValue();
    if (id && !kode) { kode = generateKode(); kodeCell.setValue(kode); }
    if (kode) { const qr = buatQR(kode); if (qrCell.getValue() !== qr) qrCell.setValue(qr); }
  }

  if (col === 3) {
    const tanggal   = sheet.getRange(row, 3).getValue();
    const nomorCell = sheet.getRange(row, 13);
    if (tanggal && !nomorCell.getValue()) {
      nomorCell.setValue(generateNomorSuratFromSheet(sheet, row));
    }
  }
}


// ============================================================
//  Sinkronisasi Massal
// ============================================================

function sinkronSemuaQR() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const id = data[i][1];
    let kode = data[i][15];
    if (id && !kode) { kode = generateKode(); sheet.getRange(i + 1, 16).setValue(kode); }
    if (kode) { const qr = buatQR(kode); if (data[i][17] !== qr) sheet.getRange(i + 1, 18).setValue(qr); }
  }
}

function isiNomorSuratSemua() {
  const sheet  = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data   = sheet.getDataRange().getValues();
  const romans = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
  let counter  = 1;
  for (let i = 1; i < data.length; i++) {
    const tanggal = data[i][2];
    const nomor   = data[i][12];
    if (tanggal && !nomor) {
      const date  = new Date(tanggal);
      const bulan = romans[date.getMonth()];
      const tahun = date.getFullYear();
      sheet.getRange(i + 1, 13).setValue(`SJ-BIBIT/${String(counter).padStart(4, "0")}/${bulan}/${tahun}`);
      counter++;
    }
  }
}

function scanAndSendPendingRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) return;

  let headerMap   = ensureColumns(sheet, [{ name: "Status Kirim", mapKey: "statuskirim" }]);
  const allData   = sheet.getDataRange().getValues();
  const statusCol = headerMap.statuskirim + 1;

  for (let i = 1; i < allData.length; i++) {
    const row      = allData[i];
    if (!row || row.length === 0) continue;
    const masukVal  = safeNum(row, headerMap.masuk,       0);
    const keluarVal = safeNum(row, headerMap.keluar,      0);
    const status    = (safeGet(row, headerMap.statuskirim, "") || "").toString().toLowerCase();
    if (status.includes("terkirim") || status.includes("processing") ||
        (masukVal <= 0 && keluarVal <= 0)) continue;

    sheet.getRange(i + 1, statusCol).setValue("PROCESSING...");
    SpreadsheetApp.flush();
    Utilities.sleep(200);
    kirimPesanFonnte(sheet, i + 1, headerMap, allData, allData[i]);
  }
}


// ============================================================
//  Menu & Fungsi Manual
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Montana AI")
    .addItem("Kirim baris aktif",                   "sendSelectedRow")
    .addItem("Tes kirim baris ke-2",                "testKirimManual")
    .addItem("Scan & kirim pending",                "scanAndSendPendingRows")
    .addSeparator()
    .addItem("Sinkronisasi QR semua baris",         "sinkronSemuaQR")
    .addItem("Isi Nomor Surat semua baris",         "isiNomorSuratSemua")
    .addSeparator()
    .addItem("Inisialisasi Sheet Master (Dropdown)","initMasterSheet")
    .addToUi();
}

function sendSelectedRow() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) { SpreadsheetApp.getUi().alert(`Sheet "${SHEET_NAME}" tidak ditemukan.`); return; }
  const row = sheet.getActiveRange().getRow();
  if (row <= 1) { SpreadsheetApp.getUi().alert("Pilih baris data (bukan header)."); return; }
  const headerMap = buildHeaderMap(sheet);
  const allData   = sheet.getDataRange().getValues();
  SpreadsheetApp.getUi().alert(`Mencoba mengirim data dari baris ${row}...`);
  kirimPesanFonnte(sheet, row, headerMap, allData, allData[row - 1]);
}

function testKirimManual() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) { SpreadsheetApp.getUi().alert(`Sheet "${SHEET_NAME}" tidak ditemukan.`); return; }
  const headerMap = buildHeaderMap(sheet);
  const allData   = sheet.getDataRange().getValues();
  if (allData.length < 2) { SpreadsheetApp.getUi().alert("Tidak ada data di baris 2."); return; }
  SpreadsheetApp.getUi().alert("Mencoba mengirim data dari baris 2...");
  kirimPesanFonnte(sheet, 2, headerMap, allData, allData[1]);
}
