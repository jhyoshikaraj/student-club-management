const mongoose = require('mongoose');

const clubJoiningRequestSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    club: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNote: { type: String, default: '' },
    motivation: { type: String, default: '', maxlength: 2000 },
    roleChoices: [{ type: String, maxlength: 80 }]
  },
  { timestamps: true }
);

clubJoiningRequestSchema.index({ student: 1, club: 1 }, { unique: true });

module.exports = mongoose.model('ClubJoiningRequest', clubJoiningRequestSchema);
