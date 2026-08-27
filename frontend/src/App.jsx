import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import UserDashboard from './pages/UserDashboard';
import HealthcareDashboard from './pages/HealthcareDashboard';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { token, user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#f8f9fb', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>🛡️ VitalGuard</h2>
          <p style={{ color: '#475569' }}>Authenticating user session...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && (!user || !allowedRoles.includes(user.role))) {
    if (user?.role === 'PATIENT' || user?.role === 'FAMILY_MEMBER') {
      return <Navigate to="/user-dashboard" replace />;
    }
    return <Navigate to="/healthcare-dashboard" replace />;
  }

  return children;
};

function App() {
  const { token, user } = useAuth();

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        
        <Route 
          path="/user-dashboard" 
          element={
            <ProtectedRoute allowedRoles={['PATIENT', 'FAMILY_MEMBER']}>
              <UserDashboard />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/healthcare-dashboard" 
          element={
            <ProtectedRoute allowedRoles={['DOCTOR', 'HOSPITAL_ADMIN']}>
              <HealthcareDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Catch-all redirect */}
        <Route 
          path="*" 
          element={
            token ? (
              user?.role === 'PATIENT' || user?.role === 'FAMILY_MEMBER' ? (
                <Navigate to="/user-dashboard" replace />
              ) : (
                <Navigate to="/healthcare-dashboard" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;
