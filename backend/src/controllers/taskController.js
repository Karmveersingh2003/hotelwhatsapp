const Task = require('../models/Task');

// GET /tasks?department=&status=&search=&from=&to=
const getTasks = async (req, res) => {
  try {
    const filter = { isDeleted: false }; // never show deleted tasks to reception/dept

    // Dept users see only their tasks
    if (['housekeeping', 'kitchen', 'maintenance'].includes(req.user.role)) {
      filter.department = req.user.role;
    }
    if (req.query.department) filter.department = req.query.department;
    if (req.query.status) filter.status = req.query.status;

    // Search by room number (partial match)
    if (req.query.search) {
      filter.roomNumber = { $regex: req.query.search, $options: 'i' };
    }

    // Date range filter
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) {
        const to = new Date(req.query.to);
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }

    const tasks = await Task.find(filter).sort({ createdAt: -1 });
    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST /create-task
const createTask = async (req, res) => {
  const { roomNumber, description, department, priority } = req.body;
  if (!roomNumber || !description || !department)
    return res.status(400).json({ message: 'roomNumber, description and department are required' });

  try {
    const task = await Task.create({
      roomNumber,
      description,
      department,
      priority: priority || 'medium',
      status: 'pending',
      createdBy: req.user._id,
      history: [{ status: 'pending', changedBy: req.user.username || 'reception', changedAt: new Date() }],
    });

    const io = req.app.get('io');
    if (io) {
      io.to(department).emit('newTask', task);
      io.to('reception').emit('newTask', task);
      io.to('admin').emit('newTask', task);
    }

    res.status(201).json({ task });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PUT /update-task/:id  — status update + audit log
const updateTask = async (req, res) => {
  const { status, doneBy } = req.body;
  if (!status) return res.status(400).json({ message: 'status is required' });
  if (status === 'done' && !doneBy)
    return res.status(400).json({ message: 'doneBy is required when marking done' });

  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Build audit entry
    const historyEntry = {
      status,
      changedBy: doneBy || req.user.username || req.user.role,
      changedAt: new Date(),
    };

    const updateFields = {
      status,
      updatedBy: req.user._id,
      $push: { history: historyEntry },
    };

    if (status === 'done') {
      updateFields.doneBy = doneBy;
      updateFields.doneAt = new Date();
    } else {
      updateFields.doneBy = null;
      updateFields.doneAt = null;
    }

    const updated = await Task.findByIdAndUpdate(req.params.id, updateFields, { new: true });

    const io = req.app.get('io');
    if (io) {
      const payload = { id: updated._id, status: updated.status, doneBy: updated.doneBy, doneAt: updated.doneAt, history: updated.history };
      io.to(updated.department).emit('taskUpdated', payload);
      io.to('reception').emit('taskUpdated', payload);
      io.to('admin').emit('taskUpdated', payload);
    }

    res.json({ task: updated });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PUT /reassign-task/:id  — admin only
const reassignTask = async (req, res) => {
  const { department } = req.body;
  if (!department) return res.status(400).json({ message: 'department is required' });

  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const oldDept = task.department;
    const historyEntry = {
      status: task.status,
      changedBy: req.user.username || 'admin',
      changedAt: new Date(),
      note: `Reassigned from ${oldDept} to ${department}`,
    };

    const updated = await Task.findByIdAndUpdate(
      req.params.id,
      { department, status: 'pending', doneBy: null, doneAt: null, $push: { history: historyEntry } },
      { new: true }
    );

    const io = req.app.get('io');
    if (io) {
      // Notify old dept to remove, new dept to add
      io.to(oldDept).emit('taskReassigned', { id: updated._id, newDepartment: department });
      io.to(department).emit('newTask', updated);
      io.to('reception').emit('taskUpdated', { id: updated._id, status: 'pending', department });
      io.to('admin').emit('taskUpdated', { id: updated._id, status: 'pending', department });
    }

    res.json({ task: updated });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /tasks/export  — CSV export (admin only)
const exportCSV = async (req, res) => {
  try {
    const tasks = await Task.find({}).sort({ createdAt: -1 });
    const header = 'Room,Description,Department,Priority,Status,Done By,Created At,Done At\n';
    const rows = tasks.map((t) => [
      t.roomNumber,
      `"${t.description.replace(/"/g, '""')}"`,
      t.department,
      t.priority,
      t.status,
      t.doneBy || '',
      t.createdAt ? new Date(t.createdAt).toLocaleString('en-IN') : '',
      t.doneAt ? new Date(t.doneAt).toLocaleString('en-IN') : '',
    ].join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tasks-${Date.now()}.csv"`);
    res.send(header + rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /tasks/analytics  — chart data (admin only)
const getAnalytics = async (req, res) => {
  try {
    // Tasks per department per day (last 7 days)
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);

    const tasks = await Task.find({ createdAt: { $gte: since } });

    // Build last 7 days labels
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }));
    }

    const chartData = days.map((day) => {
      const dayTasks = tasks.filter((t) =>
        new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) === day
      );
      return {
        day,
        housekeeping: dayTasks.filter((t) => t.department === 'housekeeping').length,
        kitchen: dayTasks.filter((t) => t.department === 'kitchen').length,
        maintenance: dayTasks.filter((t) => t.department === 'maintenance').length,
      };
    });

    // Staff performance: tasks completed this week per staff member
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    const doneTasks = await Task.find({ status: 'done', doneAt: { $gte: weekStart }, doneBy: { $ne: null } });
    const staffPerf = {};
    doneTasks.forEach((t) => {
      if (!staffPerf[t.doneBy]) staffPerf[t.doneBy] = { name: t.doneBy, completed: 0, department: t.department };
      staffPerf[t.doneBy].completed++;
    });

    res.json({ chartData, staffPerformance: Object.values(staffPerf).sort((a, b) => b.completed - a.completed) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// DELETE /delete-task/:id  — reception & admin soft-delete
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, isDeleted: false });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const deletedBy = req.user.username || req.user.role;
    const historyEntry = {
      status: task.status,
      changedBy: deletedBy,
      changedAt: new Date(),
      note: 'Task deleted by reception',
    };

    await Task.findByIdAndUpdate(req.params.id, {
      isDeleted: true,
      deletedBy,
      deletedAt: new Date(),
      $push: { history: historyEntry },
    });

    // Emit to all — departments remove it from their list
    const io = req.app.get('io');
    if (io) {
      const payload = { id: task._id };
      io.to(task.department).emit('taskDeleted', payload);
      io.to('reception').emit('taskDeleted', payload);
      io.to('admin').emit('taskDeleted', payload);
    }

    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /tasks/deleted  — admin only
const getDeletedTasks = async (req, res) => {
  try {
    const filter = { isDeleted: true };
    if (req.query.search) filter.roomNumber = { $regex: req.query.search, $options: 'i' };
    if (req.query.from || req.query.to) {
      filter.deletedAt = {};
      if (req.query.from) filter.deletedAt.$gte = new Date(req.query.from);
      if (req.query.to) {
        const to = new Date(req.query.to);
        to.setHours(23, 59, 59, 999);
        filter.deletedAt.$lte = to;
      }
    }
    const tasks = await Task.find(filter).sort({ deletedAt: -1 });
    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { getTasks, createTask, updateTask, reassignTask, exportCSV, getAnalytics, deleteTask, getDeletedTasks };
