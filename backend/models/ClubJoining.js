const mongoose = require('mongoose');

const clubJoiningSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    club: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
    joinedAt: { type: Date, default: Date.now },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

clubJoiningSchema.index({ student: 1, club: 1 }, { unique: true });

module.exports = mongoose.model('ClubJoining', clubJoiningSchema);
