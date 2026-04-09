const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (id, username) =>
  jwt.sign({ id, username }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

// POST /login
const login = async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role)
    return res.status(400).json({ message: 'Username, password and role are required' });

  try {
    const user = await User.findOne({ username, role });
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ message: 'Invalid credentials' });

    res.json({
      token: signToken(user._id, user.username),
      role: user.role,
      username: user.username,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST /register  (admin use or seeding)
const register = async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role)
    return res.status(400).json({ message: 'All fields required' });

  try {
    const exists = await User.findOne({ username });
    if (exists) return res.status(409).json({ message: 'Username already taken' });

    const user = await User.create({ username, password, role });
    res.status(201).json({
      token: signToken(user._id),
      role: user.role,
      username: user.username,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { login, register };
