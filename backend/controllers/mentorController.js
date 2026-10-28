const User = require('../models/User');
const Attendance = require('../models/Attendance');
const AttendanceSession = require('../models/AttendanceSession');
const ODList = require('../models/ODList');
const ClubJoining = require('../models/ClubJoining');
const Club = require('../models/Club');
const Event = require('../models/Event');
const EventRegistration = require('../models/EventRegistration');

// @route GET /api/mentors/mentees
// Faculty mentor sees each mentee's club, position, and participation (events attended / OD count)
exports.getMentees = async (req, res) => {
  try {
    const mentor = await User.findById(req.user._id).populate({
      path: 'mentees',
      select: 'name email club position',
      populate: { path: 'club', select: 'name' }
    });

    if (!mentor || mentor.role !== 'faculty_mentor') {
      return res.status(403).json({ message: 'Only faculty mentors can view mentees' });
    }

    // Support both sides of the mentor assignment relationship. Older records may
    // have assignedMentor set on the student without the mentor.mentees array updated.
    const assignedStudents = await User.find({ assignedMentor: mentor._id, role: { $in: ['student','president','vice_president'] }, isActive: { $ne: false } })
      .select('name email club position assignedMentor')
      .populate('club', 'name');
    const menteeMap = new Map();
    for (const student of (mentor.mentees || [])) if (student?._id) menteeMap.set(String(student._id), student);
    for (const student of assignedStudents) menteeMap.set(String(student._id), student);
    const allMentees = Array.from(menteeMap.values());

    const menteeDetails = await Promise.all(
      allMentees.map(async (student) => {
        // Event-linked attendance records.
        const attendanceDocs = await Attendance.find({ 'records.student': student._id })
          .populate('event', 'title date hasOD club')
          .populate('event.club', 'name');
        const participation = attendanceDocs.filter(doc => doc.event).map((doc) => {
          const record = doc.records.find((r) => String(r.student?._id || r.student) === String(student._id));
          return {
            type: 'Event attendance',
            event: doc.event.title,
            date: doc.event.date,
            club: doc.event.club?.name || '—',
            purpose: doc.sessionName || 'Event attendance',
            present: !!record?.present,
            odEligible: !!(record?.present && doc.event?.hasOD && record?.odEligible),
            odStatus: record?.odEligible ? 'Eligible' : 'Not eligible'
          };
        });

        // Standalone attendance lists created by the President (not tied to Event).
        const attendanceSessions = await AttendanceSession.find({ 'records.student': student._id })
          .populate('club', 'name');
        for (const session of attendanceSessions) {
          const record = session.records.find(r => String(r.student?._id || r.student) === String(student._id));
          participation.push({
            type: 'Attendance list',
            event: session.purpose || session.sessionName || 'Attendance',
            date: session.confirmedAt || session.createdAt,
            club: session.club?.name || '—',
            purpose: session.purpose || session.sessionName || '',
            present: !!record?.present,
            odEligible: false,
            odStatus: '—'
          });
        }

        // OD list entries are stored separately from event-attendance records.
        // Only include rows explicitly linked to this mentee's account.
        const odLists = await ODList.find({ 'rows.student': student._id })
          .populate('club', 'name')
          .populate('decidedBy', 'name email')
          .sort('-createdAt');
        for (const odList of odLists) {
          const row = odList.rows.find(r => String(r.student?._id || r.student) === String(student._id));
          if (!row) continue;
          participation.push({
            type: 'OD list',
            event: odList.description || 'OD request',
            date: odList.decidedAt || odList.createdAt,
            club: odList.club?.name || '—',
            purpose: row.details || odList.description || '',
            present: null,
            odEligible: odList.status === 'approved',
            odStatus: odList.status === 'approved' ? 'Approved' : odList.status === 'rejected' ? 'Rejected' : 'Pending',
            decisionNote: odList.decisionNote || ''
          });
        }
        participation.sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));

        const memberships = await ClubJoining.find({ student: student._id, active: true }).populate('club', 'name memberRoles members president vicePresident');
        const legacyClubs = await Club.find({ members: student._id }).select('name memberRoles members president vicePresident');
        const clubMap = new Map();
        const roleFor = c => {
          const record = (c.memberRoles || []).find(r => String(r.user?._id || r.user) === String(student._id));
          if (record?.position) return record.position;
          if (String(c.president?._id || c.president || '') === String(student._id)) return 'President';
          if (String(c.vicePresident?._id || c.vicePresident || '') === String(student._id)) return 'Vice President';
          return 'Member';
        };
        memberships.forEach(m => { if (m.club) clubMap.set(String(m.club._id), { name: m.club.name, position: roleFor(m.club) }); });
        legacyClubs.forEach(c => { clubMap.set(String(c._id), { name: c.name, position: roleFor(c) }); });
        const registrations = await EventRegistration.find({ student: student._id })
          .populate({ path: 'event', select: 'title date venue club collaboratingClubs status published facultyStatus coordinatorStatus venueStatus roleAssignments roleAllocationConfirmed', populate: [{ path: 'venue', select: 'name location' }, { path: 'club', select: 'name' }, { path: 'collaboratingClubs', select: 'name' }, { path: 'roleAssignments.student', select: 'name email' }] })
          .sort('-registeredAt');
        const registeredEventIds = new Set(registrations.filter(r => r.event).map(r => String(r.event._id)));
        const assignedEvents = await Event.find({ roleAllocationConfirmed: true, 'roleAssignments.student': student._id })
          .select('title date venue club collaboratingClubs status published facultyStatus coordinatorStatus venueStatus roleAssignments roleAllocationConfirmed')
          .populate('venue', 'name location').populate('club', 'name').populate('collaboratingClubs', 'name')
          .populate('roleAssignments.student', 'name email').sort('-date');
        const eventParticipation = new Map();
        for (const r of registrations) {
          if (!r.event) continue;
          const e = r.event;
          const assigned = (e.roleAssignments || []).find(a => String(a.student?._id || a.student) === String(student._id));
          eventParticipation.set(String(e._id), {
            eventId: String(e._id), event: e.title, date: e.date, venue: e.venue?.name || '—',
            club: e.club?.name || '—', collaboratingClubs: (e.collaboratingClubs || []).map(c => c.name),
            participationType: assigned ? 'Event team' : 'Registered participant',
            eventRole: assigned?.role || 'Participant', registrationStatus: 'Registered', eventStatus: e.status || 'planned'
          });
        }
        for (const e of assignedEvents) {
          const assigned = (e.roleAssignments || []).find(a => String(a.student?._id || a.student) === String(student._id));
          const current = eventParticipation.get(String(e._id));
          eventParticipation.set(String(e._id), {
            eventId: String(e._id), event: e.title, date: e.date, venue: e.venue?.name || '—',
            club: e.club?.name || '—', collaboratingClubs: (e.collaboratingClubs || []).map(c => c.name),
            participationType: 'Event team', eventRole: assigned?.role || 'Member',
            registrationStatus: current?.registrationStatus || 'Not registered separately', eventStatus: e.status || 'planned'
          });
        }
        return {
          studentId: student._id,
          clubs: Array.from(clubMap.values()),
          name: student.name,
          email: student.email,
          club: student.club ? student.club.name : null,
          position: student.position,
          eventsAttended: participation.filter((p) => p.present).length,
          odEligibleEvents: participation.filter((p) => p.odEligible).length,
          participation,
          eventParticipation: Array.from(eventParticipation.values()).sort((a,b)=>new Date(b.date)-new Date(a.date))
        };
      })
    );

    return res.json(menteeDetails);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.getMyMentor = async (req, res) => {
 try {
  if (!['student','president','vice_president'].includes(req.user.role)) return res.status(403).json({ message: 'Mentor details are available only to student accounts.' });
  const user = await User.findById(req.user._id).populate('assignedMentor', 'name email role');
  return res.json({ mentor: user?.assignedMentor || null });
 } catch (err) { return res.status(500).json({ message: err.message }); }
};
