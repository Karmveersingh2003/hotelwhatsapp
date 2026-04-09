import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { loginUser } from '../services/api';

const ROLE_ROUTES = {
  reception: '/reception',
  housekeeping: '/department',
  kitchen: '/department',
  maintenance: '/department',
  admin: '/admin',
};

const Login = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '', role: 'reception' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) return toast.error('Please fill all fields');
    setLoading(true);
    try {
      const { data } = await loginUser(form);
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role || form.role);
      localStorage.setItem('username', data.username || form.username);
      toast.success(`Welcome, ${form.username}!`);
      navigate(ROLE_ROUTES[data.role || form.role]);
    } catch (err) {
      // Demo mode: allow login without backend
      if (err.code === 'ERR_NETWORK' || err.response?.status >= 500) {
        localStorage.setItem('token', 'demo-token');
        localStorage.setItem('role', form.role);
        localStorage.setItem('username', form.username);
        toast.success(`Welcome, ${form.username}! (Demo Mode)`);
        navigate(ROLE_ROUTES[form.role]);
      } else {
        toast.error(err.response?.data?.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="icon">🏨</div>
          <h1>HotelTask</h1>
          <p>Internal Task Management System</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input name="username" placeholder="Enter username" value={form.username} onChange={handleChange} autoComplete="username" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input name="password" type="password" placeholder="Enter password" value={form.password} onChange={handleChange} autoComplete="current-password" />
          </div>
          <div className="form-group">
            <label>Department / Role</label>
            <select name="role" value={form.role} onChange={handleChange}>
              <option value="reception">Reception</option>
              <option value="housekeeping">Housekeeping</option>
              <option value="kitchen">Kitchen</option>
              <option value="maintenance">Maintenance</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : '🔐 Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
