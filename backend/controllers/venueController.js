const Event = require('../models/Event');
const Venue = require('../models/Venue');
const { createNotification } = require('../utils/notify');

function timesOverlap(aStart, aEnd, bStart, bEnd) {
  // If either event lacks a complete time range, conservatively treat the venue as occupied all day.
  if (!aStart || !aEnd || !bStart || !bEnd) return true;
  return aStart < bEnd && bStart < aEnd;
}

// @route GET /api/venues
exports.listVenues = async (req, res) => {
  const venues = await Venue.find();
  return res.json(venues);
};

// @route POST /api/venues  (venue_admin/director sets up available venues)
exports.createVenue = async (req, res) => {
  const venue = await Venue.create(req.body);
  return res.status(201).json(venue);
};

// @route GET /api/venues/requests/pending
// Venue administrator's queue of pending booking requests
exports.pendingRequests = async (req, res) => {
  const events = await Event.find({ venueStatus: 'pending', coordinatorStatus: 'approved' })
    .populate('club', 'name facultyCoordinator president')
    .populate('venue', 'name location capacity').populate('requestedVenues', 'name location capacity')
    .populate('createdBy', 'name role email')
    .sort('date');
  const venues = await Venue.find().select('name location capacity');
  const enriched = await Promise.all(events.map(async (event) => {
    const dayStart = new Date(event.date); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(event.date); dayEnd.setHours(23, 59, 59, 999);
    const booked = await Event.find({ _id: { $ne: event._id }, venueStatus: 'approved', date: { $gte: dayStart, $lte: dayEnd } }).select('venue requestedVenues expectedStartTime expectedEndTime');
    const bookedIds = new Set(booked.filter(x => timesOverlap(event.expectedStartTime, event.expectedEndTime, x.expectedStartTime, x.expectedEndTime)).flatMap(x => [x.venue, ...(x.requestedVenues||[])]).map(String));
    return { ...event.toObject(), availableVenues: venues.filter(v => !bookedIds.has(String(v._id))) };
  }));
  return res.json(enriched);
};

// @route PATCH /api/venues/:eventId/decision
// body: { decision: 'approved' | 'rejected', note }
// Allowed for: venue_admin (the designated approver) OR the club's faculty_coordinator
// (override — coordinator sits above the president and can overturn any decision).
exports.decideVenueRequest = async (req, res) => {
  try {
    const { decision, note = '', alternativeVenueIds = [] } = req.body;
    if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ message: 'decision must be approved or rejected' });
    const event = await Event.findById(req.params.eventId).populate('club', 'name facultyCoordinator president').populate('createdBy', '_id name email');
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (req.user.role !== 'venue_admin') return res.status(403).json({ message: 'Only the Venue Administrator can decide on venue requests.' });
    if (event.coordinatorStatus !== 'approved' || event.venueStatus !== 'pending') return res.status(409).json({ message: 'This venue request is no longer pending.' });

    let alternatives = [];
    if (decision === 'approved') {
      const dayStart = new Date(event.date); dayStart.setHours(0,0,0,0);
      const dayEnd = new Date(event.date); dayEnd.setHours(23,59,59,999);
      const requestedIds = (event.requestedVenues?.length ? event.requestedVenues : [event.venue]).map(String);
      const sameDay = await Event.find({ _id: { $ne: event._id }, venueStatus: 'approved', date: { $gte: dayStart, $lte: dayEnd }, $or: [{ venue: { $in: requestedIds } }, { requestedVenues: { $in: requestedIds } }] }).select('_id title expectedStartTime expectedEndTime');
      const conflict = sameDay.find(x => timesOverlap(event.expectedStartTime, event.expectedEndTime, x.expectedStartTime, x.expectedEndTime));
      if (conflict) return res.status(409).json({ message: `Venue conflicts with approved event "${conflict.title}" at the requested time. Review available alternatives.` });
    } else {
      const ids = Array.isArray(alternativeVenueIds) ? [...new Set(alternativeVenueIds.map(String))] : [];
      const dayStart = new Date(event.date); dayStart.setHours(0,0,0,0);
      const dayEnd = new Date(event.date); dayEnd.setHours(23,59,59,999);
      const booked = await Event.find({ venueStatus: 'approved', date: { $gte: dayStart, $lte: dayEnd } }).select('venue expectedStartTime expectedEndTime');
      const bookedIds = new Set(booked.filter(x => timesOverlap(event.expectedStartTime, event.expectedEndTime, x.expectedStartTime, x.expectedEndTime)).map(x => String(x.venue)));
      alternatives = await Venue.find({ _id: { $in: ids } }).select('name location capacity');
      if (alternatives.length !== ids.length || ids.includes(String(event.venue)) || alternatives.some(v => bookedIds.has(String(v._id)))) {
        return res.status(400).json({ message: 'Select only venues that are available on the event date.' });
      }
    }

    event.venueStatus = decision;
    event.venueDecisionNote = String(note).trim().slice(0, 1500);
    event.venueDecisionBy = req.user._id;
    await event.save();

    const recipients = new Set();
    if (event.createdBy?._id) recipients.add(String(event.createdBy._id));
    if (event.club?.president) recipients.add(String(event.club.president));
    if (event.club?.facultyCoordinator) recipients.add(String(event.club.facultyCoordinator));
    const alternativesText = alternatives.length ? alternatives.map(v => `${v.name}${v.location ? ` (${v.location})` : ''}`).join(', ') : 'No alternative venues were selected.';
    const message = decision === 'approved'
      ? `The venue request for "${event.title}" was approved.${event.venueDecisionNote ? ` Note: ${event.venueDecisionNote}` : ''}`
      : `The venue request for "${event.title}" was rejected.${event.venueDecisionNote ? ` Reason: ${event.venueDecisionNote}` : ''} Available alternative venues selected by the Venue Administrator: ${alternativesText}`;
    for (const id of recipients) await createNotification(id, `Venue ${decision}: ${event.title}`, message, decision === 'approved' ? 'venue_decision' : 'venue_alternatives');
    if (decision === 'approved' && event.facultyStatus === 'approved' && event.coordinatorStatus === 'approved' && (event.collaborationApprovals || []).every(a => a.status === 'approved')) {
      const presidentIds = new Set([String(event.club?.president || ''), String(event.createdBy?._id || '')].filter(Boolean));
      for (const id of presidentIds) await createNotification(id, `All approvals complete: ${event.title}`, `All required approvals for "${event.title}" are complete. Open Event Details to allocate member roles, confirm the allocation, then publish the event and open registrations when ready.`, 'event_fully_approved');
    }
    return res.json({ message: `Venue request ${decision}.`, event, alternatives });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
