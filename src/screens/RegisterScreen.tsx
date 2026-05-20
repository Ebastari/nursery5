import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, Lock, Eye, EyeOff, UserPlus, Loader2, User, ArrowLeft, Key } from 'lucide-react';
import { useStore } from '../store/useStore';

const COMPANY_LOGO = 'https://i.ibb.co/xSTT9wJK/download.png';

export function RegisterScreen() {
  const navigate = useNavigate();
  const { registerUser } = useStore();

  const [nama, setNama] = useState('');
  const [nomorHp, setNomorHp] = useState('');
  const [password, setPassword] = useState('');
  const [konfirmasi, setKonfirmasi] = useState('');
  const [kodeUndangan, setKodeUndangan] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showKonfirmasi, setShowKonfirmasi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validate = () => {
    if (!nama.trim()) return 'Nama wajib diisi';
    if (!/^08\d{8,11}$/.test(nomorHp.trim())) return 'Nomor HP tidak valid (contoh: 08123456789)';
    if (password.length < 6) return 'Password minimal 6 karakter';
    if (password !== konfirmasi) return 'Konfirmasi password tidak cocok';
    return '';
  };

  const handleRegister = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    setError('');
    try {
      await registerUser(nomorHp.trim(), nama.trim(), password, kodeUndangan.trim().toUpperCase());
      navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pendaftaran gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[360px] space-y-6">

        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-white border border-emerald-100 shadow-lg flex items-center justify-center mx-auto mb-4 overflow-hidden">
            <img src={COMPANY_LOGO} alt="Logo" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Smart Nursery</h1>
          <p className="text-xs text-gray-500 mt-1">PT Energi Batubara Lestari â€” Unit Nursery</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition"
            >
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </button>
            <h2 className="text-lg font-bold text-gray-900">Daftar Akun</h2>
          </div>

          {/* Nama */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">Nama Lengkap</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={nama}
                onChange={e => setNama(e.target.value)}
                placeholder="Nama lengkap Anda"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition"
              />
            </div>
          </div>

          {/* Nomor HP */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">Nomor HP</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={nomorHp}
                onChange={e => setNomorHp(e.target.value)}
                placeholder="08xxxxxxxxxx"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition"
              />
              <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Konfirmasi */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">Konfirmasi Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showKonfirmasi ? 'text' : 'password'}
                value={konfirmasi}
                onChange={e => setKonfirmasi(e.target.value)}
                placeholder="Ulangi password"
                className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition"
              />
              <button type="button" onClick={() => setShowKonfirmasi(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showKonfirmasi ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Kode Undangan */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">
              Kode Undangan
              <span className="ml-1 text-gray-400 font-normal">(kosongkan jika Anda admin pertama)</span>
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={kodeUndangan}
                onChange={e => setKodeUndangan(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleRegister()}
                placeholder="Contoh: NRS-AB12C3"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-300 transition"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Jika belum ada akun di sistem, kosongkan â€” Anda akan otomatis jadi Admin.
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {loading ? 'Mendaftar...' : 'Daftar Sekarang'}
          </button>
        </div>

        <p className="text-center text-sm text-gray-500">
          Sudah punya akun?{' '}
          <Link to="/login" className="text-emerald-600 font-semibold hover:underline">Masuk</Link>
        </p>
      </div>
    </div>
  );
}
