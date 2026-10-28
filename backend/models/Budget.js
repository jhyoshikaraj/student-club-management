const mongoose = require('mongoose');

const billSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    receiptUrl: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    decisionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    overriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    releasedToAccount: { type: Boolean, default: false }
  },
  { timestamps: true }
);

const budgetSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    club: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
    proposedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // president/VP
    proposedAmount: { type: Number, required: true },
    justification: { type: String, default: '' },

    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    decisionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // director
    decisionNote: { type: String, default: '' },
    overriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // faculty coordinator

    bills: [billSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Budget', budgetSchema);
