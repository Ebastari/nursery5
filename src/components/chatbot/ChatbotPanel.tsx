import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Loader2, Zap, ArrowLeft, Check, FileText, RotateCcw, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  GREETING,
  STEP_LABELS,
  loadOptions,
  getQuickReplies,
  processStep,
  getSuccessMessage,
  getSuccessStep,
  getSuratJalanQuickReplies,
  processSuratJalanStep,
  emptySuratJalanForm,
  analyzeDeepInfo,
  generateLaporan,
  type Step,
  type FormData,
  type DropdownData,
  type SuratJalanStep,
  type SuratJalanFormData,
} from './chatbotLogic';
import { generateSuratJalanPdf } from '../../utils/generateSuratJalanPdf';
import { api } from '../../data/mockData';
import { submitActivity, invalidateCache, uploadPdfToDrive } from '../../data/api';

// â”€â”€ Montana AI "” Data & Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface NoteItem {
  id: number;
  tanggal: string;
  kategori: string;
  isi: string;
}

interface DosisPhase {
  label: string;
  des: string;
  pupuk: { n: string; d: string; f: string }[];
  ket: string;
}

interface TroubleItem {
  title: string;
  gejala: string;
  penyebab: string[];
  solusi: string[];
}

type QR = { label: string; value: string; variant?: 'primary' | 'danger' };

const NOTE_CATS = ['Penyiraman', 'Pemupukan', 'Hama & Penyakit', 'Kondisi Bibit', 'Cuaca', 'Distribusi', 'Lainnya'];

const DOSIS_DATA: Record<number, DosisPhase> = {
  1: {
    label: 'Fase 1 "” Pembibitan (0"“4 Minggu)',
    des: 'Prioritas: perkecambahan dan pembentukan akar. Bibit dipindah ke polybag pada hari ke-10 hingga ke-14 saat tinggi sekitar 5 cm.',
    pupuk: [
      { n: 'NPK dasar (dicampur media)', d: '0,5 g/polybag', f: 'Sekali saat pengisian polybag' },
      { n: 'Inokulan Rhizobium', d: '3 g/bibit', f: 'Sekali, dicampur ke media saat transplanting' },
      { n: 'NPK cair N:P:K seimbang', d: '0,5 g/L air', f: '1x/minggu mulai hari ke-10' },
    ],
    ket: 'Hindari pupuk N tinggi "” memacu pertumbuhan daun terlalu cepat sehingga akar tidak berkembang optimal. Sumber: Jurnal Biologi Tropis UNRAM 2023.',
  },
  2: {
    label: 'Fase 2 "” Pertumbuhan (4"“8 Minggu)',
    des: 'Prioritas: pertumbuhan vegetatif dan pembentukan daun. Kurangi naungan secara bertahap.',
    pupuk: [
      { n: 'Urea + ZA (rasio 1:2)', d: '1 g/polybag', f: 'Tiap 2 minggu' },
      { n: 'NPK Mutiara 16-16-16', d: '1 g/polybag', f: 'Tiap 2 minggu, selang dengan Urea+ZA' },
      { n: 'Pupuk Organik Cair (POC)', d: '5 ml/L air', f: 'Tiap 2 minggu' },
    ],
    ket: 'Dosis NPK 1 g/polybag terbukti optimal untuk pertumbuhan tinggi sengon di kondisi naungan sedang. Sumber: Jurnal Biologi Tropis UNRAM 2023.',
  },
  3: {
    label: 'Fase 3 "” Penguatan (8"“12 Minggu)',
    des: 'Prioritas: penguatan batang dan aklimatisasi. Kurangi naungan untuk hardening.',
    pupuk: [
      { n: 'ZA + NPK Mutiara (rasio 1:1)', d: '1,5 g/polybag', f: 'Tiap 2 minggu' },
      { n: 'KCl (Kalium Klorida)', d: '0,5"“1 g/polybag', f: '1x per bulan untuk penguatan batang' },
      { n: 'POC fosfat tinggi', d: '7 ml/L air', f: 'Tiap 2 minggu untuk perkembangan akar' },
    ],
    ket: 'Kombinasi ZA:NPK:KCl (rasio 1:1:2) memperkuat jaringan batang dan meningkatkan daya tahan saat pindah tanam.',
  },
  4: {
    label: 'Fase 4 "” Pra-Tanam (lebih dari 12 Minggu)',
    des: 'Prioritas: aklimatisasi lapangan. Standar siap tanam: tinggi minimal 25 cm, diameter minimal 5 mm, umur 3"“3,5 bulan.',
    pupuk: [
      { n: 'Pupuk N (Urea/ZA)', d: 'Dihentikan 2 minggu sebelum tanam', f: '"”' },
      { n: 'Dolomit (jika pH < 5,5)', d: '1 sdm/polybag', f: '1x, periksa pH media terlebih dahulu' },
      { n: 'Mikoriza Arbuskular (AMF)', d: '5"“10 g/polybag', f: '1x saat pindah tanam ke lubang' },
    ],
    ket: 'Inokulasi AMF 5"“10 g/polybag menurunkan insiden penyakit hingga 4x dibanding kontrol. Jangan tanam bibit berumur lebih dari 6 bulan. Sumber: Forest Science and Technology 2024.',
  },
};

const TROUBLE_DATA: Record<string, TroubleItem> = {
  karat: {
    title: 'Karat Tumor (Uromycladium tepperianum / U. falcatariae)',
    gejala: 'Tumor atau gall berwarna oranye-coklat pada daun, batang, dan tangkai. Daun rontok, bibit mati pada serangan berat.',
    penyebab: [
      'Infeksi cendawan Uromycladium falcatariae',
      'Penyebaran melalui spora udara, terutama saat cuaca lembap dan hangat',
      'Tidak ada perlakuan inokulan hayati pada media',
    ],
    solusi: [
      'Aplikasi PGPR (Plant Growth Promoting Rhizobacteria) 5x10^6 cfu/kg "” efektivitas 42,28%, lebih baik dari fungisida kimia',
      'Aplikasi Trichoderma harzianum DT38 atau T. pseudokoningii DT39 sebagai agen hayati',
      'Jika serangan parah: semprot Carbendazim 3 g/L + Mancozeb 3 g/L bergantian tiap minggu',
      'Cabut dan musnahkan bibit bergejala berat segera "” jangan distribusikan ke lapangan',
      'Inokulasi mikoriza arbuskular (AMF) 5"“10 g/polybag terbukti menekan kejadian penyakit 4x lipat',
    ],
  },
  ganoderma: {
    title: 'Busuk Akar Ganoderma (Ganoderma spp.)',
    gejala: 'Daun menguning, layu mendadak, kipas miselium putih di pangkal batang, badan buah keras coklat pada pangkal akar.',
    penyebab: [
      'Sisa tunggul tanaman sebelumnya di lahan nursery',
      'Media polybag tidak disterilisasi sebelum digunakan',
      'Overwatering yang meningkatkan aktivitas patogen tanah',
    ],
    solusi: [
      'Sterilisasi media polybag sebelum digunakan melalui solarisasi atau fumigasi',
      'Aplikasi Trichoderma harzianum (produk: Trichowish atau Kayabio): 10 g/polybag dicampur ke media',
      'Siram larutan Bio-Hara Plus 5 ml/L air, 1x/minggu sebagai agen hayati',
      'Cabut dan bakar tanaman terinfeksi "” jauhkan dari area nursery',
      'Hindari overwatering; pastikan drainase polybag lancar',
    ],
  },
  bercak: {
    title: 'Bercak Daun (Pestalotiopsis spp.)',
    gejala: 'Bercak nekrotik coklat dengan tepi gelap pada daun. Pada serangan lanjut daun mengering dan rontok.',
    penyebab: [
      'Infeksi cendawan Pestalotiopsis',
      'Kelembapan tinggi dan sirkulasi udara yang buruk',
      'Daun basah terlalu lama akibat penyiraman overhead',
    ],
    solusi: [
      'Semprot Carbendazim 3 g/L + Mancozeb 3 g/L (konsentrasi 0,1%) bergantian tiap minggu "” efektivitas 69,3%',
      'Perbaiki sirkulasi udara: atur jarak polybag minimal 10"“15 cm',
      'Hindari menyiram langsung mengenai daun; siram media saja',
      'Buang dan musnahkan daun bergejala berat',
    ],
  },
  rebah: {
    title: 'Rebah Semai / Damping-off (Pythium, Fusarium, Rhizoctonia)',
    gejala: 'Pangkal batang membusuk kecoklatan atau hitam, bibit rebah tiba-tiba meski media terlihat normal.',
    penyebab: [
      'Kelembapan media berlebihan',
      'Media tidak steril mengandung patogen tanah',
      'Suhu dan kelembapan tinggi terutama di musim hujan',
    ],
    solusi: [
      'Pythium/Phytophthora: siram Metalaxyl (Ridomil) 2 g/L "” siram media, jangan daun',
      'Fusarium/Botrytis/Rhizoctonia: siram Thiophanate-methyl 1 g/L',
      'Dithane M-45 (Mancozeb 80% WP) 2 g/L sebagai fungisida kontak preventif',
      'Kurangi penyiraman dan perbaiki drainase polybag (3"“5 lubang dasar)',
      'Sterilisasi media sebelum penggunaan; jangan gunakan tanah kebun mentah',
    ],
  },
  penyiraman: {
    title: 'Masalah Penyiraman',
    gejala: 'Media terlalu kering (tanah pecah-pecah, daun layu pagi) atau terlalu basah (media berlumpur, berbau apek).',
    penyebab: [
      'Jadwal penyiraman tidak teratur',
      'Lubang drainase polybag tersumbat',
      'Cuaca ekstrem "” musim kemarau atau hujan deras',
    ],
    solusi: [
      'Siram 2x/hari: pagi pukul 07.00"“09.00 dan sore pukul 16.00"“17.00',
      'Tes jari: tancapkan 2 cm "” lembap = cukup, kering = siram segera',
      'Buat 3"“5 lubang di dasar polybag jika drainase tersumbat',
      'Saat hujan deras: kurangi frekuensi atau naungi sementara',
    ],
  },
  panas: {
    title: 'Bibit Kepanasan / Daun Terbakar',
    gejala: 'Tepi daun mengering dan kecoklatan, layu di siang hari meski media lembap, pertumbuhan terhenti.',
    penyebab: [
      'Paparan sinar matahari langsung terlalu panjang untuk bibit muda',
      'Suhu lebih dari 35 derajat Celsius tanpa naungan',
      'Radiasi panas dari atap seng atau refleksi permukaan lahan',
    ],
    solusi: [
      'Pasang shading net 30"“50% untuk bibit berumur di bawah 2 bulan',
      'Lakukan misting daun di siang hari (pukul 11.00"“14.00) jika perlu',
      'Pindah ke area naungan saat puncak panas',
      'Bibit berumur di atas 3 bulan dapat terpapar sinar penuh secara bertahap',
    ],
  },
};

const PANDUAN_CONTENT: Record<string, string> = {
  persiapan: '**Persiapan Bibit**\n\nBibit dipindahkan ke polybag pada hari ke-10 hingga ke-14 setelah berkecambah, saat tinggi sekitar 5 cm.\nMedia polybag standar: topsoil : pasir : kompos = 1:1:1. Alternatif terbukti: kompos 40% + arang sekam 20% + tanah 20% (formula KM-3).\nTambahkan inokulan Rhizobium 3 g/bibit dan mikoriza arbuskular 5"“10 g/polybag saat transplanting.\nAdaptasi bibit di area teduh (paranet 50"“75%) selama 7 hari sebelum pindah ke pencahayaan penuh bertahap.\n\nSumber: BPDAS Pontianak; Jurnal Sylva Lestari Unila.',
  potting: '**Proses Potting**\n\nPolybag pembibitan: ukuran 10x15 cm. Pindahkan ke polybag 20x25 cm saat umur 4 minggu.\nIsikan media 3/4 polybag; tanam bibit di tengah; padatkan media ringan di sekitar perakaran.\nRendam benih dalam air 60 derajat Celsius selama 15 menit sebelum semai untuk mematahkan dormansi.\nSiram ringan setelah transplanting; letakkan di naungan 7 hari sebelum aklimatisasi ke sinar penuh.\n\nSumber: BPDASHL Siantan; Jurnal Hutan Lestari Untan.',
  penyiraman: '**Penyiraman dan Pemupukan**\n\nPenyiraman: 2x/hari "” pagi pukul 07.00"“09.00 dan sore pukul 16.00"“17.00.\nMulai hari ke-10 setelah transplanting: NPK cair 0,5 g/L, 1x/minggu.\nFase 4"“8 minggu: NPK Mutiara 16-16-16 dan Urea+ZA (rasio 1:2), dosis 1 g/polybag, tiap 2 minggu.\nPupuk Organik Cair (POC): 5 ml/L, tiap 2 minggu. Semprotkan ke media, bukan langsung ke daun.\nDosis NPK 1 g/polybag terbukti optimal untuk pertumbuhan tinggi sengon.\n\nSumber: Jurnal Biologi Tropis UNRAM 2023.',
  perawatan: '**Perawatan dan Pencahayaan**\n\nBibit di bawah 2 bulan: lindungi dari terik siang dengan paranet 30"“50%.\nBibit di atas 3 bulan: aklimatisasi sinar penuh secara bertahap.\nRotasi posisi polybag minggual agar pertumbuhan merata dan tidak etiolasi.\nPangkas daun kering atau menguning; pastikan drainase tidak tersumbat.\nJarak antar polybag minimal 10"“15 cm untuk sirkulasi udara dan pencegahan penyakit cendawan.',
  tentang: '**Tentang Sengon (Falcataria moluccana)**\n\nFamili Fabaceae, subfamili Mimosoideae. Nama lain: Albasia, Jeungjing, White Albizia.\nPohon legum cepat tumbuh; tinggi 30"“40 m, diameter batang 40"“60 cm.\nToleran pH 5,5"“7,0, suhu tinggi, dan lahan miskin hara.\nSimbiosis dengan Rhizobium menambat nitrogen bebas atmosfer, memperbaiki kesuburan dan struktur agregat tanah.\nCocok sebagai spesies pionir untuk reklamasi lahan pasca tambang.\n\nPilih subtopik di bawah untuk informasi lebih lanjut:',
  spesies: '**Aspek Spesies**\n\nFamili Fabaceae, subfamili Mimosoideae. Tinggi 30"“40 m, diameter batang 40"“60 cm.\nToleran pH 5,5"“7,0; adaptif di suhu tinggi dan lahan miskin hara.\nSimbiosis Rhizobium menambat nitrogen bebas atmosfer. Isolat Rhizobium GR2-7 dan GR3-4 meningkatkan berat kering bibit 132"“167% di tanah Ultisol.\nMikoriza arbuskular (AMF) kolonisasi akar mencapai 3"“82% di kondisi nursery; sangat meningkatkan daya tahan terhadap penyakit.\n\nSumber: Jurnal JURRITEK (Rhizobium lahan bekas tambang); Forest Science and Technology 2024.',
  teknis: '**Aspek Teknis dan Budidaya Lapangan**\n\nSpesies fast growing ideal untuk revegetasi lahan pasca tambang. Pertumbuhan 4"“6 m dalam 12"“18 bulan pertama.\nAkar dalam menahan erosi dan memperbaiki aerasi tanah; serasah mempercepat suksesi vegetasi sekunder.\nJarak tanam: 3x3 m atau 4x4 m (sekitar 625 pohon/ha di jarak 4x4 m).\nLubang tanam: 30x30x30 cm; tambahkan pupuk organik 2"“3 kg dan dolomit 50 g per lubang.\n\nSumber: CIFOR-ICRAF Paraserianthes falcataria Silviculture Review.',
  budidaya: '**Budidaya dan Potting**\n\nMedia polybag optimal: topsoil:kompos:pasir = 1:1:1, pH 5,5"“6,5. Cocopeat 25"“50% dapat menggantikan komponen tanah.\nPolybag 10x15 cm untuk pembibitan; pindah ke 20x25 cm di umur 4 minggu.\nTambahkan inokulan Rhizobium 3 g/bibit dan AMF 5"“10 g/polybag saat transplanting.\nRendam benih air 60 derajat Celsius selama 15 menit sebelum semai.\nKriteria siap tanam: umur 3"“3,5 bulan, tinggi minimal 25 cm, diameter minimal 5 mm, akar sehat tidak melingkar. Jangan tanam bibit berumur lebih dari 6 bulan.\n\nSumber: BPDASHL Siantan; Jurnal Sylva Lestari Unila.',
  revegetasi: '**Revegetasi Pasca Tambang**\n\nSengon berfungsi sebagai spesies pionir. Dalam 12"“18 bulan tumbuh 4"“6 m:\n- Menurunkan suhu permukaan tanah\n- Menahan debu mineral dan partikel tanah\n- Meningkatkan bahan organik melalui serasah\n\nSetelah 3 tahun terbentuk lapisan serasah alami yang mempercepat suksesi vegetasi sekunder.\nRhizobium dan mikoriza sangat penting untuk keberhasilan di lahan terdegradasi.\nTingkat keberhasilan lapangan dengan bibit berinokulasi AMF: lebih dari 90% di lereng 25"“40%.\n\nSumber: Forest Science and Technology 2024; CIFOR-ICRAF.',
  rekomendasi: '**Rekomendasi Singkat**\n\nJarak tanam: 4x4 m "” sekitar 625 pohon/ha\nPupuk dasar: 1 kg/tanaman\nKapur/Dolomit: 10 g/tanaman (sesuaikan dengan pH tanah)\nCover crop: 30 kg/ha\nPupuk organik pra-tanam: 1 ton/ha\nInokulan AMF: 5"“10 g/bibit saat transplanting\nInokulan Rhizobium: 3 g/bibit\n\nSumber: CIFOR-ICRAF Silviculture Review; Jurnal JURRITEK.',
};

const HAMA_CONTENT: Record<string, string> = {
  daun_rusak: '**Ulat / Belalang / Hama Pemakan Daun**\n\nDaun berlubang tidak beraturan atau terpotong rapi pada tepi daun.\n\nTindak lanjut:\n- Semprot pestisida nabati berbahan nimba (azadirachtin) atau bawang putih, 1x/minggu\n- Pasang jaring penahan serangga di area nursery\n- Bersihkan gulma di sekitar polybag yang menjadi tempat persembunyian hama\n\nResep organik: 5 siung bawang putih + 3 cabai, rendam dalam 1 liter air semalam, saring dan semprot ke permukaan daun.',
  daun_kuning: '**Kutu Daun (Aphid) atau Tungau**\n\nDaun menguning, menggulung, atau terdapat bintik-bintik halus. Koloni kutu tampak di bagian bawah daun.\n\nTindak lanjut:\n- Periksa bagian bawah daun; jika ada kutu: semprot larutan sabun insektisida 2 tetes/L, bilas keesokan harinya\n- Kurangi penyiraman jika media selalu basah\n- Tambah POC ringan jika daun pucat merata (kemungkinan defisiensi hara)\n- Imidakloprid 0,5 ml/L jika populasi sangat tinggi dan tidak terkendali',
  embun: '**Embun Tepung (Powdery Mildew)**\n\nLapisan putih keabu-abuan di permukaan daun, umumnya mulai dari daun muda.\n\nTindak lanjut:\n- Tingkatkan sirkulasi udara: atur jarak polybag minimal 10"“15 cm\n- Semprot larutan air dan susu (rasio 9:1 volume) "” terbukti efektif sebagai fungisida organik\n- Hindari menyiram langsung mengenai daun; siram media saja\n- Jika parah: Sulfur 80 WP 2"“3 g/L atau Triadimefon 25 WP 1 g/L',
  layu: '**Layu Fusarium atau Busuk Pangkal Batang**\n\nBibit layu tiba-tiba, pangkal batang gelap atau lembek, akar membusuk.\n\nTindak lanjut:\n- Siram media dengan Thiophanate-methyl 1 g/L untuk Fusarium, Botrytis, dan Rhizoctonia\n- Perbaiki drainase polybag (tambah lubang di dasar)\n- Singkirkan tanaman sakit dari area nursery segera "” jangan tumpuk bersama yang sehat\n- Sterilisasi media polybag baru sebelum digunakan; jangan overwatering',
  akar: '**Rayap atau Orong-orong**\n\nAkar berongga atau terputus, media menggumpal tidak normal, bibit layu tiba-tiba tanpa sebab jelas.\n\nTindak lanjut:\n- Tambahkan dolomit 1 sdm/polybag ke media sebagai pengusir alami\n- Siram larutan rebusan serai 5 batang per 1 liter air di sekitar pangkal media\n- Pasang perangkap lampu sederhana di sekitar nursery untuk rayap bersayap\n- Klopirifos 0,5 ml/L sebagai drenching media jika serangan berat',
};

const SARAN_MSG = `**Roadmap Pengembangan Montana AI**

**1. PWA dan Mode Offline**
Service Worker agar dapat diakses tanpa koneksi internet "” penting untuk nursery di area sinyal lemah.

**2. Sinkronisasi Google Sheets**
Hubungkan catatan dan stok ke endpoint doPost/doGet Google Apps Script yang sudah ada.

**3. Diagnosis Hama via Foto**
Integrasikan Gemini Vision API untuk analisis otomatis dari foto daun atau akar yang diunggah.

**4. Notifikasi Penyiraman**
Web Push Notification dengan Service Worker untuk pengingat jadwal siram dan pemupukan harian.

**5. Ekspor PDF Laporan**
Tombol cetak atau ekspor di menu Laporan menggunakan window.print() dengan CSS media print.

**6. Multi-pengguna**
Manfaatkan sistem autentikasi nomor HP di Google Apps Script untuk catatan per pengguna.

**7. Grafik Tren Stok**
Chart.js untuk visualisasi tren masuk-keluar bibit per bulan dalam bentuk grafik garis.

**8. QR Scanner Bawaan**
Integrasi jsQR untuk memindai kode verifikasi surat jalan langsung dari kamera perangkat.

**9. Asisten Suara**
Web Speech API untuk perintah suara "” berguna saat petugas tidak bisa menyentuh layar.

**10. Tema Terang**
Light mode toggle untuk kondisi outdoor agar layar mudah dibaca saat cuaca terik.`;

// â”€â”€ Helper: format catatan list as text â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildCatatanMsg(list: NoteItem[]): string {
  if (!list.length) {
    return '**Catatan Lapangan**\n\nBelum ada catatan. Gunakan tombol "Tambah Catatan" untuk mulai mencatat.';
  }
  const recent = [...list].slice(-5).reverse();
  let msg = `**Catatan Lapangan** "” ${list.length} catatan (5 terbaru)\n\n`;
  recent.forEach((n, i) => {
    msg += `**${i + 1}. ${n.kategori}** "” ${n.tanggal}\n${n.isi}\n\n`;
  });
  msg += '_Ketik "hapus 1" hingga "hapus 5" untuk menghapus catatan tertentu._';
  return msg;
}

// â”€â”€ Quick reply builders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getPanduanQR(subPage: string): QR[] {
  if (subPage === 'tentang') return [
    { label: 'Aspek Spesies',      value: 'pp_spesies' },
    { label: 'Aspek Teknis',       value: 'pp_teknis' },
    { label: 'Budidaya & Potting', value: 'pp_budidaya' },
    { label: 'Revegetasi Tambang', value: 'pp_revegetasi' },
    { label: 'Rekomendasi',        value: 'pp_rekomendasi' },
    { label: 'Kembali',            value: 'pp_back' },
  ];
  if (subPage === 'hama') return [
    { label: 'Daun berlubang',      value: 'hama_daun_rusak' },
    { label: 'Daun menguning',      value: 'hama_daun_kuning' },
    { label: 'Tepung putih di daun',value: 'hama_embun' },
    { label: 'Layu tiba-tiba',      value: 'hama_layu' },
    { label: 'Akar terganggu',      value: 'hama_akar' },
    { label: 'Kembali',             value: 'pp_back' },
  ];
  if (subPage === 'jadwal') return [
    { label: 'Kembali ke Panduan', value: 'pp_back' },
  ];
  if (subPage !== '') return [
    { label: 'Kembali ke Panduan', value: 'pp_back' },
  ];
  return [
    { label: 'Tentang Sengon',          value: 'pp_tentang' },
    { label: 'Persiapan Bibit',         value: 'pp_persiapan' },
    { label: 'Proses Potting',          value: 'pp_potting' },
    { label: 'Penyiraman & Pemupukan',  value: 'pp_penyiraman' },
    { label: 'Perawatan & Pencahayaan', value: 'pp_perawatan' },
    { label: 'Hama & Penyakit',         value: 'pp_hama' },
    { label: 'Jadwal Monitoring',       value: 'pp_jadwal' },
  ];
}

function getCatatanQR(subPage: string, hasNotes: boolean): QR[] {
  if (subPage === 'choose_kat') return NOTE_CATS.map(k => ({ label: k, value: `kat_${k}` }));
  if (subPage === 'awaiting_note') return [];
  return [
    { label: 'Tambah Catatan', value: 'catatan_tambah', variant: 'primary' as const },
    ...(hasNotes ? [{ label: 'Refresh', value: 'catatan_refresh' }] : []),
    ...(hasNotes ? [{ label: 'Hapus Semua', value: 'catatan_hapus_semua', variant: 'danger' as const }] : []),
  ];
}

function getDosisQR(subPage: string): QR[] {
  if (subPage.startsWith('fase_')) return [
    { label: 'Pilih Fase Lain', value: 'dosis_back' },
  ];
  return [
    { label: 'Fase 1 "” Pembibitan (0"“4 Mgg)',  value: 'dosis_fase_1', variant: 'primary' as const },
    { label: 'Fase 2 "” Pertumbuhan (4"“8 Mgg)', value: 'dosis_fase_2' },
    { label: 'Fase 3 "” Penguatan (8"“12 Mgg)',  value: 'dosis_fase_3' },
    { label: 'Fase 4 "” Pra-Tanam (>12 Mgg)',   value: 'dosis_fase_4' },
  ];
}

function getTroubleQR(subPage: string): QR[] {
  if (subPage === 'saran') return [{ label: 'Kembali ke Troubleshooting', value: 'trouble_back' }];
  if (subPage !== '') return [
    { label: 'Masalah Lain',       value: 'trouble_back' },
    { label: 'Saran Pengembangan', value: 'trouble_saran' },
  ];
  return [
    { label: 'Karat Tumor',          value: 'trouble_karat' },
    { label: 'Busuk Akar Ganoderma', value: 'trouble_ganoderma' },
    { label: 'Bercak Daun',          value: 'trouble_bercak' },
    { label: 'Rebah Semai',          value: 'trouble_rebah' },
    { label: 'Masalah Penyiraman',   value: 'trouble_penyiraman' },
    { label: 'Daun Terbakar',        value: 'trouble_panas' },
    { label: 'Saran Pengembangan',   value: 'trouble_saran' },
  ];
}

const AGENTS = [
  { key: 'input',       label: 'Fast Input' },
  { key: 'surat-jalan', label: 'Surat Jalan' },
  { key: 'info',        label: 'Info Bibit' },
  { key: 'laporan',     label: 'Laporan' },
  { key: 'panduan',     label: 'Panduan' },
  { key: 'catatan',     label: 'Catatan' },
  { key: 'dosis',       label: 'Dosis Pupuk' },
  { key: 'trouble',     label: 'Troubleshoot' },
  { key: 'bantuan',     label: 'Bantuan' },
];

const LOGO = 'https://i.ibb.co/xSTT9wJK/download.png';

const emptyForm: FormData = {
  action: '',
  bibit: '',
  jumlah: '',
  sumber: '',
  tujuan: '',
  dibuatOleh: '',
  driver: '',
};

interface PdfCard {
  url: string;
  name: string;
  nomorSurat: string;
}

interface ChatMsg {
  id: number;
  role: 'bot' | 'user';
  text: string;
  ts: number;
  type?: 'text' | 'pdf-card';
  pdfCard?: PdfCard;
}

function renderMarkdown(text: string) {
  const parts = text.split('\n');
  return parts.map((line, i) => {
    const html = line
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
    return (
      <span key={i}>
        <span dangerouslySetInnerHTML={{ __html: html }} />
        {i < parts.length - 1 && <br />}
      </span>
    );
  });
}

// â”€â”€ Progress bar (only for Fast Input agent) â”€â”€
const STEP_ORDER: Step[] = ['action', 'bibit', 'jumlah', 'sumber', 'tujuan', 'dibuat_oleh', 'driver'];
const SJ_STEP_ORDER: SuratJalanStep[] = ['sj_bibit', 'sj_jumlah', 'sj_sumber', 'sj_tujuan', 'sj_dibuat', 'sj_driver'];

function ProgressBar({ step, sjStep, agent }: { step: Step; sjStep: SuratJalanStep; agent: string }) {
  let progress = 0;
  let label = '';

  if (agent === 'input') {
    const idx = STEP_ORDER.indexOf(step);
    progress =
      step === 'confirm' || step === 'submitting' || step === 'done' || step === 'ask_print'
        ? 100
        : idx >= 0
        ? ((idx + 1) / STEP_ORDER.length) * 100
        : 0;
    label = STEP_LABELS[step] || '';
  } else if (agent === 'surat-jalan') {
    const idx = SJ_STEP_ORDER.indexOf(sjStep);
    const sjLabels: Record<SuratJalanStep, string> = {
      sj_start: 'Memulai',
      sj_bibit: 'Langkah 1 / 6 "” Jenis Bibit',
      sj_jumlah: 'Langkah 2 / 6 "” Jumlah',
      sj_sumber: 'Langkah 3 / 6 "” Sumber',
      sj_tujuan: 'Langkah 4 / 6 "” Tujuan',
      sj_dibuat: 'Langkah 5 / 6 "” Pembuat',
      sj_driver: 'Langkah 6 / 6 "” Driver',
      sj_confirm: 'Konfirmasi',
      sj_done: 'Selesai',
    };
    progress = sjStep === 'sj_confirm' || sjStep === 'sj_done' ? 100 : idx >= 0 ? ((idx + 1) / SJ_STEP_ORDER.length) * 100 : 0;
    label = sjLabels[sjStep] || '';
  }

  if (!label) return null;

  return (
    <div className="px-4 py-2 bg-[#1a1a1a] border-b border-white/5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-gray-400 font-medium">{label}</span>
        <span className="text-[11px] text-gray-500">{Math.round(progress)}%</span>
      </div>
      <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// â”€â”€ PDF Card component â”€â”€
function PdfCardMessage({ card, onDownload }: { card: PdfCard; onDownload: (card: PdfCard) => void }) {
  return (
    <div className="bg-gradient-to-br from-emerald-900/40 to-teal-900/30 border border-emerald-600/30 rounded-2xl p-4 max-w-[85%]">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-600/30 flex items-center justify-center">
          <FileText className="w-4.5 h-4.5 text-emerald-400" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-white">Surat Jalan Siap</p>
          <p className="text-[10px] text-gray-400 font-mono">{card.nomorSurat}</p>
        </div>
      </div>
      <p className="text-[11px] text-gray-400 mb-3">{card.name}</p>
      <div className="flex gap-2">
        <button
          onClick={() => onDownload(card)}
          className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-emerald-600 text-white text-[12px] font-semibold hover:bg-emerald-500 transition"
        >
          <Download className="w-3.5 h-3.5" />
          Download PDF
        </button>
        <button
          onClick={() => window.open(card.url, '_blank')}
          className="flex items-center justify-center gap-1.5 px-3 h-9 rounded-xl bg-white/5 text-gray-300 text-[12px] border border-white/10 hover:bg-white/10 transition"
        >
          Buka
        </button>
      </div>
    </div>
  );
}

// â”€â”€ Dosis calculator form â”€â”€
function DosisForm({ onSubmit }: { onSubmit: (polybag: number, fase: number, hari: number) => void }) {
  const [polybag, setPolybag] = useState('');
  const [fase, setFase] = useState('1');
  const [hari, setHari] = useState('');
  const isValid = polybag !== '' && parseInt(polybag) > 0;

  return (
    <div className="shrink-0 border-t border-white/5 bg-[#1a1a1a] px-4 py-3">
      <p className="text-[11px] font-semibold text-gray-300 mb-2 uppercase tracking-wide">Kalkulator Kebutuhan Pupuk</p>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-gray-500 mb-1 block">Jumlah Polybag</label>
            <input
              type="number"
              value={polybag}
              onChange={e => setPolybag(e.target.value)}
              placeholder="contoh: 500"
              className="w-full bg-[#2f2f2f] text-white text-[12px] rounded-lg px-3 py-2 border border-white/10 outline-none focus:border-emerald-600/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-gray-500 mb-1 block">Umur Bibit (hari)</label>
            <input
              type="number"
              value={hari}
              onChange={e => setHari(e.target.value)}
              placeholder="contoh: 30"
              className="w-full bg-[#2f2f2f] text-white text-[12px] rounded-lg px-3 py-2 border border-white/10 outline-none focus:border-emerald-600/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">Fase Pertumbuhan</label>
          <select
            value={fase}
            onChange={e => setFase(e.target.value)}
            className="w-full bg-[#2f2f2f] text-white text-[12px] rounded-lg px-3 py-2 border border-white/10 outline-none focus:border-emerald-600/50"
          >
            <option value="1">Fase 1 "” Pembibitan (0"“4 minggu)</option>
            <option value="2">Fase 2 "” Pertumbuhan (4"“8 minggu)</option>
            <option value="3">Fase 3 "” Penguatan (8"“12 minggu)</option>
            <option value="4">Fase 4 "” Pra-Tanam (lebih dari 12 minggu)</option>
          </select>
        </div>
        <button
          onClick={() => { if (isValid) onSubmit(parseInt(polybag), parseInt(fase), parseInt(hari || '0')); }}
          disabled={!isValid}
          className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
        >
          Hitung Kebutuhan Pupuk
        </button>
      </div>
    </div>
  );
}

export function ChatbotPanel({ onClose, mode: initialMode = 'input' }: { onClose: () => void; mode?: string }) {
  const [agent, setAgent] = useState<string>(AGENTS.some((a) => a.key === initialMode) ? initialMode : 'input');
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('action');
  const [sjStep, setSjStep] = useState<SuratJalanStep>('sj_start');
  const [sjForm, setSjForm] = useState<SuratJalanFormData>({ ...emptySuratJalanForm });
  const [formData, setFormData] = useState<FormData>({ ...emptyForm });
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [options, setOptions] = useState<DropdownData>({
    bibit: [], sumber: [], tujuan: [], dibuatOleh: [], driver: [],
  });
  const [stokMap, setStokMap] = useState<Record<string, number>>({});
  const [pdfUrl, setPdfUrl] = useState('');
  const [subPage, setSubPage] = useState('');
  const [catatanList, setCatatanList] = useState<NoteItem[]>([]);
  const [pendingKat, setPendingKat] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const nextId = useRef(0);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 60);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const addMsg = useCallback((role: 'bot' | 'user', text: string) => {
    setMessages((prev) => [...prev, { id: nextId.current++, role, text, ts: Date.now() }]);
  }, []);

  // â”€â”€ Agent greeting helper â”€â”€
  const getAgentGreeting = useCallback((agentKey: string): string => {
    switch (agentKey) {
      case 'input':
        return GREETING;
      case 'surat-jalan':
        return 'Selamat datang di **Surat Jalan**.\n\nSaya akan membantu membuat dokumen surat jalan distribusi bibit langkah demi langkah.\n\nPilih jenis bibit yang akan didistribusikan:';
      case 'info':
        return 'Selamat datang di **Info Bibit**.\n\nTanyakan apa saja tentang stok, distribusi, kematian, atau minta analisis mendalam.\n\nContoh:\n- "Analisis lengkap"\n- "Stok kritis"\n- "Tren minggu ini"\n- "Tingkat mortalitas"\n- "Rekomendasi"';
      case 'laporan':
        return 'Selamat datang di **Laporan**.\n\nKetik jenis laporan yang ingin dibuat:\n- "Laporan stok"\n- "Laporan distribusi"\n- "Laporan kematian"\n- "Laporan mingguan"';
      case 'bantuan':
        return 'Selamat datang di **Bantuan**.\n\nSaya siap membantu Anda menggunakan aplikasi Montana Bibit AI.\n\nTopik bantuan:\n- "Cara fast input"\n- "Cara surat jalan"\n- "Cara info bibit"\n- "Cara laporan"';
      case 'panduan':
        return 'Selamat datang di **Panduan Budidaya Sengon**.\n\nPilih topik yang ingin Anda pelajari:';
      case 'catatan':
        return 'Selamat datang di **Catatan Lapangan**.';
      case 'dosis':
        return 'Selamat datang di **Kalkulator Dosis Pupuk Sengon**.\n\nGunakan form di bawah untuk menghitung kebutuhan pupuk berdasarkan jumlah polybag, atau pilih fase untuk melihat panduan dosis:';
      case 'trouble':
        return 'Selamat datang di **Troubleshooting Bibit Sengon**.\n\nIdentifikasi dan atasi masalah umum pada bibit. Pilih gejala yang Anda temukan:';
      default:
        return GREETING;
    }
  }, []);

  // â”€â”€ Init: load options + greeting â”€â”€
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    nextId.current = 0;
    setFormData({ ...emptyForm });
    setSjForm({ ...emptySuratJalanForm });
    setSjStep('sj_start');
    setStep('action');
    setPdfUrl('');
    setInputValue('');
    setSubPage('');
    setPendingKat('');

    (async () => {
      try {
        const result = await loadOptions();
        setOptions(result.options);
        setStokMap(result.stokMap);
      } catch {
        // silently continue with empty options
      }

      const greeting = getAgentGreeting(agent);
      setMessages([{ id: nextId.current++, role: 'bot', text: greeting, ts: Date.now() }]);

      if (agent === 'info') {
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            { id: nextId.current++, role: 'bot', text: '__quickreplies__', ts: Date.now() },
          ]);
        }, 150);
      }

      if (agent === 'catatan') {
        try {
          const stored = localStorage.getItem('montana_catatan');
          const loaded: NoteItem[] = stored ? JSON.parse(stored) : [];
          setCatatanList(loaded);
          setMessages((prev) => [
            ...prev,
            { id: nextId.current++, role: 'bot', text: buildCatatanMsg(loaded), ts: Date.now() },
          ]);
        } catch {
          setCatatanList([]);
        }
      }

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent]);

  // â”€â”€ Submit data (Fast Input) â”€â”€
  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setStep('submitting');
    addMsg('bot', 'Menyimpan dan mengirim data...');

    try {
      const tanggal = new Date().toISOString().split('T')[0];
      const record = {
        tanggal,
        bibit: formData.bibit,
        masuk: formData.action === 'masuk' ? Number(formData.jumlah) : 0,
        keluar: formData.action === 'keluar' ? Number(formData.jumlah) : 0,
        mati: formData.action === 'mati' ? Number(formData.jumlah) : 0,
        sumber: formData.sumber,
        tujuan: formData.tujuan,
        dibuatOleh: formData.dibuatOleh,
        driver: formData.driver,
      };

      const result = await api.submitActivity(record);
      const successStep = getSuccessStep(formData);
      const successMsg = getSuccessMessage(formData);

      let summary = 'Data berhasil disimpan. Ringkasan:\n';
      summary += `Aktivitas: **${formData.action.toUpperCase()}**\n`;
      summary += `Bibit: **${formData.bibit}**\n`;
      summary += `Jumlah: **${formData.jumlah}** bibit\n`;
      summary += `Sumber: **${formData.sumber}**\n`;
      if (formData.action === 'keluar') {
        summary += `Tujuan: **${formData.tujuan}**\n`;
        summary += `Dibuat oleh: **${formData.dibuatOleh}**\n`;
        summary += `Driver: **${formData.driver}**\n`;
      }
      if (result.linkPdf) {
        setPdfUrl(result.linkPdf);
        summary += `\nSurat Jalan (PDF): ${result.linkPdf}`;
      }
      addMsg('bot', summary);
      addMsg('bot', successMsg);
      setStep(successStep);
    } catch (err: unknown) {
      addMsg('bot', `Gagal menyimpan data: ${err instanceof Error ? err.message : 'Terjadi kesalahan'}\n\nSilakan coba lagi.`);
      setStep('confirm');
    }

    setSubmitting(false);
  }, [formData, addMsg]);

  // â”€â”€ Reset Fast Input â”€â”€
  const resetAll = useCallback(() => {
    setFormData({ ...emptyForm });
    setPdfUrl('');
    setMessages([]);
    nextId.current = 0;
    addMsg('bot', GREETING);
    setStep('action');
    setInputValue('');
  }, [addMsg]);

  // â”€â”€ Generate PDF inline (Surat Jalan agent) â”€â”€
  const generateInlinePdf = useCallback(async (form: SuratJalanFormData) => {
    setSubmitting(true);
    addMsg('bot', 'Menyimpan data dan membuat dokumen Surat Jalan...');

    try {
      const d = new Date();
      const jumlah = Number(form.jumlah);
      const tanggal = d.toISOString().split('T')[0];
      const tanggalFormatted = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

      // 1. Simpan ke Google Sheets — supaya muncul di panel home
      const result = await submitActivity({
        tanggal,
        bibit: form.bibit,
        masuk: 0,
        keluar: jumlah,
        mati: 0,
        sumber: form.sumber,
        tujuan: form.tujuan,
        dibuatOleh: form.dibuatOleh,
        driver: form.driver,
      });

      // Gunakan nomorSurat & kodeVerifikasi dari server agar konsisten dengan data di home
      const bulanRomawi = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
      const nomorSurat = result.nomorSurat
        ?? `SJ-BIBIT/${String(Math.floor(Math.random() * 9000) + 1000)}/${bulanRomawi[d.getMonth()]}/${d.getFullYear()}`;
      const kodeVerifikasi = result.kodeVerifikasi
        ?? Math.random().toString(36).substring(2, 10).toUpperCase();

      // 2. Invalidate cache supaya SuratJalanScreen & home langsung tampil data baru
      invalidateCache();

      // 3. Load logo
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
          img.src = LOGO;
        });
      } catch { /* lanjut tanpa logo */ }

      const sisaStok = Math.max(0, (stokMap[form.bibit.toUpperCase()] ?? 0) - jumlah);

      // 4. Generate PDF dengan data yang sama persis seperti yang tersimpan di server
      const pdfBlob = await generateSuratJalanPdf({
        nomorSurat,
        tanggal: tanggalFormatted,
        jenisBibit: form.bibit,
        jumlah,
        sumber: form.sumber,
        tujuan: form.tujuan,
        sisaStok,
        dibuatOleh: form.dibuatOleh,
        disetujuiOleh: '',
        driver: form.driver,
        kodeVerifikasi,
        logoDataUrl,
        isDraft: false,
        companyName: 'PT Energi Batubara Lestari',
        companyUnit: 'Unit Nursery',
        companyAddress: 'Kalimantan Selatan',
      });

      const pdfName = `Surat-Jalan-${nomorSurat.replace(/\//g, '-')}.pdf`;
      const blobUrl = URL.createObjectURL(pdfBlob);

      // Upload ke Drive di background — tidak blokir user
      uploadPdfToDrive(pdfBlob, pdfName, nomorSurat).catch(() => {});

      addMsg('bot', `**Surat Jalan berhasil dibuat dan tersimpan.**\nNo: **${nomorSurat}**\nKode Verifikasi: \`${kodeVerifikasi}\`\n\nData sudah muncul di panel Surat Jalan.`);

      setMessages((prev) => [
        ...prev,
        {
          id: nextId.current++,
          role: 'bot',
          text: '',
          ts: Date.now(),
          type: 'pdf-card' as const,
          pdfCard: { url: blobUrl, name: pdfName, nomorSurat },
        },
      ]);

      setSjStep('sj_done');
    } catch (err: unknown) {
      addMsg('bot', `Gagal membuat Surat Jalan: ${err instanceof Error ? err.message : 'Error tidak diketahui'}\n\nSilakan coba lagi.`);
    }

    setSubmitting(false);
  }, [stokMap, addMsg]);

  // â”€â”€ Handle download from PDF card â”€â”€
  const handlePdfDownload = useCallback((card: PdfCard) => {
    const a = document.createElement('a');
    a.href = card.url;
    a.download = card.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  // â”€â”€ Dosis form calculation â”€â”€
  const handleDosisCalc = useCallback((polybag: number, fase: number, hari: number) => {
    const d = DOSIS_DATA[fase];
    if (!d || polybag <= 0) return;
    const userMsg = `Hitung: ${polybag.toLocaleString('id-ID')} polybag, Fase ${fase}${hari > 0 ? `, umur ${hari} hari` : ''}`;
    addMsg('user', userMsg);
    let msg = `**Hasil Kalkulator Pupuk**\n\n${polybag.toLocaleString('id-ID')} polybag | ${d.label}${hari > 0 ? ` | ${hari} hari` : ''}\n\n**Kebutuhan per Aplikasi:**`;
    d.pupuk.forEach((p) => {
      const nm = p.d.match(/([\d.,]+)/);
      const numVal = nm ? parseFloat(nm[1].replace(',', '.')) : 0;
      const unit = p.d.replace(/[\d.,\s]+/, '').split('/')[0].trim();
      const total = numVal > 0 ? (numVal * polybag).toLocaleString('id-ID') : '"”';
      msg += `\n\n**${p.n}**\nPer polybag: ${p.d}\nTotal: **${total} ${unit}**\nFrekuensi: ${p.f}`;
    });
    msg += `\n\nCatatan: ${d.ket}`;
    addMsg('bot', msg);
  }, [addMsg]);

  // â”€â”€ Main input handler â”€â”€
  const handleInput = useCallback(async (value: string, displayText?: string) => {
    if (submitting || loading) return;
    addMsg('user', displayText || value);

    // â”€â”€ Info Bibit agent â”€â”€
    if (agent === 'info') {
      const q = value.toLowerCase();

      // Try deep analysis first
      if (
        q.includes('analisis') || q.includes('laporan') || q.includes('ringkasan') ||
        q.includes('kritis') || q.includes('menipis') || q.includes('habis') ||
        q.includes('mortalitas') || q.includes('tingkat kematian') || q.includes('persentase') ||
        q.includes('tren') || q.includes('minggu') || q.includes('7 hari') ||
        q.includes('performa') || q.includes('ranking') || q.includes('terbaik') ||
        q.includes('rekomen') || q.includes('saran') || q.includes('top') ||
        q.includes('terbanyak') || q.includes('bandingkan') || q.includes('semua data')
      ) {
        addMsg('bot', 'Menganalisis data...');
        const analysis = await analyzeDeepInfo(value, options, stokMap);
        if (analysis) {
          // Remove the "Menganalisis..." message and replace with result
          setMessages((prev) => {
            const withoutLoader = prev.slice(0, -1);
            return [
              ...withoutLoader,
              {
                id: nextId.current++,
                role: 'bot',
                text: `**${analysis.title}**\n\n${analysis.body}`,
                ts: Date.now(),
              },
            ];
          });
          return;
        }
        // Remove loader if no result
        setMessages((prev) => prev.slice(0, -1));
      }

      // Basic stok queries
      if (q.includes('stok')) {
        if (q.includes('hari ini') || q.includes('semua') || q === 'stok') {
          let msg = '**Stok Bibit per Jenis (Saat Ini):**\n';
          let total = 0;
          options.bibit.forEach((b) => {
            const stok = stokMap[b.toUpperCase()] || 0;
            total += stok;
            const badge = stok <= 0 ? '[Habis]' : stok < 1000 ? '[Menipis]' : '[Aman]';
            msg += `${badge} ${b}: **${stok.toLocaleString('id-ID')}** bibit\n`;
          });
          msg += `\n**Total Stok: ${total.toLocaleString('id-ID')} bibit**`;
          addMsg('bot', msg);
        } else {
          const found = options.bibit.find((b) => q.includes(b.toLowerCase()));
          if (found) {
            const stok = stokMap[found.toUpperCase()] || 0;
            const badge = stok <= 0 ? 'Habis' : stok < 500 ? 'Kritis' : stok < 1000 ? 'Menipis' : 'Aman';
            addMsg('bot', `**${found}**\nStok: **${stok.toLocaleString('id-ID')}** bibit "” ${badge}`);
          } else {
            addMsg('bot', 'Silakan sebutkan nama bibit yang ingin dicek stoknya.\nContoh: "Stok SENGON POTTING" atau "Stok semua bibit".');
          }
        }
        return;
      }

      if (q.includes('mati') || q.includes('kematian')) {
        try {
          const { fetchApiData } = await import('../../data/api');
          const apiRows = await fetchApiData();
          const kematianMap: Record<string, number> = {};
          apiRows.forEach((row) => {
            const key = row.bibit.trim().toUpperCase();
            if (!kematianMap[key]) kematianMap[key] = 0;
            kematianMap[key] += row.mati || 0;
          });
          let msg = '**Jumlah Kematian Bibit per Jenis:**\n';
          let total = 0;
          options.bibit.forEach((b) => {
            const mati = kematianMap[b.toUpperCase()] || 0;
            total += mati;
            if (mati > 0) msg += `• **${b}**: ${mati.toLocaleString('id-ID')} bibit\n`;
          });
          msg += `\n**Total Kematian: ${total.toLocaleString('id-ID')} bibit**`;
          msg += '\n\nKetik **"tingkat kematian"** untuk melihat analisis mortalitas.';
          addMsg('bot', msg);
        } catch {
          addMsg('bot', 'Gagal mengambil data kematian bibit.');
        }
        return;
      }

      if (q.includes('distribusi') || q.includes('tujuan') || q.includes('tim')) {
        const timMatch = q.match(/tim\s+([a-zA-Z0-9]+)/);
        let timName = timMatch ? timMatch[1].toUpperCase() : '';
        if (!timName) {
          const keMatch = q.match(/ke\s+([a-zA-Z0-9]+)/);
          if (keMatch) timName = keMatch[1].toUpperCase();
        }
        if (timName) {
          try {
            const { fetchApiData } = await import('../../data/api');
            const apiRows = await fetchApiData();
            const rowsTim = apiRows.filter(
              (row) => row.tujuan && row.tujuan.toUpperCase().includes('TIM ' + timName)
            );
            if (rowsTim.length === 0) {
              addMsg('bot', `Tidak ditemukan data distribusi ke Tim ${timName.charAt(0) + timName.slice(1).toLowerCase()}.`);
              return;
            }
            const rekap: Record<string, number> = {};
            rowsTim.forEach((row) => {
              const key = row.bibit.trim();
              if (!rekap[key]) rekap[key] = 0;
              rekap[key] += row.keluar || 0;
            });
            let msg = `**Distribusi ke Tim ${timName.charAt(0) + timName.slice(1).toLowerCase()}:**\n`;
            Object.keys(rekap).sort().forEach((b: string) => {
              msg += `• ${b}: ${rekap[b].toLocaleString('id-ID')} bibit\n`;
            });
            msg += `\nTotal: ${rowsTim.reduce((a, b) => a + (b.keluar || 0), 0).toLocaleString('id-ID')} bibit`;
            addMsg('bot', msg);
          } catch {
            addMsg('bot', 'Gagal mengambil data distribusi tim.');
          }
        } else {
          addMsg('bot', 'Ketik **"performa distribusi"** untuk melihat ranking semua tim, atau sebutkan nama tim.\nContoh: "Distribusi ke Tim Basri".');
        }
        return;
      }

      addMsg(
        'bot',
        'Saya belum memahami pertanyaan tersebut.\n\nCoba ketik:\n• "Analisis lengkap"\n• "Stok semua bibit"\n• "Bibit kritis"\n• "Tingkat kematian"\n• "Tren minggu ini"\n• "Performa distribusi"\n• "Rekomendasi"'
      );
      return;
    }

    // â”€â”€ Laporan agent â”€â”€
    if (agent === 'laporan') {
      const result = await generateLaporan(value, options, stokMap);
      addMsg('bot', result);
      return;
    }

    // â”€â”€ Bantuan agent â”€â”€
    if (agent === 'bantuan') {
      const q = value.toLowerCase();
      if (q.includes('fast input') || q.includes('catat') || (q.includes('input') && !q.includes('surat'))) {
        addMsg('bot',
          '**Cara Menggunakan Fast Input:**\n\n' +
          '1. Buka tab **"Fast Input"**\n' +
          '2. Pilih jenis aktivitas: Masuk / Keluar / Mati\n' +
          '3. Pilih jenis bibit dari daftar\n' +
          '4. Masukkan jumlah bibit\n' +
          '5. Pilih sumber dan tujuan\n' +
          '6. Konfirmasi dan kirim\n\n' +
          'Data tersimpan otomatis ke Google Sheets dan notifikasi terkirim ke WhatsApp.'
        );
        return;
      }
      if (q.includes('surat jalan') || q.includes('sj') || q.includes('dokumen')) {
        addMsg('bot',
          '**Cara Membuat Surat Jalan:**\n\n' +
          '1. Buka tab **"Surat Jalan"**\n' +
          '2. Pilih jenis bibit yang akan dikirim\n' +
          '3. Masukkan jumlah (angka)\n' +
          '4. Pilih sumber â†’ tujuan â†’ pembuat â†’ driver\n' +
          '5. Tekan **"Buat Surat Jalan (PDF)"**\n' +
          '6. Download PDF langsung dari chat!\n\n' +
          'Dokumen mencakup QR code verifikasi dan tanda tangan resmi.'
        );
        return;
      }
      if (q.includes('info') || q.includes('analisis') || q.includes('stok')) {
        addMsg('bot',
          '**Cara Menggunakan Info Bibit:**\n\n' +
          'Ketik pertanyaan natural di tab **"Info Bibit"**:\n\n' +
          'Analisis: "Analisis lengkap", "Ringkasan data"\n' +
          'Kritis: "Bibit kritis", "Stok menipis"\n' +
          'Mortalitas: "Tingkat kematian", "Mortalitas"\n' +
          'Tren: "Tren minggu ini", "7 hari terakhir"\n' +
          'Distribusi: "Performa distribusi", "Ranking tim"\n' +
          'Saran: "Rekomendasi", "Apa yang harus dilakukan"'
        );
        return;
      }
      if (q.includes('laporan')) {
        addMsg('bot',
          '**Cara Menggunakan Laporan:**\n\n' +
          'Buka tab **"Laporan"** dan ketik:\n\n' +
          '• "Laporan stok" "” ringkasan stok semua bibit\n' +
          '• "Laporan distribusi" "” rekap pengiriman ke semua tujuan\n' +
          '• "Laporan kematian" "” rekap kematian per bibit + mortalitas\n' +
          '• "Laporan mingguan" "” aktivitas 7 hari terakhir'
        );
        return;
      }
      addMsg('bot',
        '**Bantuan Tersedia:**\n\n' +
        '- **Fast Input** "” Catat bibit masuk/keluar/mati\n' +
        '- **Surat Jalan** "” Buat dokumen distribusi PDF\n' +
        '- **Info Bibit** "” Analisis stok dan distribusi mendalam\n' +
        '- **Laporan** "” Rekap data bibit\n\n' +
        'Ketik nama topik untuk panduan lengkap.\nContoh: _"Cara surat jalan"_, _"Cara laporan"_'
      );
      return;
    }

    // â”€â”€ Panduan agent â”€â”€
    if (agent === 'panduan') {
      if (value === 'pp_back') {
        setSubPage('');
        addMsg('bot', '**Panduan Budidaya Sengon**\n\nPilih topik yang ingin Anda pelajari:');
        return;
      }
      if (value.startsWith('pp_')) {
        const key = value.replace('pp_', '');
        if (key === 'hama') {
          setSubPage('hama');
          addMsg('bot', '**Hama & Penyakit Bibit Sengon**\n\nPilih gejala yang Anda temukan:');
          return;
        }
        if (key === 'jadwal') {
          setSubPage('jadwal');
          addMsg('bot', '**Jadwal Monitoring Bibit**\n\nMasukkan tanggal semai dalam format **DD/MM/YYYY**:\n\nContoh: _12/05/2025_');
          return;
        }
        if (key in PANDUAN_CONTENT) {
          setSubPage(key);
          addMsg('bot', PANDUAN_CONTENT[key]);
          return;
        }
      }
      if (value.startsWith('hama_')) {
        const key = value.replace('hama_', '');
        if (key in HAMA_CONTENT) {
          setSubPage('hama_detail');
          addMsg('bot', HAMA_CONTENT[key]);
          return;
        }
      }
      if (subPage === 'jadwal') {
        const dm = value.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
        if (dm) {
          const day = parseInt(dm[1]);
          const month = parseInt(dm[2]) - 1;
          const yr = parseInt(dm[3]) < 100 ? 2000 + parseInt(dm[3]) : parseInt(dm[3]);
          const semai = new Date(yr, month, day);
          const daysOld = Math.max(0, Math.floor((Date.now() - semai.getTime()) / 86400000));
          const wk = Math.floor(daysOld / 7);
          const phase =
            daysOld < 28 ? 'Fase 1 "” Pembibitan' :
            daysOld < 56 ? 'Fase 2 "” Pertumbuhan' :
            daysOld < 84 ? 'Fase 3 "” Penguatan' : 'Fase 4 "” Pra-Tanam';
          const addD = (n: number) => {
            const r = new Date(semai); r.setDate(r.getDate() + n);
            return r.toLocaleDateString('id-ID');
          };
          let msg = `**Jadwal Monitoring Bibit**\n\n`;
          msg += `Semai: ${semai.toLocaleDateString('id-ID')}\n`;
          msg += `Umur: **${daysOld} hari** (${wk} minggu)\n`;
          msg += `Fase: **${phase}**\n\n`;
          msg += `**Jadwal Penting:**\n`;
          msg += `- Pupuk pertama: ${addD(10)}\n`;
          msg += `- Pindah polybag besar: ${addD(28)}\n`;
          msg += `- Aklimatisasi sinar: ${addD(56)}\n`;
          msg += `- Siap tanam lapangan: ${addD(84)}\n\n`;
          msg += `_Siram rutin 2x/hari; cek hama tiap Senin pagi._`;
          addMsg('bot', msg);
          return;
        }
        addMsg('bot', 'Format tidak dikenali. Coba: **DD/MM/YYYY**\nContoh: _12/05/2025_');
        return;
      }
      addMsg('bot', 'Pilih topik dari menu di bawah ini:');
      return;
    }

    // â”€â”€ Catatan agent â”€â”€
    if (agent === 'catatan') {
      if (value === 'catatan_tambah') {
        setSubPage('choose_kat');
        addMsg('bot', 'Pilih **kategori** catatan Anda:');
        return;
      }
      if (value === 'catatan_refresh') {
        try {
          const stored = localStorage.getItem('montana_catatan');
          const loaded: NoteItem[] = stored ? JSON.parse(stored) : [];
          setCatatanList(loaded);
          addMsg('bot', buildCatatanMsg(loaded));
        } catch { addMsg('bot', 'Gagal memuat catatan.'); }
        return;
      }
      if (value === 'catatan_hapus_semua') {
        localStorage.removeItem('montana_catatan');
        setCatatanList([]);
        setSubPage('');
        addMsg('bot', 'Semua catatan telah dihapus.');
        return;
      }
      if (value.startsWith('kat_')) {
        const kat = value.replace('kat_', '');
        setPendingKat(kat);
        setSubPage('awaiting_note');
        addMsg('bot', `Kategori: **${kat}**\n\nTulis isi catatan Anda dan tekan kirim:`);
        return;
      }
      if (subPage === 'awaiting_note') {
        const now = new Date();
        const tanggal = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        const newNote: NoteItem = { id: Date.now(), tanggal, kategori: pendingKat, isi: value };
        const updated = [...catatanList, newNote];
        localStorage.setItem('montana_catatan', JSON.stringify(updated));
        setCatatanList(updated);
        setPendingKat('');
        setSubPage('');
        addMsg('bot', `Catatan tersimpan.\n\n**${newNote.kategori}** "” ${tanggal}\n${value}`);
        return;
      }
      const hapusM = value.toLowerCase().match(/^hapus\s+(\d+)$/);
      if (hapusM) {
        const idx = parseInt(hapusM[1]) - 1;
        const recent = [...catatanList].slice(-5).reverse();
        if (idx >= 0 && idx < recent.length) {
          const toRemove = recent[idx];
          const updated = catatanList.filter((n) => n.id !== toRemove.id);
          localStorage.setItem('montana_catatan', JSON.stringify(updated));
          setCatatanList(updated);
          addMsg('bot', `Catatan dihapus.\n\n${buildCatatanMsg(updated)}`);
        } else {
          addMsg('bot', 'Nomor tidak valid. Ketik "hapus 1" hingga "hapus 5".');
        }
        return;
      }
      addMsg('bot', buildCatatanMsg(catatanList));
      return;
    }

    // â”€â”€ Dosis agent â”€â”€
    if (agent === 'dosis') {
      if (value === 'dosis_back') {
        setSubPage('');
        addMsg('bot', 'Pilih fase pertumbuhan untuk melihat panduan dosis:');
        return;
      }
      if (value.startsWith('dosis_fase_')) {
        const fase = parseInt(value.replace('dosis_fase_', ''));
        const d = DOSIS_DATA[fase];
        if (d) {
          setSubPage(`fase_${fase}`);
          let msg = `**${d.label}**\n\n${d.des}\n\n**Jadwal Pemupukan:**`;
          d.pupuk.forEach((p) => { msg += `\n\n**${p.n}**\nDosis: ${p.d}\nFrekuensi: ${p.f}`; });
          msg += `\n\nCatatan: ${d.ket}`;
          addMsg('bot', msg);
          return;
        }
      }
      addMsg('bot', 'Pilih fase dari menu di bawah, atau gunakan form kalkulator untuk menghitung kebutuhan pupuk total.');
      return;
    }

    // â”€â”€ Trouble agent â”€â”€
    if (agent === 'trouble') {
      if (value === 'trouble_back') {
        setSubPage('');
        addMsg('bot', 'Pilih masalah yang Anda temukan:');
        return;
      }
      if (value === 'trouble_saran') {
        setSubPage('saran');
        addMsg('bot', SARAN_MSG);
        return;
      }
      if (value.startsWith('trouble_')) {
        const key = value.replace('trouble_', '');
        const t = TROUBLE_DATA[key];
        if (t) {
          setSubPage(key);
          let msg = `${t.title}\n\n**Gejala:** ${t.gejala}\n\n**Penyebab:**`;
          t.penyebab.forEach((p) => { msg += `\n• ${p}`; });
          msg += `\n\n**Solusi:**`;
          t.solusi.forEach((s, i) => { msg += `\n${i + 1}. ${s}`; });
          addMsg('bot', msg);
          return;
        }
      }
      addMsg('bot', 'Pilih gejala dari menu di bawah untuk solusi cepat:');
      return;
    }

    // â”€â”€ Surat Jalan agent â”€â”€
    if (agent === 'surat-jalan') {
      if (value === 'reset_sj') {
        setSjForm({ ...emptySuratJalanForm });
        setSjStep('sj_start');
        addMsg('bot', 'Input diulang.\n\nPilih jenis bibit yang akan didistribusikan:');
        return;
      }
      if (value === 'new_sj') {
        setSjForm({ ...emptySuratJalanForm });
        setSjStep('sj_start');
        addMsg('bot', 'Membuat Surat Jalan baru.\n\nPilih jenis bibit:');
        return;
      }
      if (value === 'generate_pdf') {
        await generateInlinePdf(sjForm);
        return;
      }

      const result = processSuratJalanStep(sjStep, value, sjForm, stokMap);
      if (!result) {
        addMsg('bot', 'Input tidak valid. Silakan pilih dari opsi yang tersedia atau ketik nilai yang benar.');
        return;
      }
      setSjForm((prev) => ({ ...prev, ...result.updatedForm }));
      addMsg('bot', result.message);
      setSjStep(result.nextStep);
      return;
    }

    // â”€â”€ Fast Input agent â”€â”€
    if (step === 'confirm') {
      if (value === 'reset') { resetAll(); return; }
      if (value === 'submit') { await handleSubmit(); return; }
      return;
    }
    if (step === 'ask_print') {
      if (value === 'print') {
        if (pdfUrl) {
          window.open(pdfUrl, '_blank');
          addMsg('bot', 'Surat Jalan telah dibuka.\n\nTerima kasih menggunakan Fast Input.');
        } else {
          const params = new URLSearchParams({
            bibit: formData.bibit,
            jumlah: formData.jumlah,
            sumber: formData.sumber,
            tujuan: formData.tujuan,
            dibuatOleh: formData.dibuatOleh,
            driver: formData.driver,
          });
          navigate(`/surat-jalan?${params.toString()}`);
          onClose();
        }
        return;
      }
      if (value === 'new') { resetAll(); return; }
      if (value === 'close') { onClose(); return; }
      return;
    }
    if (step === 'done') {
      if (value === 'new') { resetAll(); return; }
      return;
    }

    const result = processStep(step, value, formData, stokMap);
    if (!result) {
      addMsg('bot', 'Masukan tidak valid. Silakan coba lagi.');
      return;
    }
    setFormData((prev) => ({ ...prev, ...result.updatedForm }));
    addMsg('bot', result.message);
    setStep(result.nextStep);
  }, [
    step, sjStep, sjForm, formData, stokMap, submitting, loading,
    pdfUrl, navigate, onClose, addMsg, agent, options,
    handleSubmit, resetAll, generateInlinePdf,
    subPage, catatanList, pendingKat,
  ]);

  // â”€â”€ Quick replies â”€â”€
  const infoQuickReplies = [
    { label: 'Analisis lengkap', value: 'Analisis lengkap', variant: 'primary' as const },
    { label: 'Stok hari ini', value: 'Stok hari ini' },
    { label: 'Bibit kritis', value: 'Bibit kritis' },
    { label: 'Tren minggu ini', value: 'Tren minggu ini' },
    { label: 'Tingkat kematian', value: 'Tingkat kematian' },
    { label: 'Performa distribusi', value: 'Performa distribusi' },
    { label: 'Rekomendasi', value: 'Rekomendasi' },
  ];

  const laporanQuickReplies = [
    { label: 'Laporan stok', value: 'laporan stok', variant: 'primary' as const },
    { label: 'Laporan distribusi', value: 'laporan distribusi' },
    { label: 'Laporan kematian', value: 'laporan kematian' },
    { label: 'Laporan mingguan', value: 'laporan mingguan' },
  ];

  const bantuanQuickReplies = [
    { label: 'Cara Fast Input', value: 'Cara fast input', variant: 'primary' as const },
    { label: 'Cara Surat Jalan', value: 'Cara surat jalan' },
    { label: 'Cara Info Bibit', value: 'Cara info bibit' },
    { label: 'Cara Laporan', value: 'Cara laporan' },
  ];

  const quickReplies =
    agent === 'panduan' ? getPanduanQR(subPage) :
    agent === 'catatan' ? getCatatanQR(subPage, catatanList.length > 0) :
    agent === 'dosis' ? getDosisQR(subPage) :
    agent === 'trouble' ? getTroubleQR(subPage) :
    agent === 'info' ? infoQuickReplies :
    agent === 'laporan' ? laporanQuickReplies :
    agent === 'bantuan' ? bantuanQuickReplies :
    agent === 'surat-jalan' ? getSuratJalanQuickReplies(sjStep, options, stokMap) :
    getQuickReplies(step, options, stokMap);

  const isNumberInput = (agent === 'input' && step === 'jumlah') || (agent === 'surat-jalan' && sjStep === 'sj_jumlah');

  const inputPlaceholder =
    agent === 'panduan' && subPage === 'jadwal' ? 'Tanggal semai (DD/MM/YYYY)...' :
    agent === 'catatan' && subPage === 'awaiting_note' ? 'Tulis catatan Anda...' :
    agent === 'dosis' ? 'Pilih fase di atas atau gunakan kalkulator...' :
    agent === 'info' ? 'Tanya stok, analisis, distribusi...' :
    agent === 'laporan' ? 'Ketik jenis laporan...' :
    agent === 'bantuan' ? 'Ketik topik bantuan...' :
    agent === 'surat-jalan' && sjStep === 'sj_jumlah' ? 'Masukkan jumlah polybag...' :
    isNumberInput ? 'Masukkan jumlah bibit...' :
    'Ketik pesan...';

  const handleTextSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setInputValue('');
    handleInput(trimmed);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 30, scale: 0.92 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[200] flex flex-col bg-[#212121] max-w-[420px] mx-auto"
    >
      {/* â”€â”€ Header â”€â”€ */}
      <div className="flex items-center gap-3 px-4 h-14 bg-[#1a1a1a] border-b border-white/5 shrink-0">
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition"
        >
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </button>
        <img src={LOGO} alt="Montana" className="w-8 h-8 rounded-lg object-contain" onError={e => { (e.target as HTMLImageElement).src = '/favicon.svg'; }} />
        <div className="flex-1 min-w-0">
          <h2 className="text-[14px] font-semibold text-white truncate flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            {AGENTS.find((a) => a.key === agent)?.label || 'Montana AI'}
          </h2>
          <p className="text-[10px] text-gray-500">Montana Bibit AI "” Pilih topik di bawah</p>
        </div>
        <button
          onClick={() => {
            if (agent === 'input') resetAll();
            else {
              setMessages([]);
              nextId.current = 0;
              addMsg('bot', getAgentGreeting(agent));
            }
          }}
          className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition"
          title="Mulai Ulang"
        >
          <RotateCcw className="w-4 h-4 text-gray-400" />
        </button>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* â”€â”€ Agent tabs â”€â”€ */}
      <div className="flex gap-1.5 px-3 py-2 bg-[#232323] border-b border-white/5 overflow-x-auto">
        {AGENTS.map((a) => (
          <button
            key={a.key}
            onClick={() => setAgent(a.key)}
            className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              agent === a.key
                ? 'bg-emerald-600 text-white'
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* â”€â”€ Progress bar â”€â”€ */}
      {(agent === 'input' || agent === 'surat-jalan') && (
        <ProgressBar step={step} sjStep={sjStep} agent={agent} />
      )}

      {/* â”€â”€ Messages â”€â”€ */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 overscroll-contain">
        {loading && (
          <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-[13px]">Memuat data...</span>
          </div>
        )}

        {messages.map((msg) => {
          // Quick replies placeholder in info mode
          if (msg.text === '__quickreplies__' && agent === 'info') {
            return (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-[90%]">
                  <div className="flex flex-wrap gap-1.5 pt-1 pb-2">
                    {infoQuickReplies.map((qr, i) => (
                      <button
                        key={i}
                        onClick={() => handleInput(qr.value, qr.label)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium transition-all ${
                          qr.variant === 'primary'
                            ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm'
                            : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        {qr.variant === 'primary' && <Check className="w-3.5 h-3.5" />}
                        {qr.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          // PDF card message
          if (msg.type === 'pdf-card' && msg.pdfCard) {
            return (
              <div key={msg.id} className="flex justify-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-emerald-600/80 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="w-3.5 h-3.5 text-white" />
                </div>
                <PdfCardMessage card={msg.pdfCard} onDownload={handlePdfDownload} />
              </div>
            );
          }

          // Normal message
          return (
            <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'bot' && (
                <div className="w-7 h-7 rounded-full bg-emerald-600/80 flex items-center justify-center shrink-0 mt-0.5">
                  <Zap className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-emerald-600/20 text-emerald-100 rounded-br-md border border-emerald-600/20'
                    : 'bg-transparent text-gray-200'
                }`}
              >
                {msg.role === 'bot' ? renderMarkdown(msg.text) : msg.text}
              </div>
            </div>
          );
        })}

        {/* Submitting indicator */}
        {submitting && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-emerald-600/80 flex items-center justify-center shrink-0">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex items-center gap-2 py-3 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-[13px]">
                {agent === 'surat-jalan' ? 'Membuat dokumen PDF...' : 'Menyimpan data...'}
              </span>
            </div>
          </div>
        )}

        {/* Quick Replies */}
        {!loading && !submitting && quickReplies.length > 0 && (
          <div className="pt-2 pb-1">
            <div className="flex flex-wrap gap-1.5">
              {quickReplies.map((qr, i) => (
                <button
                  key={i}
                  onClick={() => handleInput(qr.value, qr.label)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium transition-all ${
                    qr.variant === 'primary'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm'
                      : qr.variant === 'danger'
                      ? 'bg-red-600/20 text-red-300 border border-red-600/30 hover:bg-red-600/30'
                      : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  {qr.variant === 'primary' && agent !== 'surat-jalan' && <Check className="w-3.5 h-3.5" />}
                  {qr.label.includes('Surat Jalan') && agent !== 'surat-jalan' && <FileText className="w-3.5 h-3.5" />}
                  {qr.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* â”€â”€ Dosis calculator form â”€â”€ */}
      {agent === 'dosis' && !loading && (
        <DosisForm onSubmit={handleDosisCalc} />
      )}

      {/* â”€â”€ Text input "” always visible â”€â”€ */}
      <div className="shrink-0 border-t border-white/5 bg-[#1a1a1a] px-3 py-3 flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-[#2f2f2f] rounded-xl px-4 py-2">
          <input
            ref={inputRef}
            type={isNumberInput ? 'number' : 'text'}
            inputMode={isNumberInput ? 'numeric' : 'text'}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTextSend()}
            placeholder={inputPlaceholder}
            disabled={submitting || loading}
            className="flex-1 bg-transparent text-[13px] text-white placeholder:text-gray-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50"
          />
          <button
            onClick={handleTextSend}
            disabled={!inputValue.trim() || submitting || loading}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
              inputValue.trim() && !submitting && !loading
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'bg-white/10 text-gray-600'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-gray-600 text-center">Montana Bibit AI v3.0</p>
      </div>
    </motion.div>
  );
}
