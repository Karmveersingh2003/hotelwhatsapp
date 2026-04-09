const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  roomNumber: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  department: {
    type: String,
    enum: ['housekeeping', 'kitchen', 'maintenance'],
    required: true,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'done'],
    default: 'pending',
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  doneBy: { type: String, default: null },
  doneAt: { type: Date, default: null },
  // Soft delete — reception deletes, admin can still see
  isDeleted: { type: Boolean, default: false },
  deletedBy: { type: String, default: null },   // username who deleted
  deletedAt: { type: Date, default: null },
  // Audit log: every status change recorded
  history: [{
    status: String,
    changedBy: String,   // staff name or username
    changedAt: { type: Date, default: Date.now },
    note: String,
  }],
}, { timestamps: true });

// Indexes for fast search/filter
taskSchema.index({ department: 1, status: 1 });
taskSchema.index({ createdAt: -1 });
taskSchema.index({ roomNumber: 1 });

module.exports = mongoose.model('Task', taskSchema);
