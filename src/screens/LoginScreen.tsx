import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, Lock, Eye, EyeOff, LogIn, Loader2, KeyRound } from 'lucide-react';
import { useStore } from '../store/useStore';

const COMPANY_LOGO = 'https://i.ibb.co/xSTT9wJK/download.png';

export function LoginScreen() {
  const navigate = useNavigate();
  const { loginUser } = useStore();

  const [nomorHp, setNomorHp] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!nomorHp.trim() || !password.trim()) {
      setError('Nomor HP dan password wajib diisi');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await loginUser(nomorHp.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal, coba lagi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center px-4">
      <div className="w-full max-w-[360px] space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-white border border-emerald-100 shadow-lg flex items-center justify-center mx-auto mb-4 overflow-hidden">
            <img src={COMPANY_LOGO} alt="Logo" className="w-12 h-12 object-contain" onError={e => { (e.target as HTMLImageElement).src = '/favicon.svg'; }} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Smart Nursery</h1>
          <p className="text-xs text-gray-500 mt-1">PT Energi Batubara Lestari - Unit Nursery</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Masuk</h2>

          {/* Nomor HP */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">Nomor HP (WhatsApp)</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={nomorHp}
                onChange={e => setNomorHp(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
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
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••"
                className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {loading ? 'Memproses...' : 'Masuk'}
          </button>

          <Link
            to="/forgot-password"
            className="flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-emerald-600 transition"
          >
            <KeyRound className="w-3 h-3" />
            Lupa Password?
          </Link>
        </div>

        <p className="text-center text-sm text-gray-500">
          Belum punya akun?{' '}
          <Link to="/register" className="text-emerald-600 font-semibold hover:underline">
            Daftar Sekarang
          </Link>
        </p>
      </div>
    </div>
  );
}
