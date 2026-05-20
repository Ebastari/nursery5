import { Navigate, Outlet } from 'react-router-dom';
import { useStore } from '../store/useStore';

export function AuthGuard() {
  const { isLoggedIn } = useStore();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <Outlet />;
}
