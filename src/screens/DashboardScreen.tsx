import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  RefreshCw, MessageCircle, TrendingUp, Package,
  ArrowDownCircle, ArrowUpCircle, MinusCircle,
  FileText, ExternalLink, ChevronDown, ChevronUp,
  Truck, Clock, CheckCircle, Maximize2, ArrowLeft,
} from 'lucide-react';
import { QRCodeOverlay } from '../components/QRCodeOverlay';
import { Card } from '../components/Card';
import { ChatbotPanel } from '../components/chatbot/ChatbotPanel';
import { useStore } from '../store/useStore';
import { useOnlineStatus } from '../data/useOnlineStatus';
import { fetchApiData, invalidateCache } from '../data/api';
import type { ApiRow } from '../data/api';
import { derivePlants } from '../data/mockData';
import { CalendarHeatmap } from '../components/CalendarHeatmap';

interface SuratJalanItem {
  nomorSurat: string;
  tanggal: string;
  bibit: string;
  keluar: number;
  tujuan: string;
  linkPdf: string;
}

interface DistribusiItem {
  nomorSurat: string;
  tanggal: string;
  bibit: string;
  keluar: number;
  tujuan: string;
  kodeVerifikasi: string;
  statusTerima: string;
  namaPenerima: string;
  tanggalTerima: string;
}

interface DashboardStats {
  totalStok: number;
  totalMasuk: number;
  totalKeluar: number;
  totalMati: number;
  jumlahJenis: number;
  topBibit: { nama: string; stok: number; percent: number }[];
  dailyKeluar: { tanggal: string; total: number }[];
  suratJalan: SuratJalanItem[];
  distribusi: DistribusiItem[];
}

function formatTanggal(t: string) {
  const d = new Date(t);
  if (isNaN(d.getTime())) return t;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

const DashboardScreen: React.FC = () => {
  const { refreshAll } = useStore();
  const [chatOpen, setChatOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const isOnline = useOnlineStatus();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllSurat, setShowAllSurat] = useState(false);
  const [showAllDistribusi, setShowAllDistribusi] = useState(false);
  const [fullscreenQR, setFullscreenQR] = useState<DistribusiItem | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows: ApiRow[] = await fetchApiData();
      const plants = derivePlants(rows);

      const totalMasuk = rows.reduce((s, r) => s + (r.masuk || 0), 0);
      const totalKeluar = rows.reduce((s, r) => s + (r.keluar || 0), 0);
      const totalMati = rows.reduce((s, r) => s + (r.mati || 0), 0);
      const totalStok = plants.reduce((s, p) => s + p.stock, 0);

      const dailyMap = new Map<string, number>();
      rows.forEach(r => {
        if (r.keluar > 0) {
          dailyMap.set(r.tanggal, (dailyMap.get(r.tanggal) || 0) + r.keluar);
        }
      });
      const dailyKeluar = Array.from(dailyMap, ([tanggal, total]) => ({ tanggal, total }));

      const topBibit = plants.slice(0, 6).map(p => ({
        nama: p.name,
        stok: p.stock,
        percent: totalStok > 0 ? Math.round((p.stock / totalStok) * 1000) / 10 : 0,
      }));

      // Ambil semua baris yang punya linkPdf (Merged Doc URL - aplikasi qr)
      const suratJalan: SuratJalanItem[] = rows
        .filter(r => r.linkPdf && r.linkPdf.trim().startsWith('http'))
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
        .map(r => ({
          nomorSurat: r.nomorSurat || '-',
          tanggal: r.tanggal,
          bibit: r.bibit || '-',
          keluar: r.keluar || 0,
          tujuan: r.tujuan || '-',
          linkPdf: r.linkPdf!,
        }));

      const distribusi: DistribusiItem[] = rows
        .filter(r => r.keluar > 0 && r.kodeVerifikasi)
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
        .slice(0, 20)
        .map(r => ({
          nomorSurat: r.nomorSurat || '-',
          tanggal: r.tanggal,
          bibit: r.bibit || '-',
          keluar: r.keluar || 0,
          tujuan: r.tujuan || '-',
          kodeVerifikasi: r.kodeVerifikasi!,
          statusTerima: r.statusTerima || '',
          namaPenerima: r.namaPenerima || '',
          tanggalTerima: r.tanggalTerima || '',
        }));

      setStats({ totalStok, totalMasuk, totalKeluar, totalMati, jumlahJenis: plants.length, topBibit, dailyKeluar, suratJalan, distribusi });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleRefresh = async () => {
    if (!isOnline || refreshing) return;
    setRefreshing(true);
    invalidateCache();
    await refreshAll();
    await loadStats();
    setRefreshing(false);
  };

  return (
    <>
      <div className="min-h-screen p-4 max-w-5xl mx-auto space-y-4 pb-24">

        {/* HEADER */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dashboard Bibit</h1>
            <p className="text-xs text-gray-400">Unit Nursery — Kalimantan Selatan</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing || !isOnline}
            className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center disabled:opacity-50 transition-opacity"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <Card className="p-5 rounded-2xl bg-red-50 border border-red-200">
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <button
              onClick={loadStats}
              className="px-4 py-2 bg-red-500 text-white rounded-xl text-xs font-semibold"
            >
              Coba Lagi
            </button>
          </Card>
        ) : stats ? (
          <>
            {/* HERO — Total Stok */}
            <Card className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xs opacity-80 mb-1">Total Stok Bibit</div>
                  <div className="text-4xl font-black tracking-tight">
                    {stats.totalStok.toLocaleString('id-ID')}
                  </div>
                  <div className="text-xs opacity-80 mt-1">polybag tersedia</div>
                </div>
                <div className="text-right">
                  <Package className="w-12 h-12 opacity-30 ml-auto mb-1" />
                  <div className="text-xs opacity-80">Jenis Bibit</div>
                  <div className="text-2xl font-bold">{stats.jumlahJenis}</div>
                </div>
              </div>
            </Card>

            {/* METRICS 3 kolom */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3 text-center">
                <ArrowDownCircle className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                <div className="text-[10px] text-gray-500">Total Masuk</div>
                <div className="text-base font-bold text-gray-900">
                  {stats.totalMasuk.toLocaleString('id-ID')}
                </div>
              </Card>
              <Card className="p-3 text-center">
                <ArrowUpCircle className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                <div className="text-[10px] text-gray-500">Total Keluar</div>
                <div className="text-base font-bold text-gray-900">
                  {stats.totalKeluar.toLocaleString('id-ID')}
                </div>
              </Card>
              <Card className="p-3 text-center">
                <MinusCircle className="w-5 h-5 text-rose-400 mx-auto mb-1" />
                <div className="text-[10px] text-gray-500">Total Mati</div>
                <div className="text-base font-bold text-gray-900">
                  {stats.totalMati.toLocaleString('id-ID')}
                </div>
              </Card>
            </div>

            {/* TOP BIBIT berdasarkan stok */}
            <Card className="p-4 rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <div className="text-sm font-bold text-gray-900">Stok per Jenis Bibit</div>
              </div>
              <div className="space-y-3">
                {stats.topBibit.map((b, i) => (
                  <div key={b.nama} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="text-gray-400 w-4">#{i + 1}</span>
                        <span className="font-medium text-gray-800 truncate max-w-[160px]">{b.nama}</span>
                      </span>
                      <span className="text-gray-500 shrink-0">{b.stok.toLocaleString('id-ID')} bibit</span>
                    </div>
                    <div className="relative w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="absolute h-2.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-500"
                        style={{ width: `${b.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* SURAT JALAN */}
            <Card className="p-4 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <div className="text-sm font-bold text-gray-900">Semua Surat Jalan</div>
                </div>
                <span className="text-xs bg-blue-50 text-blue-600 font-semibold px-2 py-0.5 rounded-full">
                  {stats.suratJalan.length} dokumen
                </span>
              </div>

              {stats.suratJalan.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Belum ada surat jalan dengan PDF</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {(showAllSurat ? stats.suratJalan : stats.suratJalan.slice(0, 5)).map((sj, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors"
                      >
                        {/* Icon */}
                        <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-bold text-gray-800 font-mono truncate">
                              {sj.nomorSurat !== '-' ? sj.nomorSurat : `Distribusi ${sj.bibit}`}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5 truncate">
                            {formatTanggal(sj.tanggal)}
                            {sj.bibit !== '-' && <> &middot; {sj.bibit}</>}
                            {sj.keluar > 0 && <> &middot; {sj.keluar.toLocaleString('id-ID')} polybag</>}
                          </div>
                          {sj.tujuan !== '-' && (
                            <div className="text-[10px] text-blue-600 truncate mt-0.5">{sj.tujuan}</div>
                          )}
                        </div>

                        {/* Tombol PDF */}
                        <a
                          href={sj.linkPdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          PDF
                        </a>
                      </div>
                    ))}
                  </div>

                  {stats.suratJalan.length > 5 && (
                    <button
                      onClick={() => setShowAllSurat(v => !v)}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      {showAllSurat ? (
                        <><ChevronUp className="w-3.5 h-3.5" /> Tampilkan lebih sedikit</>
                      ) : (
                        <><ChevronDown className="w-3.5 h-3.5" /> Lihat semua {stats.suratJalan.length} surat jalan</>
                      )}
                    </button>
                  )}
                </>
              )}
            </Card>

            {/* NOTIFIKASI PENGIRIMAN */}
            <Card className="p-4 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-emerald-500" />
                  <div className="text-sm font-bold text-gray-900">Notifikasi Pengiriman</div>
                </div>
                <span className="text-xs bg-amber-50 text-amber-600 font-semibold px-2 py-0.5 rounded-full">
                  {stats.distribusi.filter(d => d.statusTerima.toLowerCase() !== 'diterima').length} menunggu
                </span>
              </div>

              {stats.distribusi.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <Truck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Belum ada pengiriman</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {(showAllDistribusi ? stats.distribusi : stats.distribusi.slice(0, 5)).map((item, i) => (
                      <div key={i} className={`rounded-xl border overflow-hidden ${item.statusTerima.toLowerCase() === 'diterima' ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                        {item.statusTerima.toLowerCase() === 'diterima' ? (
                          <div className="p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Diterima</span>
                            </div>
                            <p className="text-xs font-bold text-gray-900">{item.bibit} · {item.keluar.toLocaleString('id-ID')} polybag</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{formatTanggal(item.tanggal)} · {item.tujuan}</p>
                            {item.namaPenerima && (
                              <p className="text-[10px] text-emerald-600 mt-0.5">Diterima oleh: <strong>{item.namaPenerima}</strong></p>
                            )}
                            {item.tanggalTerima && (
                              <p className="text-[10px] text-gray-400">{item.tanggalTerima} WITA</p>
                            )}
                          </div>
                        ) : (
                          <div className="p-3">
                            <div className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                                    {item.statusTerima ? item.statusTerima : 'Menunggu Konfirmasi'}
                                  </span>
                                </div>
                                <p className="text-xs font-bold text-gray-900">{item.bibit}</p>
                                <p className="text-[10px] text-gray-500">{item.keluar.toLocaleString('id-ID')} polybag · {formatTanggal(item.tanggal)}</p>
                                <p className="text-[10px] text-blue-600 truncate">{item.tujuan}</p>
                                {item.nomorSurat !== '-' && (
                                  <p className="text-[10px] font-mono text-gray-400 mt-0.5">{item.nomorSurat}</p>
                                )}
                              </div>
                              <div className="shrink-0 flex flex-col items-center gap-1">
                                <QRCodeOverlay value={`VERIFY:${item.kodeVerifikasi}`} size={72} />
                                <button
                                  onClick={() => setFullscreenQR(item)}
                                  className="flex items-center gap-1 text-[10px] text-blue-600 font-semibold hover:text-blue-800 transition-colors"
                                >
                                  <Maximize2 className="w-3 h-3" />
                                  Perbesar
                                </button>
                              </div>
                            </div>
                            <div className="mt-2 px-2 py-1.5 rounded-lg bg-blue-50 border border-blue-200">
                              <p className="text-[10px] text-blue-700 text-center font-medium">
                                📱 Serahkan barcode ini ke tim lapangan
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {stats.distribusi.length > 5 && (
                    <button
                      onClick={() => setShowAllDistribusi(v => !v)}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      {showAllDistribusi ? (
                        <><ChevronUp className="w-3.5 h-3.5" /> Tampilkan lebih sedikit</>
                      ) : (
                        <><ChevronDown className="w-3.5 h-3.5" /> Lihat semua {stats.distribusi.length} pengiriman</>
                      )}
                    </button>
                  )}
                </>
              )}
            </Card>

            {/* KALENDER KELUAR HARIAN */}
            <Card className="p-4 rounded-2xl border border-gray-200">
              <div className="text-sm font-bold mb-3 text-gray-800">Pengeluaran Harian</div>
              {stats.dailyKeluar.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">Belum ada data pengeluaran</div>
              ) : (
                <CalendarHeatmap data={stats.dailyKeluar} />
              )}
            </Card>

            {/* AI CHATBOT */}
            <Card onClick={() => setChatOpen(true)} className="p-4 cursor-pointer hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-gray-900">Montana AI</div>
                  <div className="text-xs text-gray-500">Tanya analisis data bibit</div>
                </div>
              </div>
            </Card>
          </>
        ) : null}
      </div>

      <AnimatePresence>
        {chatOpen && <ChatbotPanel onClose={() => setChatOpen(false)} mode="info" />}
      </AnimatePresence>

      {/* FULLSCREEN QR OVERLAY */}
      {fullscreenQR && (
        <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-5">
            <button
              onClick={() => setFullscreenQR(null)}
              className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <p className="font-bold text-sm text-white leading-tight">{fullscreenQR.bibit}</p>
              {fullscreenQR.nomorSurat !== '-' && (
                <p className="text-[11px] text-gray-400 font-mono">{fullscreenQR.nomorSurat}</p>
              )}
            </div>
          </div>

          {/* QR Code — center */}
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
            <div className="bg-white p-4 rounded-3xl shadow-2xl">
              <QRCodeOverlay
                value={`VERIFY:${fullscreenQR.kodeVerifikasi}`}
                size={260}
                className="!border-0 !shadow-none !rounded-none"
              />
            </div>

            <div className="text-center space-y-1.5">
              <p className="text-white font-bold text-lg">{fullscreenQR.bibit}</p>
              <p className="text-gray-400 text-sm">{fullscreenQR.keluar.toLocaleString('id-ID')} polybag</p>
              <p className="text-gray-400 text-sm truncate max-w-xs">{fullscreenQR.tujuan}</p>
              <p className="text-[11px] text-gray-600 mt-1">{formatTanggal(fullscreenQR.tanggal)}</p>
            </div>

            <div className="px-4 py-2.5 rounded-2xl bg-blue-500/20 border border-blue-500/30">
              <p className="text-sm text-blue-300 font-medium text-center">
                📱 Minta tim lapangan scan barcode ini
              </p>
            </div>
          </div>

          {/* Footer — kode verifikasi */}
          <div className="px-8 pb-10 text-center">
            <p className="text-[11px] text-gray-600 font-mono tracking-wider">
              {fullscreenQR.kodeVerifikasi}
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default DashboardScreen;
