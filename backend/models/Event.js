const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    requirements: { type: String, default: '' },
    proposedBudget: { type: Number, default: 0, min: 0 },
    club: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
    eventType: { type: String, enum: ['solo', 'collaborative'], default: 'solo' },
    collaboratingClubs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Club' }],
    collaborationApprovals: [{ club: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true }, president: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }, note: { type: String, default: '' }, decidedAt: { type: Date, default: null } }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // president/VP
    date: { type: Date, required: true },
    expectedStartTime: { type: String, default: '', match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    expectedEndTime: { type: String, default: '', match: /^([01]\d|2[0-3]):[0-5]\d$/ },

    venue: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
    alternativeVenues: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Venue' }],
    requestedVenues: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Venue' }],
    participantLimit: { type: Number, min: 1, default: 100 },
    published: { type: Boolean, default: false },
    registrationOpen: { type: Boolean, default: false },
    registrationDescription: { type: String, default: '', maxlength: 2000 },
    hasOD: { type: Boolean, default: false },
    facultyStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: undefined },
    facultyDecisionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    facultyDecisionNote: { type: String, default: '' },
    coordinatorStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    coordinatorDecisionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    coordinatorDecisionNote: { type: String, default: '' },
    venueStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    venueDecisionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    venueDecisionNote: { type: String, default: '' },
    venueOverriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    roleAssignments: [{
      student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      role: { type: String, default: 'Member', trim: true, maxlength: 100 }
    }],
    roleAllocationConfirmed: { type: Boolean, default: false },
    roleAllocationConfirmedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['planned', 'ongoing', 'completed', 'cancelled'],
      default: 'planned'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Event', eventSchema);
