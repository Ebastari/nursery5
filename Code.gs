// ============================================================
// Smart Nursery — Google Apps Script Backend
// PT Energi Batubara Lestari — Unit Nursery
// ============================================================
// CARA DEPLOY:
// 1. Buka script.google.com → buka project Anda
// 2. Hapus SEMUA file .gs yang ada di editor
// 3. Buat 1 file baru → paste SELURUH kode ini (hanya 1 file)
// 4. Klik Deploy → New deployment → Web app
//    Execute as : Me
//    Who has access : Anyone
// 5. Copy URL deployment → paste ke API_URL di src/data/api.ts
//
// SHEET dibuat otomatis:
//   Data        — data aktivitas & distribusi bibit
//   Users       — akun pengguna
//   OTP         — kode OTP reset password
//   InviteCodes — kode undangan pendaftaran
//
// Script Properties (opsional):
//   FONNTE_TOKEN — token dari fonnte.com (untuk OTP via WhatsApp)
// ============================================================

// ── NAMA SHEET ──────────────────────────────────────────────
var SHEET_DATA    = 'Data';
var SHEET_USERS   = 'Users';
var SHEET_OTP     = 'OTP';
var SHEET_INVITES = 'InviteCodes';

// ============================================================
// RESPONSE HELPER
// ============================================================
function jsonOk(data) {
  return ContentService
    .createTextOutput(JSON.stringify(Object.assign({ success: true }, data)))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonErr(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// SHEET HELPER
// ============================================================
function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function ensureSheet(name, headers) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ============================================================
// UTILITIES
// ============================================================
function hashPassword(password) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password,
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');
}

function generateToken() {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    Math.random().toString() + Date.now().toString(),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('').slice(0, 32);
}

function generateOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function generateInviteCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code  = 'NRS-';
  for (var i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generateKodeVerifikasi() {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var code  = '';
  for (var i = 0; i < 12; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code.match(/.{4}/g).join('-');
}

function generateNomorSurat(rowNum) {
  var now    = new Date();
  var tahun  = now.getFullYear();
  var bulan  = String(now.getMonth() + 1).padStart(2, '0');
  var urutan = String(rowNum).padStart(3, '0');
  return 'SJ/' + urutan + '/' + bulan + '/' + tahun;
}

// ============================================================
// doGet — semua GET request
// ============================================================
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = (params.action || '').trim();
    var verify = (params.verify || '').trim();

    if (verify)                       return handleVerify(verify);
    if (action === 'dropdowns')       return handleGetDropdowns();
    if (action === 'users')           return handleGetUsers();
    if (action === 'listInviteCodes') return handleListInviteCodes();
    return handleGetData();
  } catch (ex) {
    return jsonErr(ex.toString());
  }
}

// ============================================================
// doPost — semua POST request
// ============================================================
function doPost(e) {
  try {
    var raw  = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var body = JSON.parse(raw);
    var action = (body.action || '').trim();

    // Auth
    if (action === 'login')           return handleLogin(body);
    if (action === 'register')        return handleRegister(body);
    if (action === 'requestOtp')      return handleRequestOtp(body);
    if (action === 'resetPassword')   return handleResetPassword(body);
    if (action === 'changePassword')  return handleChangePassword(body);

    // Invite codes
    if (action === 'createInviteCode') return handleCreateInviteCode(body);
    if (action === 'deleteInviteCode') return handleDeleteInviteCode(body);

    // Admin
    if (action === 'setUserRole')     return handleSetUserRole(body);
    if (action === 'toggleUserStatus') return handleToggleUserStatus(body);

    // Data
    if (action === 'approve')         return handleApprove(body);
    if (action === 'confirmDelivery') return handleConfirmDelivery(body);

    // Default: submit data bibit
    return handleSubmitActivity(body);
  } catch (ex) {
    return jsonErr(ex.toString());
  }
}

// ============================================================
// GET DATA — Ambil semua baris dari sheet Data
// ============================================================
function handleGetData() {
  var sheet = getSheet(SHEET_DATA);
  if (!sheet) return jsonOk({ data: [], count: 0, timestamp: new Date().toISOString() });

  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return jsonOk({ data: [], count: 0, timestamp: new Date().toISOString() });

  var headers = rows[0].map(function(h) { return String(h).trim(); });
  var data    = [];

  for (var i = 1; i < rows.length; i++) {
    var obj = {};
    headers.forEach(function(h, j) {
      obj[h] = (rows[i][j] !== undefined && rows[i][j] !== null) ? rows[i][j] : '';
    });
    if (obj.tanggal || obj.bibit) data.push(obj);
  }

  return jsonOk({ data: data, count: data.length, timestamp: new Date().toISOString() });
}

// ============================================================
// SUBMIT ACTIVITY — Simpan data bibit baru
// ============================================================
function handleSubmitActivity(body) {
  if (!body.tanggal || !body.bibit) {
    return jsonErr("Field 'tanggal' dan 'bibit' wajib diisi");
  }

  var sheet = ensureSheet(SHEET_DATA, [
    'tanggal','bulan','bibit','masuk','keluar','mati','total',
    'sumber','tujuan','nomorSurat','statusApproval','approvedBy','approvedAt',
    'statusKirim','kodeVerifikasi','linkPdf','dibuatOleh','driver',
    'statusTerima','namaPenerima','tanggalTerima','jumlahDiterima'
  ]);

  var tanggal    = body.tanggal;
  var date       = new Date(tanggal + 'T00:00:00');
  var bulan      = Utilities.formatDate(date, 'Asia/Makassar', 'MMMM yyyy');
  var masuk      = Number(body.masuk)  || 0;
  var keluar     = Number(body.keluar) || 0;
  var mati       = Number(body.mati)   || 0;
  var total      = masuk - keluar - mati;
  var dibuatOleh = body.dibuatOleh || body.dibuat_oleh || '';
  var newRowNum  = sheet.getLastRow() + 1;

  var nomorSurat     = keluar > 0 ? generateNomorSurat(newRowNum) : '';
  var kodeVerifikasi = keluar > 0 ? generateKodeVerifikasi() : '';

  sheet.appendRow([
    tanggal, bulan, body.bibit, masuk, keluar, mati, total,
    body.sumber || '', body.tujuan || '',
    nomorSurat,
    '',                              // statusApproval
    '',                              // approvedBy
    '',                              // approvedAt
    keluar > 0 ? 'Menunggu' : '',   // statusKirim
    kodeVerifikasi,
    '',                              // linkPdf
    dibuatOleh,
    body.driver || '',
    '',                              // statusTerima
    '',                              // namaPenerima
    '',                              // tanggalTerima
    0                                // jumlahDiterima
  ]);

  return jsonOk({
    message:        'Data berhasil disimpan',
    nomorSurat:     nomorSurat,
    kodeVerifikasi: kodeVerifikasi,
    linkPdf:        ''
  });
}

// ============================================================
// VERIFY — Verifikasi kode QR surat jalan
// ============================================================
function handleVerify(code) {
  var sheet = getSheet(SHEET_DATA);
  if (!sheet) return jsonOk({ valid: false });

  var rows    = sheet.getDataRange().getValues();
  var headers = rows[0].map(function(h) { return String(h).trim(); });
  var kodeIdx = headers.indexOf('kodeVerifikasi');
  if (kodeIdx < 0) return jsonOk({ valid: false });

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][kodeIdx]).trim() !== String(code).trim()) continue;
    var obj = {};
    headers.forEach(function(h, j) { obj[h] = rows[i][j]; });
    return jsonOk({
      valid:          true,
      tanggal:        obj.tanggal        || '',
      bibit:          obj.bibit          || '',
      masuk:          obj.masuk          || 0,
      keluar:         obj.keluar         || 0,
      mati:           obj.mati           || 0,
      sumber:         obj.sumber         || '',
      tujuan:         obj.tujuan         || '',
      kodeVerifikasi: obj.kodeVerifikasi || ''
    });
  }
  return jsonOk({ valid: false });
}

// ============================================================
// APPROVE — Setujui surat jalan
// ============================================================
function handleApprove(body) {
  var sheet = getSheet(SHEET_DATA);
  if (!sheet) return jsonErr('Sheet Data tidak ditemukan');

  var rows    = sheet.getDataRange().getValues();
  var headers = rows[0].map(function(h) { return String(h).trim(); });
  var nomorIdx      = headers.indexOf('nomorSurat');
  var approvalIdx   = headers.indexOf('statusApproval');
  var approvedByIdx = headers.indexOf('approvedBy');
  var approvedAtIdx = headers.indexOf('approvedAt');
  var statusKirimIdx = headers.indexOf('statusKirim');

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][nomorIdx]).trim() !== String(body.nomorSurat).trim()) continue;
    var r = i + 1;
    sheet.getRange(r, approvalIdx    + 1).setValue(body.status     || 'approved');
    sheet.getRange(r, approvedByIdx  + 1).setValue(body.approvedBy || '');
    sheet.getRange(r, approvedAtIdx  + 1).setValue(body.approvedAt || new Date().toISOString());
    sheet.getRange(r, statusKirimIdx + 1).setValue('Disetujui');
    return jsonOk({ message: 'Dokumen disetujui' });
  }
  return jsonErr('Nomor surat tidak ditemukan');
}

// ============================================================
// CONFIRM DELIVERY — Konfirmasi penerimaan bibit
// ============================================================
function handleConfirmDelivery(body) {
  var sheet = getSheet(SHEET_DATA);
  if (!sheet) return jsonErr('Sheet Data tidak ditemukan');

  var rows    = sheet.getDataRange().getValues();
  var headers = rows[0].map(function(h) { return String(h).trim(); });
  var kodeIdx      = headers.indexOf('kodeVerifikasi');
  var statusTerima = headers.indexOf('statusTerima');
  var namaPenerima = headers.indexOf('namaPenerima');
  var tglTerima    = headers.indexOf('tanggalTerima');
  var jmlDiterima  = headers.indexOf('jumlahDiterima');
  var statusKirim  = headers.indexOf('statusKirim');

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][kodeIdx]).trim() !== String(body.kodeVerifikasi).trim()) continue;
    var r   = i + 1;
    var tgl = new Date().toISOString();
    sheet.getRange(r, statusTerima + 1).setValue('Diterima');
    sheet.getRange(r, namaPenerima + 1).setValue(body.namaPenerima || '');
    sheet.getRange(r, tglTerima    + 1).setValue(tgl);
    sheet.getRange(r, jmlDiterima  + 1).setValue(Number(body.jumlahDiterima) || 0);
    sheet.getRange(r, statusKirim  + 1).setValue('Terkirim');
    return jsonOk({ message: 'Penerimaan dikonfirmasi', tanggalTerima: tgl });
  }
  return jsonErr('Kode verifikasi tidak ditemukan');
}

// ============================================================
// DROPDOWNS — Daftar nilai unik dibuatOleh & driver
// ============================================================
function handleGetDropdowns() {
  var sheet = getSheet(SHEET_DATA);
  if (!sheet) return jsonOk({ dibuatOleh: [], driver: [] });

  var rows    = sheet.getDataRange().getValues();
  var headers = rows[0].map(function(h) { return String(h).trim(); });
  var dbIdx   = headers.indexOf('dibuatOleh');
  var drIdx   = headers.indexOf('driver');

  var dbSet = {};
  var drSet = {};
  for (var i = 1; i < rows.length; i++) {
    if (dbIdx >= 0 && rows[i][dbIdx]) dbSet[rows[i][dbIdx]] = true;
    if (drIdx >= 0 && rows[i][drIdx]) drSet[rows[i][drIdx]] = true;
  }

  return jsonOk({
    dibuatOleh: Object.keys(dbSet).sort(),
    driver:     Object.keys(drSet).sort()
  });
}

// ============================================================
// USERS
// Schema: nomorHp(0) | nama(1) | passwordHash(2) | role(3) | status(4) | createdAt(5)
// ============================================================
function getUsersSheet() {
  return ensureSheet(SHEET_USERS, ['nomorHp','nama','passwordHash','role','status','createdAt']);
}

function findUser(nomorHp) {
  var sheet = getUsersSheet();
  var rows  = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() !== String(nomorHp).trim()) continue;
    return {
      _row:         i + 1,
      nomorHp:      String(rows[i][0]).trim(),
      nama:         String(rows[i][1]).trim(),
      passwordHash: String(rows[i][2]).trim(),
      role:         String(rows[i][3]).trim() || 'user',
      status:       String(rows[i][4]).trim() || 'active',
      createdAt:    String(rows[i][5]).trim()
    };
  }
  return null;
}

function handleGetUsers() {
  var sheet = getUsersSheet();
  var rows  = sheet.getDataRange().getValues();
  var users = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    users.push({
      nomorHp:   String(rows[i][0]).trim(),
      nama:      String(rows[i][1]).trim(),
      role:      String(rows[i][3]).trim() || 'user',
      status:    String(rows[i][4]).trim() || 'active',
      createdAt: String(rows[i][5]).trim()
    });
  }
  return jsonOk({ users: users });
}

// ── LOGIN ────────────────────────────────────────────────────
function handleLogin(body) {
  var nomorHp  = (body.nomorHp  || '').trim();
  var password =  body.password || '';

  if (!nomorHp || !password) return jsonErr('Nomor HP dan password wajib diisi');

  var user = findUser(nomorHp);
  if (!user)                                         return jsonErr('Nomor HP atau password salah');
  if (user.status === 'inactive')                    return jsonErr('Akun dinonaktifkan. Hubungi admin.');
  if (user.passwordHash !== hashPassword(password))  return jsonErr('Nomor HP atau password salah');

  return jsonOk({
    user:  { nomorHp: user.nomorHp, nama: user.nama, role: user.role },
    token: generateToken()
  });
}

// ── REGISTER ─────────────────────────────────────────────────
function handleRegister(body) {
  var nomorHp    = (body.nomorHp    || '').trim();
  var nama       = (body.nama       || '').trim();
  var password   =  body.password   || '';
  var inviteCode = (body.inviteCode || '').trim();

  if (!nomorHp || !nama || !password) return jsonErr('Nama, nomor HP, dan password wajib diisi');
  if (password.length < 6)            return jsonErr('Password minimal 6 karakter');
  if (findUser(nomorHp))              return jsonErr('Nomor HP sudah terdaftar');

  var sheet       = getUsersSheet();
  var isFirstUser = sheet.getLastRow() <= 1;
  var role        = isFirstUser ? 'admin' : 'user';

  if (!isFirstUser) {
    if (!inviteCode) return jsonErr('Kode undangan wajib diisi');
    var check = useInviteCode(inviteCode, nomorHp);
    if (!check.valid) return jsonErr(check.error);
  }

  sheet.appendRow([nomorHp, nama, hashPassword(password), role, 'active', new Date().toISOString()]);

  return jsonOk({
    user:  { nomorHp: nomorHp, nama: nama, role: role },
    token: generateToken()
  });
}

// ── SET ROLE ─────────────────────────────────────────────────
function handleSetUserRole(body) {
  var nomorHp = (body.nomorHp || '').trim();
  var role    = body.role === 'admin' ? 'admin' : 'user';
  var user    = findUser(nomorHp);
  if (!user) return jsonErr('Pengguna tidak ditemukan');
  getUsersSheet().getRange(user._row, 4).setValue(role);
  return jsonOk({ message: 'Role diperbarui' });
}

// ── TOGGLE STATUS ────────────────────────────────────────────
function handleToggleUserStatus(body) {
  var nomorHp = (body.nomorHp || '').trim();
  var user    = findUser(nomorHp);
  if (!user) return jsonErr('Pengguna tidak ditemukan');
  var newStatus = user.status === 'active' ? 'inactive' : 'active';
  getUsersSheet().getRange(user._row, 5).setValue(newStatus);
  return jsonOk({ message: 'Status diperbarui', status: newStatus });
}

// ── CHANGE PASSWORD ──────────────────────────────────────────
function handleChangePassword(body) {
  var nomorHp     = (body.nomorHp     || '').trim();
  var oldPassword =  body.oldPassword || '';
  var newPassword =  body.newPassword || '';

  if (!nomorHp || !oldPassword || !newPassword) return jsonErr('Semua field wajib diisi');
  if (newPassword.length < 6) return jsonErr('Password baru minimal 6 karakter');

  var user = findUser(nomorHp);
  if (!user)                                            return jsonErr('Pengguna tidak ditemukan');
  if (user.passwordHash !== hashPassword(oldPassword))  return jsonErr('Password lama salah');

  getUsersSheet().getRange(user._row, 3).setValue(hashPassword(newPassword));
  return jsonOk({ message: 'Password berhasil diubah' });
}

// ============================================================
// OTP — Reset password
// Set FONNTE_TOKEN di Script Properties untuk kirim via WA
// ============================================================
function getOtpSheet() {
  return ensureSheet(SHEET_OTP, ['nomorHp','otp','expiresAt']);
}

function handleRequestOtp(body) {
  var nomorHp = (body.nomorHp || '').trim();
  if (!nomorHp) return jsonErr('Nomor HP wajib diisi');

  var user = findUser(nomorHp);
  if (!user) return jsonErr('Nomor HP tidak terdaftar');

  var otp       = generateOtp();
  var expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  // Hapus OTP lama milik nomor ini
  var sheet = getOtpSheet();
  var rows  = sheet.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]).trim() === nomorHp) sheet.deleteRow(i + 1);
  }
  sheet.appendRow([nomorHp, otp, expiresAt]);

  // Kirim via Fonnte (jika token tersedia di Script Properties)
  var token = PropertiesService.getScriptProperties().getProperty('FONNTE_TOKEN') || '';
  if (token) {
    var nomor = nomorHp.startsWith('0') ? '62' + nomorHp.slice(1) : nomorHp;
    try {
      UrlFetchApp.fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        payload: JSON.stringify({
          target:  nomor,
          message: '*Smart Nursery*\n\nKode OTP Anda: *' + otp + '*\n\nBerlaku 5 menit. Jangan bagikan ke siapapun.'
        }),
        muteHttpExceptions: true
      });
    } catch (e) {
      Logger.log('Fonnte error: ' + e);
    }
  } else {
    Logger.log('[OTP untuk ' + nomorHp + '] Kode: ' + otp + ' — FONNTE_TOKEN belum diset, OTP tidak dikirim via WA.');
  }

  return jsonOk({ message: 'OTP telah dikirim' });
}

function handleResetPassword(body) {
  var nomorHp     = (body.nomorHp     || '').trim();
  var otp         = (body.otp         || '').trim();
  var newPassword =  body.newPassword || '';

  if (!nomorHp || !otp || !newPassword) return jsonErr('Semua field wajib diisi');
  if (newPassword.length < 6)           return jsonErr('Password minimal 6 karakter');

  var sheet = getOtpSheet();
  var rows  = sheet.getDataRange().getValues();

  for (var i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]).trim() !== nomorHp) continue;

    var storedOtp = String(rows[i][1]).trim();
    var expiresAt = new Date(rows[i][2]);

    if (new Date() > expiresAt) {
      sheet.deleteRow(i + 1);
      return jsonErr('OTP sudah kedaluwarsa');
    }
    if (storedOtp !== otp) return jsonErr('OTP tidak valid');

    sheet.deleteRow(i + 1);
    var user = findUser(nomorHp);
    if (!user) return jsonErr('Pengguna tidak ditemukan');
    getUsersSheet().getRange(user._row, 3).setValue(hashPassword(newPassword));
    return jsonOk({ message: 'Password berhasil diubah. Silakan login ulang.' });
  }
  return jsonErr('OTP tidak ditemukan atau sudah kedaluwarsa');
}

// ============================================================
// INVITE CODES
// Schema: code(0) | keterangan(1) | createdAt(2) | isUsed(3) | usedBy(4) | usedAt(5)
// ============================================================
function getInviteSheet() {
  return ensureSheet(SHEET_INVITES, ['code','keterangan','createdAt','isUsed','usedBy','usedAt']);
}

function useInviteCode(code, usedByHp) {
  var sheet = getInviteSheet();
  var rows  = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() !== code) continue;
    var isUsed = rows[i][3];
    if (isUsed === true || isUsed === 'TRUE' || isUsed === 'true') {
      return { valid: false, error: 'Kode undangan sudah digunakan' };
    }
    sheet.getRange(i + 1, 4).setValue(true);
    sheet.getRange(i + 1, 5).setValue(usedByHp);
    sheet.getRange(i + 1, 6).setValue(new Date().toISOString());
    return { valid: true };
  }
  return { valid: false, error: 'Kode undangan tidak valid' };
}

function handleListInviteCodes() {
  var sheet = getInviteSheet();
  var rows  = sheet.getDataRange().getValues();
  var codes = [];

  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    var isUsed = rows[i][3];
    codes.push({
      code:       String(rows[i][0]).trim(),
      keterangan: String(rows[i][1]).trim(),
      createdAt:  String(rows[i][2]).trim(),
      isUsed:     isUsed === true || isUsed === 'TRUE' || isUsed === 'true',
      usedBy:     String(rows[i][4]).trim(),
      usedAt:     String(rows[i][5]).trim()
    });
  }

  codes.sort(function(a, b) {
    if (a.isUsed !== b.isUsed) return a.isUsed ? 1 : -1;
    return b.createdAt > a.createdAt ? 1 : -1;
  });

  return jsonOk({ codes: codes });
}

function handleCreateInviteCode(body) {
  var sheet    = getInviteSheet();
  var rows     = sheet.getDataRange().getValues();
  var existing = rows.slice(1).map(function(r) { return String(r[0]).trim(); });

  var code, attempts = 0;
  do {
    code = generateInviteCode();
    attempts++;
  } while (existing.indexOf(code) >= 0 && attempts < 20);

  sheet.appendRow([code, body.keterangan || '', new Date().toISOString(), false, '', '']);
  return jsonOk({ code: code });
}

function handleDeleteInviteCode(body) {
  var code = (body.code || '').trim();
  if (!code) return jsonErr('Kode tidak boleh kosong');

  var sheet = getInviteSheet();
  var rows  = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() !== code) continue;
    var isUsed = rows[i][3];
    if (isUsed === true || isUsed === 'TRUE' || isUsed === 'true') {
      return jsonErr('Kode yang sudah digunakan tidak dapat dihapus');
    }
    sheet.deleteRow(i + 1);
    return jsonOk({ message: 'Kode dihapus' });
  }
  return jsonErr('Kode tidak ditemukan');
}
