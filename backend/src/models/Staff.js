const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  department: {
    type: String,
    enum: ['housekeeping', 'kitchen', 'maintenance'],
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('Staff', staffSchema);
