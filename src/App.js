import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/main.css';

import Login from './pages/Login';
import ReceptionDashboard from './pages/ReceptionDashboard';
import DepartmentDashboard from './pages/DepartmentDashboard';
import AdminDashboard from './pages/AdminDashboard';

const ROLE_ROUTES = {
  reception: '/reception',
  housekeeping: '/department',
  kitchen: '/department',
  maintenance: '/department',
  admin: '/admin',
};

// Protect routes: redirect to login if no token
const PrivateRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  if (!token) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={ROLE_ROUTES[role] || '/login'} replace />;
  }
  return children;
};

// Redirect logged-in users away from login
const PublicRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  if (token && role) return <Navigate to={ROLE_ROUTES[role]} replace />;
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick pauseOnHover />
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/reception" element={<PrivateRoute allowedRoles={['reception']}><ReceptionDashboard /></PrivateRoute>} />
        <Route path="/department" element={<PrivateRoute allowedRoles={['housekeeping', 'kitchen', 'maintenance']}><DepartmentDashboard /></PrivateRoute>} />
        <Route path="/admin" element={<PrivateRoute allowedRoles={['admin']}><AdminDashboard /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
