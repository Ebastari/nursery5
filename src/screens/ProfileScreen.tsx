import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Phone, ShieldCheck, Calendar, Lock, Eye, EyeOff,
  Loader2, CheckCircle, LogOut, ArrowLeft, ChevronRight,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { changePassword } from '../data/api';

type Section = 'main' | 'password';

export function ProfileScreen() {
  const navigate = useNavigate();
  const { authUser, logout } = useStore();

  const [section, setSection] = useState<Section>('main');

  // Change password state
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [konfirmasi, setKonfirmasi] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showKonfirmasi, setShowKonfirmasi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleChangePassword = async () => {
    if (!oldPass || !newPass || !konfirmasi) { setError('Semua field wajib diisi'); return; }
    if (newPass.length < 6) { setError('Password baru minimal 6 karakter'); return; }
    if (newPass !== konfirmasi) { setError('Konfirmasi password tidak cocok'); return; }

    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await changePassword(authUser!.nomorHp, oldPass, newPass);
      if (!res.success) throw new Error(res.error || 'Gagal mengubah password');
      setSuccess('Password berhasil diubah!');
      setOldPass(''); setNewPass(''); setKonfirmasi('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah password');
    } finally {
      setLoading(false);
    }
  };

  if (!authUser) return null;

  return (
    <div className="fade-in space-y-4 pb-24">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => section === 'main' ? navigate(-1) : setSection('main')}
          className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {section === 'main' ? 'Profil Saya' : 'Ubah Password'}
          </h1>
          <p className="text-xs text-gray-500">
            {section === 'main' ? 'Informasi akun Anda' : 'Buat password baru yang kuat'}
          </p>
        </div>
      </div>

      {section === 'main' && (
        <>
          {/* Avatar + nama */}
          <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl p-6 flex items-center gap-4 shadow-lg shadow-emerald-100">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-bold shrink-0">
              {authUser.nama.charAt(0).toUpperCase()}
            </div>
            <div className="text-white">
              <p className="text-lg font-bold leading-tight">{authUser.nama}</p>
              <p className="text-sm text-emerald-100 mt-0.5">{authUser.nomorHp}</p>
              <span className={`inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                authUser.role === 'admin' ? 'bg-amber-400/30 text-amber-100' : 'bg-white/20 text-white'
              }`}>
                <ShieldCheck className="w-3 h-3" />
                {authUser.role === 'admin' ? 'Administrator' : 'Pengguna'}
              </span>
            </div>
          </div>

          {/* Info detail */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            <InfoRow icon={<User className="w-4 h-4 text-emerald-600" />} label="Nama Lengkap" value={authUser.nama} />
            <InfoRow icon={<Phone className="w-4 h-4 text-emerald-600" />} label="Nomor HP" value={authUser.nomorHp} />
            <InfoRow
              icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />}
              label="Role"
              value={authUser.role === 'admin' ? 'Administrator' : 'Pengguna'}
            />
            <InfoRow
              icon={<Calendar className="w-4 h-4 text-emerald-600" />}
              label="Aplikasi"
              value="Smart Nursery — PT EBL"
            />
          </div>

          {/* Aksi */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            <button
              onClick={() => { setSection('password'); setError(''); setSuccess(''); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Lock className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="flex-1 text-sm font-medium text-gray-900 text-left">Ubah Password</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>

            {authUser.role === 'admin' && (
              <button
                onClick={() => navigate('/admin/users')}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                </div>
                <span className="flex-1 text-sm font-medium text-gray-900 text-left">Manajemen Pengguna</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            )}

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 transition group"
            >
              <div className="w-8 h-8 rounded-xl bg-red-50 group-hover:bg-red-100 flex items-center justify-center transition">
                <LogOut className="w-4 h-4 text-red-500" />
              </div>
              <span className="flex-1 text-sm font-medium text-red-600 text-left">Keluar</span>
            </button>
          </div>
        </>
      )}

      {section === 'password' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">

          {success && (
            <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-700 font-medium">{success}</p>
            </div>
          )}

          <PassField label="Password Lama" value={oldPass} show={showOld}
            onToggle={() => setShowOld(v => !v)} onChange={setOldPass} />
          <PassField label="Password Baru" value={newPass} show={showNew}
            onToggle={() => setShowNew(v => !v)} onChange={setNewPass} hint="Minimal 6 karakter" />
          <PassField label="Konfirmasi Password Baru" value={konfirmasi} show={showKonfirmasi}
            onToggle={() => setShowKonfirmasi(v => !v)} onChange={setKonfirmasi} />

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            onClick={handleChangePassword} disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
          </button>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-gray-900 truncate">{value}</p>
      </div>
    </div>
  );
}

function PassField({
  label, value, show, onToggle, onChange, hint,
}: {
  label: string; value: string; show: boolean;
  onToggle: () => void; onChange: (v: string) => void; hint?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1.5">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type={show ? 'text' : 'password'} value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="••••••••"
          className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition"
        />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
