const mongoose = require('mongoose');
const odListSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true, index: true },
  description: { type: String, required: true, trim: true, maxlength: 500 },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rows: [{ name: { type: String, required: true, trim: true, maxlength: 120 }, email: { type: String, required: true, lowercase: true, trim: true }, details: { type: String, required: true, trim: true, maxlength: 1000 }, student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null } }],
  status: { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  decisionNote: { type: String, default: '' },
  decidedAt: { type: Date, default: null }
}, { timestamps: true });
module.exports = mongoose.model('ODList', odListSchema);
