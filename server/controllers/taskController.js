const Task = require('../models/Task');
const mongoose = require('mongoose');

// Helper to safely convert user id → ObjectId
const getUserId = (req) => new mongoose.Types.ObjectId(req.user._id);

// GET all tasks
const getTasks = async (req, res) => {
  try {
    const { status, priority, type, week } = req.query;

    const filter = { user: getUserId(req) };

    if (status)   filter.status   = status;
    if (priority) filter.priority = priority;
    if (type)     filter.type     = type;

    if (week === 'current') {
      const now   = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      filter.dueDate = { $gte: start, $lte: end };
    }

    const tasks = await Task.find(filter).sort({ dueDate: 1, priority: -1 });
    res.json({ tasks });
  } catch (err) {
    console.error("GET TASKS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

// GET single task
const getTask = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      user: getUserId(req),
    });

    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json({ task });
  } catch (err) {
    console.error("GET TASK ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

// POST create task
const createTask = async (req, res) => {
  try {
    const { title, subject, description, dueDate, dueTime, priority, status, type } = req.body;

    if (!title || !dueDate) {
      return res.status(400).json({ message: 'Title and due date are required' });
    }

    const task = await Task.create({
      user: getUserId(req), // ✅ FIXED
      title,
      subject,
      description,
      dueDate,
      dueTime,
      priority,
      status,
      type,
    });

    res.status(201).json({ task });
  } catch (err) {
    console.error("CREATE TASK ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

// PUT update task
const updateTask = async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      {
        _id: req.params.id,
        user: getUserId(req),
      },
      req.body,
      { new: true, runValidators: true }
    );

    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json({ task });
  } catch (err) {
    console.error("UPDATE TASK ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

// DELETE task
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      user: getUserId(req),
    });

    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error("DELETE TASK ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

// PATCH toggle status
const toggleStatus = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      user: getUserId(req),
    });

    if (!task) return res.status(404).json({ message: 'Task not found' });

    const cycle = {
      pending: 'in-progress',
      'in-progress': 'completed',
      completed: 'pending',
    };

    task.status = cycle[task.status];
    await task.save();

    res.json({ task });
  } catch (err) {
    console.error("TOGGLE STATUS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  toggleStatus,
};