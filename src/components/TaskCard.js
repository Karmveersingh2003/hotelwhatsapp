import React, { useState, useEffect } from 'react';
import { updateTask, reassignTask, deleteTask } from '../services/api';
import { toast } from 'react-toastify';

const STATUS_LABELS = { pending: 'Pending', 'in-progress': 'In Progress', done: 'Done' };
const DEPTS = ['housekeeping', 'kitchen', 'maintenance'];

const formatTime = (ts) => {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

// ── Task Age Indicator ────────────────────────────────────────────────────────
const TaskAge = ({ createdAt, status }) => {
  const [label, setLabel] = useState('');
  const [isOld, setIsOld] = useState(false);

  useEffect(() => {
    const calc = () => {
      const mins = Math.floor((Date.now() - new Date(createdAt)) / 60000);
      setIsOld(mins >= 30 && status !== 'done');
      if (mins < 1) setLabel('just now');
      else if (mins < 60) setLabel(`${mins}m ago`);
      else setLabel(`${Math.floor(mins / 60)}h ${mins % 60}m ago`);
    };
    calc();
    const t = setInterval(calc, 60000);
    return () => clearInterval(t);
  }, [createdAt, status]);

  return (
    <span className={`task-age ${isOld ? 'task-age-old' : ''}`}>
      {isOld ? '⚠️' : '🕐'} {label}
    </span>
  );
};

// ── Done-by Modal ─────────────────────────────────────────────────────────────
const DoneByModal = ({ staffList, onConfirm, onCancel }) => {
  const [selected, setSelected] = useState('');
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3 className="modal-title">✅ Who completed this task?</h3>
        <p className="modal-subtitle">Select the staff member who finished this task</p>
        <select className="modal-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">-- Select name --</option>
          {staffList.map((s) => <option key={s._id || s.id} value={s.name}>{s.name}</option>)}
        </select>
        <div className="modal-actions">
          <button className="btn btn-outline btn-sm" onClick={onCancel}>Cancel</button>
          <button className="btn btn-done btn-sm" disabled={!selected} onClick={() => onConfirm(selected)}>✓ Confirm</button>
        </div>
      </div>
    </div>
  );
};

// ── History Modal ─────────────────────────────────────────────────────────────
const HistoryModal = ({ task, onClose }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-card modal-wide" onClick={(e) => e.stopPropagation()}>
      <h3 className="modal-title">📋 Task History — Room {task.roomNumber}</h3>
      <p className="modal-subtitle">{task.description}</p>
      <div className="history-list">
        {(!task.history || task.history.length === 0) ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No history available.</p>
        ) : (
          task.history.map((h, i) => (
            <div key={i} className="history-item">
              <div className={`history-dot status-dot-${h.status}`} />
              <div className="history-content">
                <span className="history-status">{STATUS_LABELS[h.status] || h.status}</span>
                <span className="history-by">by {h.changedBy}</span>
                {h.note && <span className="history-note">{h.note}</span>}
                <span className="history-time">{formatTime(h.changedAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="modal-actions">
        <button className="btn btn-primary btn-sm" onClick={onClose}>Close</button>
      </div>
    </div>
  </div>
);

// ── Reassign Modal ────────────────────────────────────────────────────────────
const ReassignModal = ({ task, onConfirm, onCancel }) => {
  const [dept, setDept] = useState(DEPTS.find((d) => d !== task.department) || DEPTS[0]);
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3 className="modal-title">🔀 Reassign Task</h3>
        <p className="modal-subtitle">Move Room {task.roomNumber} task to another department</p>
        <select className="modal-select" value={dept} onChange={(e) => setDept(e.target.value)}>
          {DEPTS.filter((d) => d !== task.department).map((d) => (
            <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
          ))}
        </select>
        <div className="modal-actions">
          <button className="btn btn-outline btn-sm" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={() => onConfirm(dept)}>🔀 Reassign</button>
        </div>
      </div>
    </div>
  );
};

// ── TaskCard ──────────────────────────────────────────────────────────────────
const TaskCard = ({ task: initialTask, onUpdate, onDelete, showActions = false, staffList = [], showReassign = false, showDelete = false }) => {
  const [task, setTask] = useState(initialTask);
  const [modal, setModal] = useState(null); // 'done' | 'history' | 'reassign' | 'confirmDelete'

  // Sync when parent updates task
  useEffect(() => { setTask(initialTask); }, [initialTask]);

  const handleStatus = async (status, doneBy = null) => {
    const prev = { ...task };
    // Optimistic update
    setTask((t) => ({ ...t, status, doneBy: doneBy || t.doneBy }));
    try {
      const payload = { status };
      if (doneBy) payload.doneBy = doneBy;
      const { data } = await updateTask(task._id || task.id, payload);
      setTask(data.task);
      onUpdate && onUpdate(task._id || task.id, status, doneBy, data.task);
      toast.success(`Marked as ${STATUS_LABELS[status]}`);
    } catch (err) {
      setTask(prev); // revert on failure
      toast.error(err.response?.data?.message || 'Failed to update task');
    }
  };

  const handleReassign = async (dept) => {
    setModal(null);
    try {
      const { data } = await reassignTask(task._id || task.id, { department: dept });
      setTask(data.task);
      onUpdate && onUpdate(task._id || task.id, 'pending', null, data.task);
      toast.success(`Task reassigned to ${dept}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reassign');
    }
  };

  const handleDelete = async () => {
    setModal(null);
    try {
      await deleteTask(task._id || task.id);
      onDelete && onDelete(task._id || task.id);
      toast.success('Task deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete task');
    }
  };

  return (
    <>
      {modal === 'done' && (
        <DoneByModal
          staffList={staffList}
          onConfirm={(name) => { setModal(null); handleStatus('done', name); }}
          onCancel={() => setModal(null)}
        />
      )}
      {modal === 'history' && <HistoryModal task={task} onClose={() => setModal(null)} />}
      {modal === 'reassign' && (
        <ReassignModal task={task} onConfirm={handleReassign} onCancel={() => setModal(null)} />
      )}
      {modal === 'confirmDelete' && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 className="modal-title">🗑️ Delete Task?</h3>
            <p className="modal-subtitle">Room {task.roomNumber} — {task.description}</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.5rem 0 1.25rem' }}>
              This task will be removed from the department view. Admin will still have a record of it.
            </p>
            <div className="modal-actions">
              <button className="btn btn-outline btn-sm" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={handleDelete}>🗑️ Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className={`task-card ${task.status}`}>
        <div className="task-card-header">
          <span className="room-badge">🏨 Room {task.roomNumber}</span>
          <span className={`status-badge ${task.status}`}>{STATUS_LABELS[task.status] || task.status}</span>
        </div>
        <p className="task-description">{task.description}</p>
        <div className="task-meta">
          <div className="task-meta-info">
            <span className="dept-tag">📂 {task.department}</span>
            <TaskAge createdAt={task.createdAt} status={task.status} />
          </div>
          {task.priority && <span className={`priority-tag ${task.priority}`}>{task.priority.toUpperCase()}</span>}
        </div>

        {task.status === 'done' && task.doneBy && (
          <div className="done-by-tag">
            <span>👤 Done by <strong>{task.doneBy}</strong></span>
            {task.doneAt && <span className="task-time"> · {formatTime(task.doneAt)}</span>}
          </div>
        )}

        <div className="task-footer">
          <button className="btn-ghost" onClick={() => setModal('history')}>📋 History</button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {showDelete && task.status !== 'done' && (
              <button className="btn btn-sm btn-danger" onClick={() => setModal('confirmDelete')}>🗑️</button>
            )}
            {showReassign && task.status !== 'done' && (
              <button className="btn btn-sm btn-outline" onClick={() => setModal('reassign')}>🔀 Reassign</button>
            )}
            {showActions && task.status === 'pending' && (
              <button className="btn btn-sm btn-start" onClick={() => handleStatus('in-progress')}>▶ Start</button>
            )}
            {showActions && task.status === 'in-progress' && (
              <button className="btn btn-sm btn-done" onClick={() => {
                if (staffList.length === 0) {
                  const name = window.prompt('Enter your name:');
                  if (name?.trim()) handleStatus('done', name.trim());
                } else {
                  setModal('done');
                }
              }}>✓ Done</button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default TaskCard;
