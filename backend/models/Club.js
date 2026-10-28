const mongoose = require('mongoose');

const clubSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '' },
    president: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    vicePresident: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    facultyCoordinator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    memberRoles: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, position: { type: String, default: 'Member' } }],
    // Existing student accounts allowed to access/manage this club workspace (e.g. vice president).
    accessEmails: [{ type: String, lowercase: true, trim: true }],
    approvalsOpen: { type: Boolean, default: false },
    openRoles: [{ type: String, trim: true, maxlength: 80 }],
    announcements: [{ author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, text: { type: String, required: true, maxlength: 2000 }, createdAt: { type: Date, default: Date.now } }],
    accountBalance: { type: Number, default: 0 } // money released after approved bills lands here
  },
  { timestamps: true }
);

module.exports = mongoose.model('Club', clubSchema);
