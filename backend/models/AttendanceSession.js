const mongoose = require('mongoose');
const attendanceSessionSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true, index: true },
  sessionName: { type: String, required: true, trim: true, maxlength: 500 },
  purpose: { type: String, required: true, trim: true, maxlength: 500 },
  takenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  confirmedAt: { type: Date, default: null },
  records: [{ student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, present: { type: Boolean, default: false } }]
}, { timestamps: true });
module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
