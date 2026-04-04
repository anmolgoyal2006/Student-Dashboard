const mongoose = require('mongoose');

const noteChunkSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  filename:  { type: String, required: true },
  chunkIndex:{ type: Number, required: true },
  text:      { type: String, required: true },
  embedding: { type: [Number], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('NoteChunk', noteChunkSchema);