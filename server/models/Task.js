const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
  },
  subject: {
    type: String,
    trim: true,
    default: 'General',
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required'],
  },
  dueTime: {
    type: String,
    default: '23:59',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed'],
    default: 'pending',
  },
  type: {
    type: String,
    enum: ['assignment', 'exam', 'project', 'revision', 'other'],
    default: 'other',
  },
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);