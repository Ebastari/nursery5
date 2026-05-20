import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, ShieldCheck, UserX, UserCheck,
  Loader2, RefreshCw, Crown, User, Key, Plus, Trash2, Copy, Check,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { getUsers, setUserRole, toggleUserStatus, getInviteCodes, createInviteCode, deleteInviteCode } from '../data/api';
import type { UserRecord, InviteCode } from '../data/api';

type Tab = 'users' | 'invites';

export function AdminUsersScreen() {
  const navigate = useNavigate();
  const { authUser } = useStore();
  const [tab, setTab] = useState<Tab>('users');

  // ── Users tab ──────────────────────────────────────────
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [errorUsers, setErrorUsers] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoadingUsers(true); setErrorUsers('');
    try {
      const res = await getUsers();
      if (!res.success) throw new Error(res.error || 'Gagal memuat data');
      setUsers(res.users ?? []);
    } catch (e) {
      setErrorUsers(e instanceof Error ? e.message : 'Gagal memuat pengguna');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleToggleRole = async (user: UserRecord) => {
    if (user.nomorHp === authUser?.nomorHp) return;
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    setActionLoading(user.nomorHp + '-role');
    try {
      const res = await setUserRole(user.nomorHp, newRole);
      if (!res.success) throw new Error(res.error);
      setUsers(prev => prev.map(u => u.nomorHp === user.nomorHp ? { ...u, role: newRole } : u));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal mengubah role');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (user: UserRecord) => {
    if (user.nomorHp === authUser?.nomorHp) return;
    setActionLoading(user.nomorHp + '-status');
    try {
      const res = await toggleUserStatus(user.nomorHp);
      if (!res.success) throw new Error(res.error);
      const newStatus = res.status as 'active' | 'inactive';
      setUsers(prev => prev.map(u => u.nomorHp === user.nomorHp ? { ...u, status: newStatus } : u));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal mengubah status');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Invite codes tab ────────────────────────────────────
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [errorCodes, setErrorCodes] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchCodes = async () => {
    setLoadingCodes(true); setErrorCodes('');
    try {
      const res = await getInviteCodes();
      if (!res.success) throw new Error(res.error || 'Gagal memuat kode');
      setCodes(res.codes ?? []);
    } catch (e) {
      setErrorCodes(e instanceof Error ? e.message : 'Gagal memuat kode undangan');
    } finally {
      setLoadingCodes(false);
    }
  };

  useEffect(() => {
    if (tab === 'invites') fetchCodes();
  }, [tab]);

  const handleCreateCode = async () => {
    setCreating(true); setErrorCodes('');
    try {
      const res = await createInviteCode(keterangan.trim());
      if (!res.success || !res.code) throw new Error(res.error || 'Gagal membuat kode');
      setKeterangan('');
      await fetchCodes();
    } catch (e) {
      setErrorCodes(e instanceof Error ? e.message : 'Gagal membuat kode');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCode = async (code: string) => {
    if (!confirm(`Hapus kode "${code}"? Kode yang sudah dihapus tidak bisa digunakan.`)) return;
    setDeletingCode(code);
    try {
      const res = await deleteInviteCode(code);
      if (!res.success) throw new Error(res.error);
      setCodes(prev => prev.filter(c => c.code !== code));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal menghapus kode');
    } finally {
      setDeletingCode(null);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  const availableCodes = codes.filter(c => !c.isUsed);
  const usedCodes = codes.filter(c => c.isUsed);

  return (
    <div className="fade-in space-y-4 pb-24">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Manajemen Pengguna</h1>
          <p className="text-xs text-gray-500">{users.length} pengguna terdaftar</p>
        </div>
        <button
          onClick={tab === 'users' ? fetchUsers : fetchCodes}
          disabled={tab === 'users' ? loadingUsers : loadingCodes}
          className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 ${(tab === 'users' ? loadingUsers : loadingCodes) ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
        <button
          onClick={() => setTab('users')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            tab === 'users' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Pengguna
        </button>
        <button
          onClick={() => setTab('invites')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            tab === 'invites' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          Kode Undangan
        </button>
      </div>

      {/* ── TAB: PENGGUNA ── */}
      {tab === 'users' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Total" value={users.length} color="emerald" icon={<Users className="w-4 h-4" />} />
            <StatCard label="Admin" value={users.filter(u => u.role === 'admin').length} color="amber" icon={<Crown className="w-4 h-4" />} />
            <StatCard label="Aktif" value={users.filter(u => u.status === 'active').length} color="blue" icon={<UserCheck className="w-4 h-4" />} />
          </div>

          {errorUsers && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{errorUsers}</div>
          )}

          {loadingUsers && (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-32 bg-gray-200 rounded" />
                      <div className="h-3 w-24 bg-gray-100 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loadingUsers && (
            <div className="space-y-2">
              {users.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-400">
                  Belum ada pengguna terdaftar
                </div>
              )}
              {users.map(user => {
                const isSelf = user.nomorHp === authUser?.nomorHp;
                const isActive = user.status === 'active';
                const isAdmin = user.role === 'admin';
                const roleLoading = actionLoading === user.nomorHp + '-role';
                const statusLoading = actionLoading === user.nomorHp + '-status';

                return (
                  <div
                    key={user.nomorHp}
                    className={`bg-white rounded-2xl border shadow-sm p-4 space-y-3 ${
                      isActive ? 'border-gray-100' : 'border-gray-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold shrink-0 ${
                        isAdmin ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {user.nama.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">{user.nama}</p>
                          {isSelf && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                              Saya
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{user.nomorHp}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          isAdmin ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {isAdmin ? 'Admin' : 'User'}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                        }`}>
                          {isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>
                    </div>

                    {user.createdAt && (
                      <p className="text-[10px] text-gray-400">
                        Daftar: {new Date(user.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </p>
                    )}

                    {!isSelf && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleToggleRole(user)}
                          disabled={!!actionLoading}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition ${
                            isAdmin
                              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          } disabled:opacity-50`}
                        >
                          {roleLoading
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : isAdmin ? <User className="w-3.5 h-3.5" /> : <Crown className="w-3.5 h-3.5" />
                          }
                          {isAdmin ? 'Jadikan User' : 'Jadikan Admin'}
                        </button>

                        <button
                          onClick={() => handleToggleStatus(user)}
                          disabled={!!actionLoading}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition ${
                            isActive
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          } disabled:opacity-50`}
                        >
                          {statusLoading
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />
                          }
                          {isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── TAB: KODE UNDANGAN ── */}
      {tab === 'invites' && (
        <div className="space-y-4">

          {/* Form buat kode */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-600" />
              Buat Kode Undangan Baru
            </p>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Keterangan (opsional)</label>
              <input
                type="text"
                value={keterangan}
                onChange={e => setKeterangan(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateCode()}
                placeholder="Contoh: Tim Lapangan Mei 2026"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
            {errorCodes && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{errorCodes}</p>
            )}
            <button
              onClick={handleCreateCode}
              disabled={creating}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {creating ? 'Membuat...' : 'Buat Kode'}
            </button>
          </div>

          {/* Statistik */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Tersedia" value={availableCodes.length} color="emerald" icon={<Key className="w-4 h-4" />} />
            <StatCard label="Terpakai" value={usedCodes.length} color="amber" icon={<ShieldCheck className="w-4 h-4" />} />
          </div>

          {loadingCodes && (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse h-16" />
              ))}
            </div>
          )}

          {/* Kode aktif */}
          {!loadingCodes && availableCodes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 px-1">Belum Digunakan</p>
              {availableCodes.map(c => (
                <div key={c.code} className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-mono font-bold text-emerald-700 tracking-widest">{c.code}</p>
                      {c.keterangan && <p className="text-xs text-gray-500 mt-0.5">{c.keterangan}</p>}
                      <p className="text-[10px] text-gray-400 mt-1">
                        Dibuat: {new Date(c.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleCopy(c.code)}
                        className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center hover:bg-emerald-100 transition text-emerald-700"
                        title="Salin kode"
                      >
                        {copiedCode === c.code
                          ? <Check className="w-4 h-4" />
                          : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDeleteCode(c.code)}
                        disabled={deletingCode === c.code}
                        className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center hover:bg-red-100 transition text-red-600 disabled:opacity-50"
                        title="Hapus kode"
                      >
                        {deletingCode === c.code
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Kode terpakai */}
          {!loadingCodes && usedCodes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 px-1">Sudah Digunakan</p>
              {usedCodes.map(c => (
                <div key={c.code} className="bg-gray-50 rounded-2xl border border-gray-200 p-4 opacity-60">
                  <p className="text-base font-mono font-bold text-gray-500 tracking-widest line-through">{c.code}</p>
                  {c.keterangan && <p className="text-xs text-gray-400 mt-0.5">{c.keterangan}</p>}
                  {c.usedBy && (
                    <p className="text-[10px] text-gray-400 mt-1">Digunakan oleh: {c.usedBy}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {!loadingCodes && codes.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-400">
              Belum ada kode undangan. Buat kode di atas untuk dibagikan ke pengguna baru.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label, value, color, icon,
}: {
  label: string; value: number; color: 'emerald' | 'amber' | 'blue'; icon: React.ReactNode;
}) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
  };
  return (
    <div className={`rounded-2xl border p-3 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-1 opacity-70">{icon}<span className="text-[10px] font-medium">{label}</span></div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
