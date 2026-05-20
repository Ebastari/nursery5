import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './layout/Layout';
import { AuthGuard } from './components/AuthGuard';
import { LoginScreen } from './screens/LoginScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { ForgotPasswordScreen } from './screens/ForgotPasswordScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { AdminUsersScreen } from './screens/AdminUsersScreen';
import DashboardScreen from './screens/DashboardScreen';
import { InputFormScreen } from './screens/InputFormScreen';
import { StockScreen } from './screens/StockScreen';
import { DistributionScreen } from './screens/DistributionScreen';
import { DocumentScreen } from './screens/DocumentScreen';
import { AlertScreen } from './screens/AlertScreen';
import { PerformanceScreen } from './screens/PerformanceScreen';
import { SuratJalanScreen } from './screens/SuratJalanScreen';
import { VerifyScreen } from './screens/VerifyScreen';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/register" element={<RegisterScreen />} />
        <Route path="/forgot-password" element={<ForgotPasswordScreen />} />

        {/* Protected routes */}
        <Route element={<AuthGuard />}>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardScreen />} />
            <Route path="/input" element={<InputFormScreen />} />
            <Route path="/stock" element={<StockScreen />} />
            <Route path="/performance" element={<PerformanceScreen />} />
            <Route path="/distribution" element={<DistributionScreen />} />
            <Route path="/documents" element={<DocumentScreen />} />
            <Route path="/alerts" element={<AlertScreen />} />
            <Route path="/surat-jalan" element={<SuratJalanScreen />} />
            <Route path="/verify" element={<VerifyScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="/admin/users" element={<AdminUsersScreen />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
