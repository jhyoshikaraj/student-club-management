const Attendance = require('../models/Attendance');
const Event = require('../models/Event');
const { isClubLeader } = require('../middleware/roles');
const Club = require('../models/Club');
const User = require('../models/User');
const ODList = require('../models/ODList');
const AttendanceSession = require('../models/AttendanceSession');
const { createNotification, createNotifications } = require('../utils/notify');

async function getManagedClub(user, clubId) {
  const club = await Club.findById(clubId);
  if (!club) return { error: 'Club not found', status: 404 };
  if (user.role === 'president' && (String(club.president) === String(user._id) || (club.accessEmails || []).includes(String(user.email).toLowerCase()))) return { club };
  if (user.role === 'faculty_coordinator' && String(club.facultyCoordinator) === String(user._id)) return { club };
  if (user.role === 'club_coordinator') return { club };
  return { error: 'You do not have access to this club record', status: 403 };
}


// @route POST /api/attendance/:eventId/mark
// body: { records: [{ student, present }] }
// Only President/VP of the event's club can take attendance, and only once the
// venue has been approved (event is actually happening).
exports.markAttendance = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (!isClubLeader(req.user, event.club)) {
      return res.status(403).json({ message: 'Only the President/VP can take attendance' });
    }
    if (event.venueStatus !== 'approved') {
      return res.status(400).json({ message: 'Venue not approved yet; cannot take attendance' });
    }

    const { records, sessionName } = req.body; // [{ student, present }]
    const formatted = records.map((r) => ({
      student: r.student,
      present: !!r.present,
      odEligible: !!r.present && !!event.hasOD // only events marked OD grant OD eligibility
    }));

    const attendance = await Attendance.findOneAndUpdate(
      { event: event._id },
      { event: event._id, takenBy: req.user._id, records: formatted, sessionName: String(sessionName || '').trim() || 'Event attendance' },
      { upsert: true, new: true }
    );

    return res.json(attendance);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route GET /api/attendance/:eventId
exports.getAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findOne({ event: req.params.eventId })
      .populate({ path: 'event', select: 'title date club', populate: { path: 'club', select: 'name president vicePresident facultyCoordinator' } })
      .populate('records.student', 'name email position')
      .populate('takenBy', 'name role');
    if (!attendance) return res.status(404).json({ message: 'No attendance recorded yet' });
    const club = attendance.event?.club;
    const isLeader = club && [club.president, club.vicePresident].some(id => String(id || '') === String(req.user._id));
    const isFaculty = req.user.role === 'faculty_coordinator' && String(club?.facultyCoordinator || '') === String(req.user._id);
    const isMember = attendance.records.some(r => String(r.student?._id || r.student) === String(req.user._id));
    if (!isLeader && !isFaculty && req.user.role !== 'club_coordinator' && !isMember) return res.status(403).json({ message: 'You cannot view this attendance record.' });
    return res.json(attendance);
  } catch (err) { return res.status(500).json({ message: err.message }); }
};

// @route GET /api/attendance/student/:studentId/od
// A student (or their mentor) can check accumulated OD-eligible events
exports.getStudentOD = async (req, res) => {
  const records = await Attendance.find({ 'records.student': req.params.studentId })
    .populate('event', 'title date')
    .select('event records.$');
  return res.json(records);
};


// Standalone club attendance sessions. The president creates and confirms; faculty coordinator has read-only access.
exports.listSessions = async (req, res) => {
  try {
    let clubIds = [];
    if (req.query.club) {
      const access = await getManagedClub(req.user, req.query.club);
      if (access.error) return res.status(access.status).json({ message: access.error });
      clubIds = [access.club._id];
    } else if (req.user.role === 'president') {
      clubIds = await Club.find({ president: req.user._id }).distinct('_id');
    } else if (req.user.role === 'faculty_coordinator') {
      clubIds = await Club.find({ facultyCoordinator: req.user._id }).distinct('_id');
    } else if (req.user.role === 'club_coordinator') {
      clubIds = await Club.find({}).distinct('_id');
    } else {
      return res.status(403).json({ message: 'Only club presidents, faculty coordinators and the Club Coordinator can view attendance records.' });
    }
    const sessions = await AttendanceSession.find({ club: { $in: clubIds } })
      .populate('club', 'name').populate('takenBy', 'name email').sort('-createdAt');
    return res.json(sessions);
  } catch (err) { return res.status(500).json({ message: err.message }); }
};

exports.getSession = async (req, res) => {
  try {
    const session = await AttendanceSession.findById(req.params.id).populate('club', 'name president facultyCoordinator members memberRoles')
      .populate('records.student', 'name email position').populate('takenBy', 'name email');
    if (!session) return res.status(404).json({ message: 'Attendance session not found.' });
    const access = await getManagedClub(req.user, session.club._id);
    if (access.error) return res.status(access.status).json({ message: access.error });
    return res.json(session);
  } catch (err) { return res.status(500).json({ message: err.message }); }
};

exports.confirmSession = async (req, res) => {
  try {
    const { clubId, purpose, records } = req.body;
    const access = await getManagedClub(req.user, clubId);
    if (access.error) return res.status(access.status).json({ message: access.error });
    if (req.user.role !== 'president' || (String(access.club.president) !== String(req.user._id) && !(access.club.accessEmails || []).includes(String(req.user.email).toLowerCase()))) return res.status(403).json({ message: 'Only this club president or an authorized club account can create or edit attendance.' });
    const cleanPurpose = String(purpose || '').trim();
    if (!cleanPurpose || cleanPurpose.length > 500) return res.status(400).json({ message: 'Enter the purpose of this attendance (1 to 500 characters).' });
    if (!Array.isArray(records) || !records.length) return res.status(400).json({ message: 'Attendance must include the club member list.' });
    const memberIds = new Set((access.club.members || []).map(id => String(id)));
    const cleanRecords = [];
    for (const r of records) {
      if (!memberIds.has(String(r.student))) return res.status(400).json({ message: 'Attendance can only be recorded for current members of this club.' });
      cleanRecords.push({ student: r.student, present: Boolean(r.present), odEligible: false });
    }
    let session;
    if (req.params.id) {
      session = await AttendanceSession.findOne({ _id: req.params.id, club: access.club._id });
      if (!session) return res.status(404).json({ message: 'Attendance session not found.' });
      session.purpose = cleanPurpose; session.sessionName = cleanPurpose; session.records = cleanRecords; session.takenBy = req.user._id; session.confirmedAt = new Date();
      await session.save();
    } else {
      session = await AttendanceSession.create({ club: access.club._id, purpose: cleanPurpose, sessionName: cleanPurpose, records: cleanRecords, takenBy: req.user._id, confirmedAt: new Date() });
    }
    const populated = await AttendanceSession.findById(session._id).populate('club', 'name').populate('records.student', 'name email').populate('takenBy', 'name');
    const viewOnlyList = populated.records.map(r => `${r.student.name} (${r.student.email}): ${r.present ? 'Present' : 'Absent'}`).join('\n');
    for (const r of populated.records) {
      const title = req.params.id ? `Attendance updated: ${cleanPurpose}` : `Attendance confirmed: ${cleanPurpose}`;
      const lead = req.params.id ? 'The attendance list has been updated. Please check the updated list below.' : `You are marked ${r.present ? 'present' : 'absent'} for ${cleanPurpose}.`;
      await createNotification(r.student._id, title, `${lead}\n\nView-only attendance list for ${populated.club.name}:\n${viewOnlyList}`, req.params.id ? 'attendance_updated' : 'attendance');
    }
    return res.status(200).json({ message: req.params.id ? 'Attendance updated and notifications sent.' : 'Attendance confirmed and notifications sent.', session: populated });
  } catch (err) { return res.status(500).json({ message: err.message }); }
};

exports.listODs = async (req, res) => {
  try {
    let clubIds = [];
    if (req.query.club) {
      const access = await getManagedClub(req.user, req.query.club);
      if (access.error) return res.status(access.status).json({ message: access.error });
      clubIds = [access.club._id];
    } else if (req.user.role === 'president') clubIds = await Club.find({ president: req.user._id }).distinct('_id');
    else if (req.user.role === 'club_coordinator') clubIds = await Club.find({}).distinct('_id');
    else return res.status(403).json({ message: 'Only club presidents and the Club Coordinator can view OD lists.' });
    const lists = await ODList.find({ club: { $in: clubIds } }).populate('club', 'name').populate('submittedBy', 'name email').populate('decidedBy', 'name email').sort('-createdAt');
    return res.json(lists);
  } catch (err) { return res.status(500).json({ message: err.message }); }
};

exports.getOD = async (req, res) => {
  try {
    const od = await ODList.findById(req.params.id).populate('club', 'name president facultyCoordinator').populate('submittedBy', 'name email').populate('decidedBy', 'name email');
    if (!od) return res.status(404).json({ message: 'OD list not found.' });
    const access = await getManagedClub(req.user, od.club._id);
    if (access.error) return res.status(access.status).json({ message: access.error });
    return res.json(od);
  } catch (err) { return res.status(500).json({ message: err.message }); }
};

exports.submitOD = async (req, res) => {
  try {
    const { clubId, description, rows } = req.body;
    const access = await getManagedClub(req.user, clubId);
    if (access.error) return res.status(access.status).json({ message: access.error });
    if (req.user.role !== 'president' || (String(access.club.president) !== String(req.user._id) && !(access.club.accessEmails || []).includes(String(req.user.email).toLowerCase()))) return res.status(403).json({ message: 'Only this club president or an authorized club account can submit or edit OD lists.' });
    const desc = String(description || '').trim();
    if (!desc || desc.length > 500) return res.status(400).json({ message: 'Enter the purpose of the OD list (1 to 500 characters).' });
    if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ message: 'Add at least one student to the OD list.' });
    const cleaned = [];
    for (const row of rows) {
      const email = String(row.email || '').trim().toLowerCase();
      const name = String(row.name || '').trim(); const details = String(row.details || '').trim();
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !details) return res.status(400).json({ message: 'Every OD row needs a student name, valid email and OD details.' });
      const student = await User.findOne({ email, role: { $in: ['student','president','vice_president'] }, isActive: true }).select('_id name email');
      cleaned.push({ name, email, details, student: student?._id || null });
    }
    let od;
    if (req.params.id) {
      od = await ODList.findOne({ _id: req.params.id, club: access.club._id });
      if (!od) return res.status(404).json({ message: 'OD list not found.' });
      od.description = desc; od.rows = cleaned; od.submittedBy = req.user._id; od.status = 'pending'; od.decidedBy = null; od.decisionNote = ''; od.decidedAt = null; await od.save();
    } else od = await ODList.create({ club: access.club._id, description: desc, rows: cleaned, submittedBy: req.user._id });
    const coordinators = await User.find({ role: 'club_coordinator', isActive: true }).select('_id');
    for (const c of coordinators) await createNotification(c._id, `OD list submitted: ${desc}`, `${req.user.name} submitted an OD list for ${access.club.name}. Open the OD section to review the student details.`, 'od_review');
    for (const row of cleaned) if (row.student) await createNotification(row.student, `OD updated: ${desc}`, `Your OD entry has been ${req.params.id ? 'updated' : 'submitted'} for ${desc}. Please check your notifications.`, 'od_update');
    return res.status(200).json({ message: req.params.id ? 'OD list updated and notifications sent.' : 'OD list submitted and notifications sent.', od });
  } catch (err) { return res.status(500).json({ message: err.message }); }
};

exports.decideOD = async (req, res) => {
  try {
    if (req.user.role !== 'club_coordinator') return res.status(403).json({ message: 'Only the Club Coordinator can decide OD lists.' });
    const { decision, note = '' } = req.body;
    if (!['approved','rejected'].includes(decision)) return res.status(400).json({ message: 'Decision must be approved or rejected.' });
    const od = await ODList.findById(req.params.id).populate('club', 'name');
    if (!od) return res.status(404).json({ message: 'OD list not found.' });
    od.status = decision; od.decidedBy = req.user._id; od.decisionNote = String(note).slice(0,1000); od.decidedAt = new Date(); await od.save();
    await createNotification(od.submittedBy, `OD list ${decision}: ${od.description}`, `The OD list for ${od.club.name} was ${decision}.${note ? ` Note: ${note}` : ''}`, 'od_decision');
    for (const row of od.rows) if (row.student) await createNotification(row.student, `OD ${decision}: ${od.description}`, `The Club Coordinator has ${decision} the OD list for ${od.description}.${note ? ` Note: ${note}` : ''}`, 'od_decision');
    return res.json({ message: `OD list ${decision}.`, od });
  } catch (err) { return res.status(500).json({ message: err.message }); }
};
