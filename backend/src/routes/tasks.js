const router = require('express').Router();
const { getTasks, createTask, updateTask, reassignTask, exportCSV, getAnalytics, deleteTask, getDeletedTasks } = require('../controllers/taskController');
const { protect, allow } = require('../middleware/auth');

router.get('/tasks', protect, getTasks);
router.get('/tasks/deleted', protect, allow('admin'), getDeletedTasks);
router.get('/tasks/export', protect, allow('admin'), exportCSV);
router.get('/tasks/analytics', protect, allow('admin'), getAnalytics);
router.post('/create-task', protect, allow('reception', 'admin'), createTask);
router.put('/update-task/:id', protect, allow('housekeeping', 'kitchen', 'maintenance', 'admin'), updateTask);
router.put('/reassign-task/:id', protect, allow('admin'), reassignTask);
router.delete('/delete-task/:id', protect, allow('reception', 'admin'), deleteTask);

module.exports = router;
