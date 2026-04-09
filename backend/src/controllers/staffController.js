const Staff = require('../models/Staff');

// GET /staff?department=housekeeping
const getStaff = async (req, res) => {
  try {
    const filter = {};
    if (req.query.department) filter.department = req.query.department;
    // Dept users only see their own dept staff
    if (['housekeeping', 'kitchen', 'maintenance'].includes(req.user.role)) {
      filter.department = req.user.role;
    }
    const staff = await Staff.find(filter).sort({ name: 1 });
    res.json({ staff });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /staff  (admin only)
const addStaff = async (req, res) => {
  const { name, department } = req.body;
  if (!name || !department)
    return res.status(400).json({ message: 'name and department are required' });
  try {
    const member = await Staff.create({ name, department });
    res.status(201).json({ staff: member });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /staff/:id  (admin only)
const deleteStaff = async (req, res) => {
  try {
    await Staff.findByIdAndDelete(req.params.id);
    res.json({ message: 'Staff member removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getStaff, addStaff, deleteStaff };
