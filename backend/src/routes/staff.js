const router = require('express').Router();
const { getStaff, addStaff, deleteStaff } = require('../controllers/staffController');
const { protect, allow } = require('../middleware/auth');

router.get('/staff', protect, getStaff);
router.post('/staff', protect, allow('admin'), addStaff);
router.delete('/staff/:id', protect, allow('admin'), deleteStaff);

module.exports = router;
