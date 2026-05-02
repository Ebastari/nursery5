import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Loader2, Zap, ArrowLeft, Check, FileText, RotateCcw } from 'lucide-react';
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
  type Step,
  type FormData,
  type DropdownData,
} from './chatbotLogic';

// Multi-agent/skill: daftar agent/topik
const AGENTS = [
  { key: 'input', label: 'Fast Input' },
  { key: 'info', label: 'Info Bibit' },
  { key: 'laporan', label: 'Laporan' },
  { key: 'bantuan', label: 'Bantuan' },
];
import { api } from '../../data/mockData';

const LOGO = 'https://i.ibb.co.com/xSTT9wJK/download.png';

const emptyForm: FormData = {
  action: '',
  bibit: '',
  jumlah: '',
  sumber: '',
  tujuan: '',
  dibuatOleh: '',
  driver: '',
};

interface ChatMsg {
  id: number;
  role: 'bot' | 'user';
  text: string;
  ts: number;
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

// ── Progress indicator ──
const STEP_ORDER: Step[] = ['action', 'bibit', 'jumlah', 'sumber', 'tujuan', 'dibuat_oleh', 'driver'];

function ProgressBar({ step }: { step: Step }) {
  const idx = STEP_ORDER.indexOf(step);
  const progress = step === 'confirm' || step === 'submitting' || step === 'done' || step === 'ask_print'
    ? 100
    : idx >= 0
    ? ((idx + 1) / STEP_ORDER.length) * 100
    : 0;

  const label = STEP_LABELS[step] || '';

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

export function ChatbotPanel({ onClose, mode: initialMode = 'input' }: { onClose: () => void; mode?: string }) {
  // Multi-agent: state agent aktif, fallback ke 'input' jika tidak valid
  const [agent, setAgent] = useState<string>(AGENTS.some(a => a.key === initialMode) ? initialMode : 'input');
  const navigate = useNavigate();

  // Mode: 'input' = fast input, 'info' = asisten info bibit, dst
  const [step, setStep] = useState<Step>(agent === 'info' ? 'action' : 'greeting');

  // Pastikan agent selalu valid (jika user reload atau state error)
  useEffect(() => {
    if (!AGENTS.some(a => a.key === agent)) {
      setAgent('input');
    }
  }, [agent]);
  const [formData, setFormData] = useState<FormData>({ ...emptyForm });
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [options, setOptions] = useState<DropdownData>({
    bibit: [], sumber: [], tujuan: [], dibuatOleh: [], driver: [],
  });
  const [stokMap, setStokMap] = useState<Record<string, number>>({});
  const [pdfUrl, setPdfUrl] = useState('');

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

  // ── Init: load options ──
  // Inisialisasi ulang saat agent/topik diganti
  useEffect(() => {
    (async () => {
      try {
        const result = await loadOptions();
        setOptions(result.options);
        setStokMap(result.stokMap);
      } catch {
        // fallback silence
      }
      if (agent === 'info') {
        addMsg('bot', 'Halo! Saya Montana Bibit AI. Silakan tanya stok, distribusi, kematian, atau info bibit apa saja. Contoh: "Stok hari ini", "Stok SENGON POTTING", "Distribusi ke TIM BASRI", "Kematian bibit hari ini".');
        addMsg('bot', 'Ingin menambah data distribusi bibit? Klik di sini: [Input Data Bibit](#/quick-input)');
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            { id: nextId.current++, role: 'bot', text: '__quickreplies__', ts: Date.now() }
          ]);
        }, 100);
        setStep('action');
      } else if (agent === 'laporan') {
        addMsg('bot', 'Selamat datang di menu **Laporan**. Silakan ketik jenis laporan yang ingin diambil, contoh: "Laporan distribusi minggu ini", "Laporan kematian bulan ini".');
        setStep('action');
      } else if (agent === 'bantuan') {
        addMsg('bot', 'Selamat datang di menu **Bantuan**. Ketik pertanyaan Anda atau pilih topik bantuan di bawah.');
        setStep('action');
      } else {
        addMsg('bot', GREETING);
        setStep('action');
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent]);

  // ── Submit data ──
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

      // Tampilkan ringkasan data + link PDF langsung di chat panel
      let summary = '';
      summary += '\u2B50 Data berhasil disimpan! Berikut ringkasan:\n';
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
        summary += `\n\uD83D\uDCC4 [Surat Jalan (PDF)](${result.linkPdf})`;
      }
      addMsg('bot', summary);

      addMsg('bot', successMsg);
      setStep(successStep);
    } catch (err: unknown) {
      addMsg('bot', `Gagal menyimpan data: ${err instanceof Error ? err.message : 'Terjadi kesalahan'}\n\nSilakan coba lagi.`);
      setStep('confirm');
    }

    setSubmitting(false);
  }, [formData, setStep, setSubmitting, addMsg, setPdfUrl]);

  // ── Reset ──
  const resetAll = useCallback(() => {
    setFormData({ ...emptyForm });
    setPdfUrl('');
    setMessages([]);
    nextId.current = 0;
    addMsg('bot', GREETING);
    setStep('action');
    setInputValue('');
  }, [setFormData, setPdfUrl, setMessages, nextId, addMsg, setStep, setInputValue]);

  // ── Handle user input (quick reply or text) ──
  const handleInput = useCallback(async (value: string, displayText?: string) => {
    if (submitting || loading) return;
    addMsg('user', displayText || value);

    // Multi-agent logic
    if (agent === 'info') {
      // ...existing logic info bibit...
      const q = value.toLowerCase();
      if (q.includes('stok')) {
        if (q.includes('hari ini') || q.includes('semua') || q === 'stok') {
          let msg = '**Stok Bibit per Jenis (Saat Ini):**\n';
          let total = 0;
          options.bibit.forEach((b) => {
            const stok = stokMap[b.toUpperCase()] || 0;
            total += stok;
            msg += `• ${b}: ${stok.toLocaleString('id-ID')} bibit\n`;
          });
          msg += `\n**Total Stok:** ${total.toLocaleString('id-ID')} bibit`;
          addMsg('bot', msg);
        } else {
          const found = options.bibit.find((b) => q.includes(b.toLowerCase()));
          if (found) {
            const stok = stokMap[found.toUpperCase()] || 0;
            addMsg('bot', `Stok ${found}: ${stok.toLocaleString('id-ID')} bibit`);
          } else {
            addMsg('bot', 'Silakan sebutkan nama bibit yang ingin dicek stoknya, atau ketik "Stok semua bibit".');
          }
        }
      } else if (q.includes('mati') || q.includes('kematian')) {
        try {
          const apiRows = await import('../../data/api').then((mod) => mod.fetchApiData());
          const kematianMap: Record<string, number> = {};
          apiRows.forEach((row) => {
            const key = row.bibit.trim().toUpperCase();
            if (!kematianMap[key]) kematianMap[key] = 0;
            kematianMap[key] += row.mati || 0;
          });
          let msg = '**Jumlah Kematian Bibit per Jenis:**\n';
          options.bibit.forEach((b) => {
            const mati = kematianMap[b.toUpperCase()] || 0;
            msg += `• ${b}: ${mati.toLocaleString('id-ID')} bibit\n`;
          });
          addMsg('bot', msg);
        } catch {
          addMsg('bot', 'Gagal mengambil data kematian bibit.');
        }
      } else if (q.includes('distribusi') || q.includes('tujuan') || q.includes('tim')) {
        const timMatch = q.match(/tim\s+([a-zA-Z0-9]+)/);
        let timName = timMatch ? timMatch[1].toUpperCase() : '';
        if (!timName) {
          const keMatch = q.match(/ke\s+([a-zA-Z0-9]+)/);
          if (keMatch) timName = keMatch[1].toUpperCase();
        }
        if (timName) {
          try {
            const apiRows = await import('../../data/api').then((mod) => mod.fetchApiData());
            const rowsTim = apiRows.filter((row) =>
              row.tujuan && row.tujuan.toUpperCase().includes('TIM ' + timName)
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
            msg += `\nTotal distribusi: ${rowsTim.reduce((a, b) => a + (b.keluar || 0), 0).toLocaleString('id-ID')} bibit`;
            addMsg('bot', msg);
          } catch {
            addMsg('bot', 'Gagal mengambil data distribusi tim.');
          }
        } else {
          addMsg('bot', 'Silakan sebutkan nama tim, contoh: "Distribusi ke Tim Basri".');
        }
      } else if (q.includes('bibit baru')) {
        addMsg('bot', 'Fitur info bibit baru akan segera hadir.');
      } else {
        addMsg('bot', 'Maaf, saya belum mengerti pertanyaan Anda.\n\nContoh: "Stok semua bibit", "Stok SENGON POTTING", "Kematian bibit hari ini".');
      }
      return;
    }
    if (agent === 'laporan') {
      // Contoh: logic laporan sederhana
      addMsg('bot', 'Fitur laporan akan segera hadir. Silakan sebutkan jenis laporan yang diinginkan.');
      return;
    }
    if (agent === 'bantuan') {
      addMsg('bot', 'Fitur bantuan akan segera hadir. Silakan ketik pertanyaan Anda.');
      return;
    }

    // ...existing code (input cepat)...
    // Special: confirm step actions
    if (step === 'confirm') {
      if (value === 'reset') {
        resetAll();
        return;
      }
      if (value === 'submit') {
        await handleSubmit();
        return;
      }
      return;
    }
    // Special: ask_print step
    if (step === 'ask_print') {
      if (value === 'print') {
        if (pdfUrl) {
          window.open(pdfUrl, '_blank');
          addMsg('bot', 'Surat Jalan telah dibuka.\n\nTerima kasih menggunakan Fast Input.');
        } else {
          // Navigate to surat jalan page with form data
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
      if (value === 'new') {
        resetAll();
        return;
      }
      if (value === 'close') {
        onClose();
        return;
      }
      return;
    }
    // Special: done step
    if (step === 'done') {
      if (value === 'new') {
        resetAll();
        return;
      }
      return;
    }
    // Normal step processing
    const result = processStep(step, value, formData, stokMap);
    if (!result) {
      addMsg('bot', 'Masukan tidak valid. Silakan coba lagi.');
      return;
    }
    setFormData((prev) => ({ ...prev, ...result.updatedForm }));
    addMsg('bot', result.message);
    setStep(result.nextStep);
  }, [step, formData, stokMap, submitting, loading, pdfUrl, navigate, onClose, addMsg, agent, options.bibit, handleSubmit, resetAll]);

  // ── Quick replies  ──
  // Quick reply untuk mode info (dashboard)
  const infoQuickReplies = [
    { label: 'Stok hari ini', value: 'Stok hari ini', variant: 'primary' },
    { label: 'Stok SENGON POTTING', value: 'Stok SENGON POTTING' },
    { label: 'Distribusi ke TIM BASRI', value: 'Distribusi ke TIM BASRI' },
    { label: 'Kematian bibit hari ini', value: 'Kematian bibit hari ini' },
    { label: 'Stok semua bibit', value: 'Stok semua bibit' },
  ];
  // Quick reply per agent
  const quickReplies = agent === 'info' ? infoQuickReplies : getQuickReplies(step, options, stokMap);
  const showNumberInput = agent === 'info' ? false : step === 'jumlah';

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
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 h-14 bg-[#1a1a1a] border-b border-white/5 shrink-0">
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition"
        >
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </button>
        <img src={LOGO} alt="Montana" className="w-8 h-8 rounded-lg object-contain" />
        <div className="flex-1 min-w-0">
          <h2 className="text-[14px] font-semibold text-white truncate flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            {AGENTS.find((a) => a.key === agent)?.label || 'Chatbot'}
          </h2>
          <p className="text-[10px] text-gray-500">Pilih topik di bawah untuk ganti fitur</p>
        </div>
        <button
          onClick={resetAll}
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
      {/* Pilihan agent/topik */}
      <div className="flex gap-2 px-4 py-2 bg-[#232323] border-b border-white/5">
        {AGENTS.map((a) => (
          <button
            key={a.key}
            onClick={() => { setAgent(a.key); setMessages([]); setFormData({ ...emptyForm }); setPdfUrl(''); nextId.current = 0; }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${agent === a.key ? 'bg-emerald-600 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* ── Progress ── */}
      {step !== 'greeting' && <ProgressBar step={step} />}

      {/* ── Messages ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 overscroll-contain">
        {loading && (
          <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-[13px]">Memuat data...</span>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.text === '__quickreplies__' && agent === 'info') {
            const handleQuick = (val: string, label: string) => {
              handleInput(val, label);
            };
            return (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-[85%]">
                  <div className="flex flex-wrap gap-1.5 pt-1 pb-2">
                    {infoQuickReplies.map((qr, i) => (
                      <button
                        key={i}
                        onClick={() => handleQuick(qr.value, qr.label)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium transition-all ${
                          qr.variant === 'primary'
                            ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm'
                            : qr.variant === 'danger'
                            ? 'bg-red-600/20 text-red-300 border border-red-600/30 hover:bg-red-600/30'
                            : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        {qr.variant === 'primary' && <Check className="w-3.5 h-3.5" />}
                        {qr.label.includes('Surat Jalan') && <FileText className="w-3.5 h-3.5" />}
                        {qr.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          }
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
              <span className="text-[13px]">Menyimpan data...</span>
            </div>
          </div>
        )}

        {/* ── Quick Replies ── */}
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
                  {qr.variant === 'primary' && <Check className="w-3.5 h-3.5" />}
                  {qr.label.includes('Surat Jalan') && <FileText className="w-3.5 h-3.5" />}
                  {qr.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Input chat selalu di bawah panel, WhatsApp style ── */}
      <div className="shrink-0 border-t border-white/5 bg-[#1a1a1a] px-3 py-3 flex flex-col gap-1">
        {(showNumberInput || agent === 'info') && (
          <div className="flex items-center gap-2 bg-[#2f2f2f] rounded-xl px-4 py-2">
            <input
              ref={inputRef}
              type={showNumberInput ? "number" : "text"}
              inputMode={showNumberInput ? "numeric" : "text"}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTextSend()}
              placeholder={showNumberInput ? "Masukkan jumlah bibit..." : "Ketik pertanyaan atau perintah..."}
              className="flex-1 bg-transparent text-[13px] text-white placeholder:text-gray-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              autoFocus
            />
            <button
              onClick={handleTextSend}
              disabled={!inputValue.trim()}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
                inputValue.trim()
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'bg-white/10 text-gray-600'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
        {/* Tombol Update Bibit selalu muncul di bawah input */}
        {/* Footer selalu di bawah input */}
        <div className="px-1 pt-2">
          <p className="text-[10px] text-gray-600 text-center">Montana Bibit — Fast Input v2.0</p>
        </div>
      </div>
    </motion.div>
  );
}
