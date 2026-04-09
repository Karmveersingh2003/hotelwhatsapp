import React from 'react';

const Navbar = ({ title, onMenuClick, children }) => (
  <div className="topbar">
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <button className="hamburger" onClick={onMenuClick}>☰</button>
      <h1>{title}</h1>
    </div>
    <div className="topbar-right">{children}</div>
  </div>
);

export default Navbar;
