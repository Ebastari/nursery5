import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, Lock, Eye, EyeOff, Loader2, MessageSquare, RotateCcw, ArrowLeft, CheckCircle } from 'lucide-react';
import { requestOtp, resetPassword } from '../data/api';

const COMPANY_LOGO = 'https://i.ibb.co/xSTT9wJK/download.png';
const OTP_LENGTH = 4;
const OTP_EXPIRE_SECONDS = 300;

function OtpInput({ onComplete }: { onComplete: (otp: string) => void }) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => { refs[0].current?.focus(); }, []);

  const handleChange = (idx: number, val: string) => {
    const d = val.replace(/\D/g, '').slice(-1);
    const next = [...digits]; next[idx] = d;
    setDigits(next);
    if (d && idx < OTP_LENGTH - 1) refs[idx + 1].current?.focus();
    if (next.every(x => x)) onComplete(next.join(''));
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) refs[idx - 1].current?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (text.length === OTP_LENGTH) {
      setDigits(text.split(''));
      refs[OTP_LENGTH - 1].current?.focus();
      onComplete(text);
    }
    e.preventDefault();
  };

  return (
    <div className="flex gap-3 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i} ref={refs[i]} type="text" inputMode="numeric" maxLength={1} value={d}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          className="w-14 h-14 text-center text-2xl font-bold border-2 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 border-gray-200 text-gray-900 transition"
        />
      ))}
    </div>
  );
}

function Countdown({ seconds, onEnd }: { seconds: number; onEnd: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    const t = setInterval(() => setLeft(s => { if (s <= 1) { clearInterval(t); onEnd(); return 0; } return s - 1; }), 1000);
    return () => clearInterval(t);
  }, [seconds]);
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return <span className="font-mono text-emerald-600 font-semibold">{mm}:{ss}</span>;
}

type Step = 'phone' | 'otp' | 'newpass' | 'done';

export function ForgotPasswordScreen() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('phone');

  const [nomorHp, setNomorHp] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [konfirmasi, setKonfirmasi] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showKonfirmasi, setShowKonfirmasi] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [otpExpired, setOtpExpired] = useState(false);
  const [countdownKey, setCountdownKey] = useState(0);
  const [error, setError] = useState('');

  const handleRequestOtp = async () => {
    if (!/^08\d{8,11}$/.test(nomorHp.trim())) {
      setError('Nomor HP tidak valid (contoh: 08123456789)');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await requestOtp(nomorHp.trim());
      setOtpExpired(false);
      setCountdownKey(k => k + 1);
      setStep('otp');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengirim OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true); setError('');
    try {
      await requestOtp(nomorHp.trim());
      setOtpExpired(false);
      setCountdownKey(k => k + 1);
      setOtpValue('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengirim ulang OTP');
    } finally {
      setResending(false);
    }
  };

  const handleOtpComplete = (otp: string) => {
    setOtpValue(otp);
    if (otp.length === OTP_LENGTH && !otpExpired) {
      setStep('newpass');
      setError('');
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) { setError('Password minimal 6 karakter'); return; }
    if (newPassword !== konfirmasi) { setError('Konfirmasi password tidak cocok'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await resetPassword(nomorHp.trim(), otpValue, newPassword);
      if (!res.success) throw new Error(res.error || 'Reset password gagal');
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset password gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[360px] space-y-6">

        {/* Logo */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-white border border-emerald-100 shadow-lg flex items-center justify-center mx-auto mb-4 overflow-hidden">
            <img src={COMPANY_LOGO} alt="Logo" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Smart Nursery</h1>
          <p className="text-xs text-gray-500 mt-1">PT Energi Batubara Lestari â€” Unit Nursery</p>
        </div>

        {/* STEP 1 â€” Nomor HP */}
        {step === 'phone' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/login')} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition">
                <ArrowLeft className="w-4 h-4 text-gray-600" />
              </button>
              <h2 className="text-lg font-bold text-gray-900">Lupa Password</h2>
            </div>

            <p className="text-sm text-gray-500">
              Masukkan nomor HP yang terdaftar. Kami akan mengirim kode OTP via WhatsApp.
            </p>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Nomor HP (WhatsApp)</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel" value={nomorHp}
                  onChange={e => setNomorHp(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRequestOtp()}
                  placeholder="08xxxxxxxxxx"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition"
                />
              </div>
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>}

            <button
              onClick={handleRequestOtp} disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
              {loading ? 'Mengirim OTP...' : 'Kirim Kode OTP'}
            </button>
          </div>
        )}

        {/* STEP 2 â€” OTP */}
        {step === 'otp' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={() => { setStep('phone'); setError(''); }} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition">
                <ArrowLeft className="w-4 h-4 text-gray-600" />
              </button>
              <h2 className="text-lg font-bold text-gray-900">Masukkan OTP</h2>
            </div>

            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                <MessageSquare className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-sm text-gray-600">Kode OTP dikirim ke</p>
              <p className="font-semibold text-gray-900">{nomorHp}</p>
            </div>

            <OtpInput key={countdownKey} onComplete={handleOtpComplete} />

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg text-center">{error}</p>}

            <div className="text-center space-y-2">
              {!otpExpired
                ? <p className="text-xs text-gray-500">Berlaku <Countdown key={countdownKey} seconds={OTP_EXPIRE_SECONDS} onEnd={() => setOtpExpired(true)} /></p>
                : <p className="text-xs text-red-500 font-medium">Kode OTP sudah kedaluwarsa</p>
              }
              <button
                onClick={handleResend} disabled={resending || !otpExpired}
                className="flex items-center gap-1 mx-auto text-xs text-emerald-600 hover:text-emerald-700 disabled:text-gray-400 font-medium transition"
              >
                {resending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                Kirim ulang OTP
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 â€” Password Baru */}
        {step === 'newpass' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Password Baru</h2>
            <p className="text-sm text-gray-500">Buat password baru untuk akun Anda.</p>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Password Baru</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPass ? 'text' : 'password'} value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition"
                />
                <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Konfirmasi Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showKonfirmasi ? 'text' : 'password'} value={konfirmasi}
                  onChange={e => setKonfirmasi(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleResetPassword()}
                  placeholder="Ulangi password baru"
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition"
                />
                <button type="button" onClick={() => setShowKonfirmasi(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showKonfirmasi ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>}

            <button
              onClick={handleResetPassword} disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
            </button>
          </div>
        )}

        {/* STEP 4 â€” Selesai */}
        {step === 'done' && (
          <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
              <CheckCircle className="w-9 h-9 text-emerald-500" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Password Berhasil Diubah!</h2>
            <p className="text-sm text-gray-500">Silakan masuk dengan password baru Anda.</p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
            >
              Masuk Sekarang
            </button>
          </div>
        )}

        {step !== 'done' && (
          <p className="text-center text-sm text-gray-500">
            Ingat password?{' '}
            <Link to="/login" className="text-emerald-600 font-semibold hover:underline">Masuk</Link>
          </p>
        )}
      </div>
    </div>
  );
}
