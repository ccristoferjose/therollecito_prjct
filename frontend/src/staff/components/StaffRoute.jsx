import { Navigate } from 'react-router-dom';
import { useStaffAuth } from '@shared/context/StaffAuthContext';

export default function StaffRoute({ children, allowedRoles }) {
  const { isAuthenticated, user } = useStaffAuth();

  if (!isAuthenticated) {
    return <Navigate to="/staff/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/staff/login" replace />;
  }

  return children;
}
