import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import { ToastProvider } from "./ToastContext";
import { colors, fonts } from "./theme";
import AuthPage from "./pages/AuthPage";
import DoctorDashboard from "./pages/DoctorDashboard";
import ConsultationPage from "./pages/ConsultationPage";
import PatientPortal from "./pages/PatientPortal";
import CaregiverPortal from "./pages/CaregiverPortal";

const HOME_BY_ROLE = {
  doctor: "/dashboard",
  patient: "/portal",
  caregiver: "/family",
};

function homeForRole(role) {
  return HOME_BY_ROLE[role] || "/";
}

function ProtectedRoute({ role, children }) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (role && user?.role !== role) {
    return <Navigate to={homeForRole(user?.role)} replace />;
  }
  return children;
}

function AppRoutes() {
  const { isAuthenticated, user } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={isAuthenticated ? <Navigate to={homeForRole(user?.role)} replace /> : <AuthPage />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute role="doctor">
            <DoctorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/consultation/:id"
        element={
          <ProtectedRoute role="doctor">
            <ConsultationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/portal"
        element={
          <ProtectedRoute role="patient">
            <PatientPortal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/family"
        element={
          <ProtectedRoute role="caregiver">
            <CaregiverPortal />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <style>{`
        * { box-sizing: border-box; }
        body {
          margin: 0;
          background: ${colors.bg};
          font-family: ${fonts.body};
          color: ${colors.text};
          -webkit-font-smoothing: antialiased;
        }
        button, input, textarea, select { font-family: ${fonts.body}; }
        ::placeholder { color: ${colors.textFaint}; }

        @media print {
          body * { visibility: hidden; }
          #printable-rx, #printable-rx * { visibility: visible; }
          #printable-rx {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  );
}
