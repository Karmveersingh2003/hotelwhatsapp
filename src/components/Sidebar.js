import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { disconnectSocket } from '../services/socket';

const NAV_ITEMS = {
  reception: [
    { to: '/reception', icon: '📋', label: 'Dashboard' },
  ],
  housekeeping: [
    { to: '/department', icon: '🧹', label: 'My Tasks' },
  ],
  kitchen: [
    { to: '/department', icon: '🍽️', label: 'My Tasks' },
  ],
  maintenance: [
    { to: '/department', icon: '🔧', label: 'My Tasks' },
  ],
  admin: [
    { to: '/admin', icon: '📊', label: 'Dashboard' },
  ],
};

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const role = localStorage.getItem('role') || '';
  const username = localStorage.getItem('username') || role;
  const items = NAV_ITEMS[role] || [];

  const handleLogout = () => {
    disconnectSocket();
    localStorage.clear();
    navigate('/login');
  };

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <h2>🏨 HotelTask</h2>
          <span>Internal Management</span>
        </div>
        <nav className="sidebar-nav">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{username.charAt(0).toUpperCase()}</div>
            <div>
              <div className="user-name">{username}</div>
              <div className="user-role">{role}</div>
            </div>
          </div>
          <button className="btn btn-danger btn-sm" style={{ width: '100%' }} onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
