require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./db');

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const staffRoutes = require('./routes/staff');

const app = express();
const server = http.createServer(app);

// ── Socket.io setup ──────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Make io accessible in controllers via req.app.get('io')
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Client joins a department room (e.g. "reception", "housekeeping", "admin")
  socket.on('joinDepartment', (department) => {
    socket.join(department);
    console.log(`   ↳ ${socket.id} joined room: ${department}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// ── Express middleware ────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/', authRoutes);
app.use('/', taskRoutes);
app.use('/', staffRoutes);

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date() }));

// 404 handler
app.use((_, res) => res.status(404).json({ message: 'Route not found' }));

// Global error handler
app.use((err, _, res, __) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
});
