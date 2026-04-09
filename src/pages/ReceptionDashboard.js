import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import TaskCard from '../components/TaskCard';
import { createTask, getTasks } from '../services/api';
import { connectSocket } from '../services/socket';

const ReceptionDashboard = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({ roomNumber: '', description: '', department: 'housekeeping', priority: 'medium' });

  // Pull-to-refresh touch tracking
  const touchStartY = useRef(0);
  const contentRef = useRef(null);

  const fetchTasks = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      const { data } = await getTasks(params);
      setTasks(data.tasks || data || []);
    } catch {
      // keep empty
    } finally {
      setLoading(false);
      if (showRefresh) setTimeout(() => setRefreshing(false), 600);
    }
  }, [search, dateFrom, dateTo]);

  // Update document title with unread count
  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) HotelTask` : 'HotelTask';
    return () => { document.title = 'HotelTask'; };
  }, [unreadCount]);

  // Reset unread when tab is focused
  useEffect(() => {
    const reset = () => setUnreadCount(0);
    window.addEventListener('focus', reset);
    return () => window.removeEventListener('focus', reset);
  }, []);

  useEffect(() => {
    fetchTasks();
    const socket = connectSocket('reception');
    socket.on('newTask', (task) => {
      setTasks((prev) => {
        const exists = prev.some((t) => (t._id || t.id) === (task._id || task.id));
        if (exists) return prev;
        if (!document.hasFocus()) setUnreadCount((c) => c + 1);
        toast.info(`🔔 New task — Room ${task.roomNumber}`);
        return [task, ...prev];
      });
    });
    socket.on('taskUpdated', ({ id, status, doneBy, doneAt, history }) => {
      setTasks((prev) => prev.map((t) => (t._id === id || t.id === id) ? { ...t, status, doneBy, doneAt, history } : t));
    });
    socket.on('taskDeleted', ({ id }) => {
      setTasks((prev) => prev.filter((t) => (t._id || t.id) !== id));
    });
    return () => { socket.off('newTask'); socket.off('taskUpdated'); socket.off('taskDeleted'); };
  }, [fetchTasks]);

  // Re-fetch when search/date filters change
  useEffect(() => {
    const timer = setTimeout(() => fetchTasks(), 400);
    return () => clearTimeout(timer);
  }, [search, dateFrom, dateTo, fetchTasks]);

  // Pull-to-refresh handlers
  const onTouchStart = (e) => { touchStartY.current = e.touches[0].clientY; };
  const onTouchEnd = (e) => {
    const diff = e.changedTouches[0].clientY - touchStartY.current;
    if (diff > 80 && contentRef.current?.scrollTop === 0) fetchTasks(true);
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.roomNumber || !form.description) return toast.error('Room number and description are required');
    setSubmitting(true);
    try {
      await createTask({ ...form, status: 'pending' });
      setForm({ roomNumber: '', description: '', department: 'housekeeping', priority: 'medium' });
      toast.success('Task assigned!');
    } catch (err) {
      if (err.code === 'ERR_NETWORK' || err.response?.status >= 500) {
        const demoTask = { id: Date.now(), ...form, status: 'pending', createdAt: new Date().toISOString() };
        setTasks((prev) => [demoTask, ...prev]);
        setForm({ roomNumber: '', description: '', department: 'housekeeping', priority: 'medium' });
        toast.success('Task created (Demo Mode)');
      } else {
        toast.error('Failed to create task');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = (id, status, doneBy, updatedTask) => {
    setTasks((prev) => prev.map((t) => (t._id === id || t.id === id) ? (updatedTask || { ...t, status, doneBy }) : t));
  };

  const handleDelete = (id) => {
    setTasks((prev) => prev.filter((t) => (t._id || t.id) !== id));
  };

  const filtered = tasks.filter((t) => filterStatus === 'all' || t.status === filterStatus);

  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    inProgress: tasks.filter((t) => t.status === 'in-progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
  };

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content" ref={contentRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <Navbar title="Reception Dashboard" onMenuClick={() => setSidebarOpen(true)}>
          {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
          </span>
        </Navbar>

        {/* Pull-to-refresh indicator */}
        {refreshing && (
          <div style={{ textAlign: 'center', padding: '0.5rem', background: 'var(--inprogress-bg)', color: 'var(--inprogress)', fontSize: '0.8rem' }}>
            🔄 Refreshing...
          </div>
        )}

        <div className="page-content">
          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card"><span className="stat-value">{stats.total}</span><span className="stat-label">Total</span></div>
            <div className="stat-card pending"><span className="stat-value">{stats.pending}</span><span className="stat-label">Pending</span></div>
            <div className="stat-card inprogress"><span className="stat-value">{stats.inProgress}</span><span className="stat-label">In Progress</span></div>
            <div className="stat-card done"><span className="stat-value">{stats.done}</span><span className="stat-label">Done</span></div>
          </div>

          {/* Create Task Form */}
          <div className="task-form-card">
            <h2>➕ Create New Task</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Room Number</label>
                  <input name="roomNumber" placeholder="e.g. 101" value={form.roomNumber} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <select name="department" value={form.department} onChange={handleChange}>
                    <option value="housekeeping">Housekeeping</option>
                    <option value="kitchen">Kitchen</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Task Description</label>
                  <input name="description" placeholder="Describe the task..." value={form.description} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <select name="priority" value={form.priority} onChange={handleChange}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: 'auto', minWidth: 160 }}>
                {submitting ? 'Creating...' : '📤 Assign Task'}
              </button>
            </form>
          </div>

          {/* Search & Filters */}
          <div className="filters-bar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <input
              className="search-input"
              placeholder="🔍 Search room number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <input type="date" className="filter-select" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From date" />
            <input type="date" className="filter-select" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="To date" />
            {(search || dateFrom || dateTo) && (
              <button className="btn btn-sm btn-outline" onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}>✕ Clear</button>
            )}
            <select className="filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>

          <div className="section-header">
            <h2>📋 Tasks ({filtered.length})</h2>
          </div>

          {loading ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📭</div><p>No tasks found.</p></div>
          ) : (
            <div className="tasks-grid">
              {filtered.map((task) => (
                <TaskCard key={task._id || task.id} task={task} onUpdate={handleUpdate} onDelete={handleDelete} showDelete />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceptionDashboard;
