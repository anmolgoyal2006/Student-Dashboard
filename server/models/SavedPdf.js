const mongoose = require('mongoose');

const savedPdfSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:        { type: String, required: true, trim: true },
  fileName:    { type: String, required: true },
  fileData:    { type: Buffer, required: true },
  contentType: { type: String, default: 'application/pdf' },
}, { timestamps: true });

module.exports = mongoose.model('SavedPdf', savedPdfSchema);
