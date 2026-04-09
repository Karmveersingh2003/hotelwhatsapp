import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import TaskCard from '../components/TaskCard';
import { getTasks, getStaff } from '../services/api';
import { connectSocket } from '../services/socket';

const DepartmentDashboard = () => {
  const role = localStorage.getItem('role');
  const [tasks, setTasks] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const audioCtxRef = useRef(null);
  const audioBufferRef = useRef(null);
  const interactedRef = useRef(false);

  // Pre-decode notification.mp3 into AudioBuffer for instant zero-latency playback
  useEffect(() => {
    fetch('/notification.mp3')
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = ctx;
        return ctx.decodeAudioData(buf);
      })
      .then((decoded) => { audioBufferRef.current = decoded; })
      .catch(() => {});
  }, []);

  // Mark user interaction so autoplay works
  useEffect(() => {
    const mark = () => {
      interactedRef.current = true;
      // Resume AudioContext if suspended (browser policy)
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    };
    document.addEventListener('click', mark, { once: true });
    document.addEventListener('keydown', mark, { once: true });
    return () => {
      document.removeEventListener('click', mark);
      document.removeEventListener('keydown', mark);
    };
  }, []);

  const playSound = useCallback(() => {
    if (!interactedRef.current) return;
    try {
      if (audioBufferRef.current && audioCtxRef.current) {
        // Instant playback from pre-decoded buffer
        const source = audioCtxRef.current.createBufferSource();
        source.buffer = audioBufferRef.current;
        source.connect(audioCtxRef.current.destination);
        source.start(0);
      }
    } catch {}
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const { data } = await getTasks();
      const all = data.tasks || data || [];
      setTasks(all.filter((t) => t.department === role));
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [role]);

  const fetchStaff = useCallback(async () => {
    try {
      const { data } = await getStaff(role);
      setStaffList(data.staff || []);
    } catch {
      // keep empty — fallback prompt will handle it
    }
  }, [role]);

  useEffect(() => {
    fetchTasks();
    fetchStaff();
    const socket = connectSocket(role);
    socket.on('newTask', (task) => {
      if (task.department === role) {
        setTasks((prev) => [task, ...prev]);
        playSound();
        toast.info(`🔔 New task for Room ${task.roomNumber}!`, { autoClose: 5000 });
      }
    });
    socket.on('taskUpdated', ({ id, status, doneBy, doneAt }) => {
      setTasks((prev) => prev.map((t) => (t._id === id || t.id === id) ? { ...t, status, doneBy, doneAt } : t));
    });
    socket.on('taskDeleted', ({ id }) => {
      setTasks((prev) => prev.filter((t) => (t._id || t.id) !== id));
      toast.info('A task was removed by reception');
    });
    return () => { socket.off('newTask'); socket.off('taskUpdated'); socket.off('taskDeleted'); };
  }, [fetchTasks, fetchStaff, role, playSound]);

  const handleUpdate = (id, status, doneBy) => {
    setTasks((prev) => prev.map((t) => (t._id === id || t.id === id) ? { ...t, status, doneBy } : t));
  };

  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  const DEPT_ICONS = { housekeeping: '🧹', kitchen: '🍽️', maintenance: '🔧' };
  const icon = DEPT_ICONS[role] || '📋';

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Navbar title={`${icon} ${role?.charAt(0).toUpperCase() + role?.slice(1)} Tasks`} onMenuClick={() => setSidebarOpen(true)}>
          <span className="badge">{tasks.filter((t) => t.status === 'pending').length}</span>
        </Navbar>
        <div className="page-content">
          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card"><span className="stat-value">{tasks.length}</span><span className="stat-label">Assigned</span></div>
            <div className="stat-card pending"><span className="stat-value">{tasks.filter((t) => t.status === 'pending').length}</span><span className="stat-label">Pending</span></div>
            <div className="stat-card inprogress"><span className="stat-value">{tasks.filter((t) => t.status === 'in-progress').length}</span><span className="stat-label">In Progress</span></div>
            <div className="stat-card done"><span className="stat-value">{tasks.filter((t) => t.status === 'done').length}</span><span className="stat-label">Done</span></div>
          </div>

          {/* Filter */}
          <div className="filters-bar">
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)' }}>Filter:</span>
            {['all', 'pending', 'in-progress', 'done'].map((s) => (
              <button
                key={s}
                className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setFilter(s)}
              >
                {s === 'all' ? 'All' : s === 'in-progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">{filter === 'done' ? '✅' : '📭'}</div>
              <p>{filter === 'all' ? 'No tasks assigned yet.' : `No ${filter} tasks.`}</p>
            </div>
          ) : (
            <div className="tasks-grid">
              {filtered.map((task) => (
                <TaskCard key={task._id || task.id} task={task} onUpdate={handleUpdate} showActions staffList={staffList} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DepartmentDashboard;
