import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import TaskCard from '../components/TaskCard';
import { getTasks, getDeletedTasks, getStaff, addStaff, deleteStaff, exportCSV, getAnalytics } from '../services/api';
import { connectSocket } from '../services/socket';

const DEPTS = ['housekeeping', 'kitchen', 'maintenance'];
const DEPT_COLORS = { housekeeping: '#3b82f6', kitchen: '#f59e0b', maintenance: '#10b981' };

const AdminDashboard = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('tasks');

  // Filters
  const [filterDept, setFilterDept] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Staff
  const [staffList, setStaffList] = useState([]);
  const [staffForm, setStaffForm] = useState({ name: '', department: 'housekeeping' });
  const [staffLoading, setStaffLoading] = useState(false);

  // Analytics
  const [chartData, setChartData] = useState([]);
  const [staffPerf, setStaffPerf] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Deleted tasks
  const [deletedTasks, setDeletedTasks] = useState([]);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [deletedSearch, setDeletedSearch] = useState('');
  const [deletedFrom, setDeletedFrom] = useState('');
  const [deletedTo, setDeletedTo] = useState('');

  // Dark mode
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');

  useEffect(() => {
    document.body.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  const fetchTasks = useCallback(async () => {
    try {
      const params = {};
      if (filterDept !== 'all') params.department = filterDept;
      if (filterStatus !== 'all') params.status = filterStatus;
      if (search) params.search = search;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      const { data } = await getTasks(params);
      setTasks(data.tasks || data || []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [filterDept, filterStatus, search, dateFrom, dateTo]);

  const fetchStaff = useCallback(async () => {
    try {
      const { data } = await getStaff();
      setStaffList(data.staff || []);
    } catch { setStaffList([]); }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const { data } = await getAnalytics();
      setChartData(data.chartData || []);
      setStaffPerf(data.staffPerformance || []);
    } catch { }
    finally { setAnalyticsLoading(false); }
  }, []);

  const fetchDeletedTasks = useCallback(async () => {
    setDeletedLoading(true);
    try {
      const params = {};
      if (deletedSearch) params.search = deletedSearch;
      if (deletedFrom) params.from = deletedFrom;
      if (deletedTo) params.to = deletedTo;
      const { data } = await getDeletedTasks(params);
      setDeletedTasks(data.tasks || []);
    } catch { setDeletedTasks([]); }
    finally { setDeletedLoading(false); }
  }, [deletedSearch, deletedFrom, deletedTo]);

  useEffect(() => {
    fetchTasks();
    fetchStaff();
    const socket = connectSocket('admin');
    socket.on('newTask', (task) => {
      setTasks((prev) => {
        const exists = prev.some((t) => (t._id || t.id) === (task._id || task.id));
        if (exists) return prev;
        toast.info(`New task: Room ${task.roomNumber} → ${task.department}`);
        return [task, ...prev];
      });
    });
    socket.on('taskUpdated', ({ id, status, doneBy, doneAt, history, department }) => {
      setTasks((prev) => prev.map((t) =>
        (t._id === id || t.id === id) ? { ...t, status, doneBy, doneAt, history, ...(department && { department }) } : t
      ));
    });
    socket.on('taskDeleted', ({ id }) => {
      // Remove from active tasks list
      setTasks((prev) => prev.filter((t) => (t._id || t.id) !== id));
      // Refresh deleted list if that tab is open
      setDeletedTasks((prev) => {
        // will be refreshed when tab opens
        return prev;
      });
    });
    return () => { socket.off('newTask'); socket.off('taskUpdated'); socket.off('taskDeleted'); };
  }, [fetchTasks, fetchStaff]);

  // Fetch analytics when tab opens
  useEffect(() => {
    if (activeTab === 'analytics') fetchAnalytics();
    if (activeTab === 'deleted') fetchDeletedTasks();
  }, [activeTab, fetchAnalytics, fetchDeletedTasks]);

  // Debounced re-fetch deleted tasks on filter change
  useEffect(() => {
    if (activeTab !== 'deleted') return;
    const t = setTimeout(() => fetchDeletedTasks(), 400);
    return () => clearTimeout(t);
  }, [deletedSearch, deletedFrom, deletedTo, activeTab, fetchDeletedTasks]);

  // Debounced re-fetch on filter change
  useEffect(() => {
    const t = setTimeout(() => fetchTasks(), 400);
    return () => clearTimeout(t);
  }, [search, dateFrom, dateTo, filterDept, filterStatus, fetchTasks]);

  const handleUpdate = (id, status, doneBy, updatedTask) => {
    setTasks((prev) => prev.map((t) => (t._id === id || t.id === id) ? (updatedTask || { ...t, status, doneBy }) : t));
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!staffForm.name.trim()) return toast.error('Name is required');
    setStaffLoading(true);
    try {
      const { data } = await addStaff(staffForm);
      setStaffList((prev) => [...prev, data.staff]);
      setStaffForm({ name: '', department: staffForm.department });
      toast.success(`${data.staff.name} added`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add staff');
    } finally { setStaffLoading(false); }
  };

  const handleDeleteStaff = async (id, name) => {
    if (!window.confirm(`Remove ${name}?`)) return;
    try {
      await deleteStaff(id);
      setStaffList((prev) => prev.filter((s) => (s._id || s.id) !== id));
      toast.success(`${name} removed`);
    } catch { toast.error('Failed to remove'); }
  };

  const handleExportCSV = async () => {
    try {
      const { data } = await exportCSV();
      const url = URL.createObjectURL(new Blob([data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url; a.download = `tasks-${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded!');
    } catch { toast.error('Export failed'); }
  };

  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    inProgress: tasks.filter((t) => t.status === 'in-progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
  };

  const TABS = [
    { id: 'tasks', label: '📋 Tasks' },
    { id: 'analytics', label: '📊 Analytics' },
    { id: 'staff', label: '👥 Staff' },
    { id: 'deleted', label: '🗑️ Deleted' },
  ];

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Navbar title="Admin Dashboard" onMenuClick={() => setSidebarOpen(true)}>
          <button className="btn btn-sm btn-outline" onClick={() => setDarkMode((d) => !d)}>
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button className="btn btn-sm btn-outline" onClick={handleExportCSV}>📥 CSV</button>
          <button className="btn btn-sm btn-outline" onClick={() => { fetchTasks(); fetchStaff(); }}>🔄</button>
        </Navbar>

        <div className="page-content">
          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card"><span className="stat-value">{stats.total}</span><span className="stat-label">Total</span></div>
            <div className="stat-card pending"><span className="stat-value">{stats.pending}</span><span className="stat-label">Pending</span></div>
            <div className="stat-card inprogress"><span className="stat-value">{stats.inProgress}</span><span className="stat-label">In Progress</span></div>
            <div className="stat-card done"><span className="stat-value">{stats.done}</span><span className="stat-label">Done</span></div>
          </div>

          {/* Tabs */}
          <div className="tab-bar">
            {TABS.map((t) => (
              <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── TASKS TAB ── */}
          {activeTab === 'tasks' && (
            <>
              <div className="filters-bar">
                <input className="search-input" placeholder="🔍 Search room..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <input type="date" className="filter-select" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <input type="date" className="filter-select" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                <select className="filter-select" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
                  <option value="all">All Depts</option>
                  {DEPTS.map((d) => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                </select>
                <select className="filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
                {(search || dateFrom || dateTo || filterDept !== 'all' || filterStatus !== 'all') && (
                  <button className="btn btn-sm btn-outline" onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setFilterDept('all'); setFilterStatus('all'); }}>✕ Clear</button>
                )}
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{tasks.length} tasks</span>
              </div>
              {loading ? (
                <div className="loading-spinner"><div className="spinner" /></div>
              ) : tasks.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">🔍</div><p>No tasks found.</p></div>
              ) : (
                <div className="tasks-grid">
                  {tasks.map((task) => (
                    <TaskCard key={task._id || task.id} task={task} onUpdate={handleUpdate} showReassign />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── ANALYTICS TAB ── */}
          {activeTab === 'analytics' && (
            <div className="analytics-panel">
              {analyticsLoading ? (
                <div className="loading-spinner"><div className="spinner" /></div>
              ) : (
                <>
                  {/* Bar Chart */}
                  <div className="chart-card">
                    <h2 className="chart-title">📊 Tasks per Department (Last 7 Days)</h2>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        {DEPTS.map((d) => (
                          <Bar key={d} dataKey={d} fill={DEPT_COLORS[d]} radius={[4, 4, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Staff Performance */}
                  <div className="chart-card">
                    <h2 className="chart-title">🏆 Staff Performance This Week</h2>
                    {staffPerf.length === 0 ? (
                      <div className="empty-state"><div className="empty-icon">📭</div><p>No completed tasks this week.</p></div>
                    ) : (
                      <div className="perf-list">
                        {staffPerf.map((s, i) => (
                          <div key={s.name} className="perf-item">
                            <span className="perf-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                            <div className="perf-info">
                              <span className="perf-name">{s.name}</span>
                              <span className="perf-dept">{s.department}</span>
                            </div>
                            <div className="perf-bar-wrap">
                              <div
                                className="perf-bar"
                                style={{ width: `${Math.min(100, (s.completed / (staffPerf[0]?.completed || 1)) * 100)}%`, background: DEPT_COLORS[s.department] }}
                              />
                            </div>
                            <span className="perf-count">{s.completed} tasks</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── DELETED TAB ── */}
          {activeTab === 'deleted' && (
            <div>
              <div className="filters-bar">
                <input className="search-input" placeholder="🔍 Search room..." value={deletedSearch} onChange={(e) => setDeletedSearch(e.target.value)} />
                <input type="date" className="filter-select" value={deletedFrom} onChange={(e) => setDeletedFrom(e.target.value)} title="Deleted from" />
                <input type="date" className="filter-select" value={deletedTo} onChange={(e) => setDeletedTo(e.target.value)} title="Deleted to" />
                {(deletedSearch || deletedFrom || deletedTo) && (
                  <button className="btn btn-sm btn-outline" onClick={() => { setDeletedSearch(''); setDeletedFrom(''); setDeletedTo(''); }}>✕ Clear</button>
                )}
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{deletedTasks.length} deleted</span>
              </div>
              {deletedLoading ? (
                <div className="loading-spinner"><div className="spinner" /></div>
              ) : deletedTasks.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">🗑️</div><p>No deleted tasks found.</p></div>
              ) : (
                <div className="tasks-grid">
                  {deletedTasks.map((task) => (
                    <div key={task._id || task.id} className="task-card deleted-task">
                      <div className="task-card-header">
                        <span className="room-badge">🏨 Room {task.roomNumber}</span>
                        <span className="status-badge deleted-badge">🗑️ Deleted</span>
                      </div>
                      <p className="task-description">{task.description}</p>
                      <div className="task-meta">
                        <div className="task-meta-info">
                          <span className="dept-tag">📂 {task.department}</span>
                          <span className="task-time">🗑️ Deleted by <strong>{task.deletedBy}</strong></span>
                          <span className="task-time">🕐 {new Date(task.deletedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {task.priority && <span className={`priority-tag ${task.priority}`}>{task.priority.toUpperCase()}</span>}
                      </div>
                      <div className="deleted-original-status">
                        Was: <span className={`status-badge ${task.status}`}>{task.status}</span>
                        &nbsp;&middot;&nbsp;Created: {new Date(task.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── STAFF TAB ── */}
          {activeTab === 'staff' && (
            <div className="staff-panel">
              <div className="task-form-card">
                <h2>➕ Add Staff Member</h2>
                <form onSubmit={handleAddStaff}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Full Name</label>
                      <input placeholder="e.g. Raju Kumar" value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Department</label>
                      <select value={staffForm.department} onChange={(e) => setStaffForm({ ...staffForm, department: e.target.value })}>
                        {DEPTS.map((d) => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                      </select>
                    </div>
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={staffLoading} style={{ width: 'auto', minWidth: 140 }}>
                    {staffLoading ? 'Adding...' : '➕ Add Staff'}
                  </button>
                </form>
              </div>
              {DEPTS.map((dept) => {
                const members = staffList.filter((s) => s.department === dept);
                return (
                  <div key={dept} className="staff-dept-group">
                    <div className="section-header">
                      <h2>{dept === 'housekeeping' ? '🧹' : dept === 'kitchen' ? '🍽️' : '🔧'} {dept} ({members.length})</h2>
                    </div>
                    {members.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>No staff added yet.</p>
                    ) : (
                      <div className="staff-list">
                        {members.map((s) => (
                          <div key={s._id || s.id} className="staff-item">
                            <div className="staff-avatar">{s.name.charAt(0).toUpperCase()}</div>
                            <span className="staff-name">{s.name}</span>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteStaff(s._id || s.id, s.name)}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
