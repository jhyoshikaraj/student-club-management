const mongoose = require('mongoose');
const attendanceSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, unique: true },
  sessionName: { type: String, default: 'Event attendance', trim: true, maxlength: 160 },
  takenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  records: [{ student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, present: { type: Boolean, default: false }, odEligible: { type: Boolean, default: false } }]
}, { timestamps: true });
module.exports = mongoose.model('Attendance', attendanceSchema);
