import { create } from 'zustand';
import type { PlantStock, ActivityRecord, Shipment, Document, Alert, Notification, ApprovalRecord } from '../data/types';

import {
  fetchApiData, clearCache, approveDocument,
  loginUser as apiLogin, registerUser as apiRegister,
} from '../data/api';
import type { AuthUser, ApiRow } from '../data/api';
import { getLastUpdated } from '../data/indexedDb';
import { derivePlants, deriveActivities, deriveShipments, deriveAlerts, api as mockApi } from '../data/mockData';

const AUTH_KEY = 'sn_auth';
const SESSION_EXPIRE_DAYS = 30;

function loadAuthFromStorage(): { user: AuthUser; token: string; loginAt: string } | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.loginAt) {
      const diffMs = Date.now() - new Date(data.loginAt).getTime();
      if (diffMs > SESSION_EXPIRE_DAYS * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(AUTH_KEY);
        return null;
      }
    }
    return data;
  } catch {
    return null;
  }
}

function deriveNotifications(rows: ApiRow[]): Notification[] {
  return rows
    .filter((r) => r.masuk > 0 || r.keluar > 0 || r.mati > 0)
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
    .slice(0, 50)
    .map((r, i) => {
      const jenis: 'masuk' | 'keluar' | 'mati' = r.keluar > 0 ? 'keluar' : r.masuk > 0 ? 'masuk' : 'mati';
      const jumlah = r.keluar > 0 ? r.keluar : r.masuk > 0 ? r.masuk : r.mati;
      return {
        id: `notif-${i}`,
        tanggal: r.tanggal,
        bibit: r.bibit,
        jumlah,
        jenis,
        sumber: r.sumber,
        tujuan: r.tujuan,
        statusKirim: r.statusKirim || 'Baru',
        read: false,
      };
    });
}

interface AppState {
  // Data
  plants: PlantStock[];
  activities: ActivityRecord[];
  shipments: Shipment[];
  documents: Document[];
  alerts: Alert[];
  notifications: Notification[];
  approvals: ApprovalRecord[];

  // Auth
  authUser: AuthUser | null;
  authToken: string | null;
  isLoggedIn: boolean;
  loginUser: (nomorHp: string, password: string) => Promise<boolean>;
  registerUser: (nomorHp: string, nama: string, password: string, inviteCode: string) => Promise<boolean>;
  logout: () => void;
  loadAuth: () => void;

  // Admin mode
  isAdmin: boolean;
  adminPassword: string;

  // Input form (persists across navigation)
  inputForm: { tanggal: string; bibit: string; masuk: string; keluar: string; mati: string; sumber: string; tujuan: string; dibuatOleh: string; driver: string };
  setInputForm: (patch: Partial<AppState['inputForm']>) => void;
  resetInputForm: () => void;

  // Offline sync
  lastUpdated: string | null;

  // Loading states
  loadingPlants: boolean;
  loadingActivities: boolean;
  loadingShipments: boolean;
  loadingDocuments: boolean;
  loadingAlerts: boolean;
  loadingNotifications: boolean;
  submitting: boolean;
  approvalError: string | null;

  // Actions
  loadLastUpdated: () => Promise<void>;
  fetchPlants: () => Promise<void>;
  fetchActivities: () => Promise<void>;
  fetchShipments: () => Promise<void>;
  fetchDocuments: () => Promise<void>;
  fetchAlerts: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  refreshAll: () => Promise<void>;
  submitActivity: (record: Omit<ActivityRecord, 'id'>) => Promise<void>;
  generateDocument: (shipmentId: string) => Promise<void>;
  markAlertRead: (id: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  setAdminMode: (password: string) => boolean;
  clearAdminMode: () => void;
  approveSuratJalan: (id: string, approvedBy: string) => void;
  rejectSuratJalan: (id: string, reason: string) => void;
  setApprovalError: (error: string | null) => void;
}

const _storedAuth = loadAuthFromStorage();

export const useStore = create<AppState>((set, get) => ({
  plants: [],
  activities: [],
  shipments: [],
  documents: [],
  alerts: [],
  notifications: [],
  approvals: [],

  // Auth
  authUser: _storedAuth?.user ?? null,
  authToken: _storedAuth?.token ?? null,
  isLoggedIn: !!_storedAuth,

  loadAuth: () => {
    const stored = loadAuthFromStorage();
    set({
      authUser: stored?.user ?? null,
      authToken: stored?.token ?? null,
      isLoggedIn: !!stored,
      isAdmin: stored?.user?.role === 'admin',
    });
  },

  loginUser: async (nomorHp, password) => {
    const res = await apiLogin(nomorHp, password);
    if (!res.success || !res.user || !res.token) {
      throw new Error(res.error || 'Nomor HP atau password salah');
    }
    const loginAt = new Date().toISOString();
    localStorage.setItem(AUTH_KEY, JSON.stringify({ user: res.user, token: res.token, loginAt }));
    set({ authUser: res.user, authToken: res.token, isLoggedIn: true, isAdmin: res.user.role === 'admin' });
    return true;
  },

  registerUser: async (nomorHp, nama, password, inviteCode) => {
    const res = await apiRegister(nomorHp, nama, password, inviteCode);
    if (!res.success || !res.user || !res.token) throw new Error(res.error || 'Pendaftaran gagal');
    const loginAt = new Date().toISOString();
    localStorage.setItem(AUTH_KEY, JSON.stringify({ user: res.user, token: res.token, loginAt }));
    set({ authUser: res.user, authToken: res.token, isLoggedIn: true, isAdmin: res.user.role === 'admin' });
    return true;
  },

  logout: () => {
    localStorage.removeItem(AUTH_KEY);
    set({ authUser: null, authToken: null, isLoggedIn: false, isAdmin: false });
  },

  isAdmin: _storedAuth?.user?.role === 'admin',
  adminPassword: 'admin123',

  inputForm: {
    tanggal: new Date().toISOString().split('T')[0],
    bibit: '',
    masuk: '',
    keluar: '',
    mati: '',
    sumber: '',
    tujuan: '',
    dibuatOleh: '',
    driver: '',
  },

  setInputForm: (patch) => {
    set((state) => ({ inputForm: { ...state.inputForm, ...patch } }));
  },

  resetInputForm: () => {
    set({
      inputForm: {
        tanggal: new Date().toISOString().split('T')[0],
        bibit: '',
        masuk: '',
        keluar: '',
        mati: '',
        sumber: '',
        tujuan: '',
        dibuatOleh: '',
        driver: '',
      },
    });
  },

  lastUpdated: null,

  loadingPlants: false,
  loadingActivities: false,
  loadingShipments: false,
  loadingDocuments: false,
  loadingAlerts: false,
  loadingNotifications: false,
  submitting: false,
  approvalError: null as string | null,

  loadLastUpdated: async () => {
    try {
      const ts = await getLastUpdated();
      set({ lastUpdated: ts });
    } catch { /* ignore */ }
  },


  fetchPlants: async () => {
    set({ loadingPlants: true });
    const rows = await fetchApiData();
    const plants = derivePlants(rows);
    set({ plants, loadingPlants: false });
  },

  fetchActivities: async () => {
    set({ loadingActivities: true });
    const rows = await fetchApiData();
    const activities = deriveActivities(rows);
    set({ activities, loadingActivities: false });
  },

  fetchShipments: async () => {
    set({ loadingShipments: true });
    const rows = await fetchApiData();
    const shipments = deriveShipments(rows);
    set({ shipments, loadingShipments: false });
  },

  fetchDocuments: async () => {
    set({ loadingDocuments: true });
    const documents = await mockApi.getDocuments();
    set({ documents, loadingDocuments: false });
  },

  fetchAlerts: async () => {
    set({ loadingAlerts: true });
    const rows = await fetchApiData();
    const plants = derivePlants(rows);
    const alerts = deriveAlerts(plants, rows);
    set({ alerts, loadingAlerts: false });
  },

  fetchNotifications: async () => {
    set({ loadingNotifications: true });
    try {
      const rows = await fetchApiData();
      const notifications = deriveNotifications(rows);
      const ts = await getLastUpdated();
      set({ notifications, loadingNotifications: false, lastUpdated: ts });
    } catch {
      set({ loadingNotifications: false });
    }
  },

  refreshAll: async () => {
    clearCache();
    const { fetchPlants, fetchActivities, fetchAlerts, fetchNotifications, loadLastUpdated } = get();
    await Promise.all([fetchPlants(), fetchActivities(), fetchAlerts(), fetchNotifications()]);
    await loadLastUpdated();
  },

  submitActivity: async (record) => {
    set({ submitting: true });
    try {
      const newActivity = await mockApi.submitActivity(record);
      clearCache();
      set((state) => ({
        activities: [newActivity, ...state.activities],
        submitting: false,
      }));
      // Refresh data dari server setelah submit
      get().refreshAll();
    } catch (err) {
      set({ submitting: false });
      throw err;
    }
  },

  generateDocument: async (shipmentId) => {
    set({ submitting: true });
    const doc = await mockApi.generateDocument(shipmentId);
    set((state) => ({
      documents: [doc, ...state.documents],
      submitting: false,
    }));
  },

  markAlertRead: (id) => {
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, read: true } : a)),
    }));
  },

  markNotificationRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  },

  setApprovalError: (error: string | null) => set({ approvalError: error }),
  
  markAllNotificationsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
  },

  setAdminMode: (password) => {
    const correctPassword = 'admin123';
    if (password === correctPassword) {
      set({ isAdmin: true, adminPassword: password });
      return true;
    }
    return false;
  },

  clearAdminMode: () => {
    set({ isAdmin: false, adminPassword: '' });
  },

  approveSuratJalan: async (nomorSurat: string, approvedBy: string) => {
    const { refreshAll } = get();
    // Optimistic update
    set((state: AppState) => {
      const exists = state.approvals.find((a: ApprovalRecord) => a.nomorSurat === nomorSurat);
      const newApproval: ApprovalRecord = {
        id: `approval-${Date.now()}`,
        nomorSurat,
        tanggal: new Date().toISOString().split('T')[0],
        bibit: '-',
        jumlah: 0,
        tujuan: '-',
        status: 'approved',
        dibuatOleh: approvedBy,
        approvedBy,
        approvedAt: new Date().toISOString(),
      };
      if (exists) {
        return {
          approvals: state.approvals.map((a: ApprovalRecord) =>
            a.nomorSurat === nomorSurat
              ? { ...a, status: 'approved' as const, approvedBy, approvedAt: new Date().toISOString() }
              : a
          ),
        };
      }
      return { approvals: [newApproval, ...state.approvals] };
    });

    try {
      // Call backend API
      await approveDocument(nomorSurat, approvedBy);
      
      // Refresh all data from Sheet (sync frontend with backend)
      await refreshAll();
    } catch (error) {
      // Rollback optimistic update on error
      await refreshAll();
      throw error;
    }
  },

  rejectSuratJalan: (nomorSurat, reason) => {
    set((state) => {
      const exists = state.approvals.find((a) => a.nomorSurat === nomorSurat);
      if (exists) {
        return {
          approvals: state.approvals.map((a) =>
            a.nomorSurat === nomorSurat
              ? { ...a, status: 'rejected' as const, rejectionReason: reason }
              : a
          ),
        };
      }
      const newApproval: ApprovalRecord = {
        id: `approval-${Date.now()}`,
        nomorSurat,
        tanggal: new Date().toISOString().split('T')[0],
        bibit: '-',
        jumlah: 0,
        tujuan: '-',
        status: 'rejected',
        dibuatOleh: '-',
        rejectionReason: reason,
      };
      return { approvals: [newApproval, ...state.approvals] };
    });
  },
}));
