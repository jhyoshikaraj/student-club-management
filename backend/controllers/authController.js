const User = require('../models/User');
const Club = require('../models/Club');
const generateToken = require('../utils/generateToken');

// @route POST /api/auth/register
// In production, restrict who can create which roles (e.g. only an admin/director
// creates faculty_coordinator or director accounts). Kept open here for demo/setup.
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, club, position, coordinatedClubs, mentees } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ message: 'Name, email, password and role are required' });
    const allowedRoles = ['student', 'vice_president', 'president', 'venue_admin', 'director', 'faculty_coordinator', 'club_coordinator', 'faculty_mentor'];
    if (!allowedRoles.includes(role)) return res.status(400).json({ message: 'Invalid role' });

    if (role !== 'student') return res.status(403).json({ message: 'Staff accounts are created by the Director through account management.' });

    const normalizedEmail = String(email).trim().toLowerCase();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role,
      club: club || null,
      position: position || '',
      coordinatedClubs: coordinatedClubs || [],
      mentees: mentees || []
    });

    return res.status(201).json({
      user: user.toSafeObject(),
      token: generateToken(user._id)
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password, portal } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail, isActive: true });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    // A student keeps their Student identity, but may be granted President-portal
    // access for a specific club through that club's authorized access email list.
    let tokenClaims = {};
    let responseUser = user.toSafeObject();
    if (String(portal || '').toLowerCase() === 'president' && ['student','vice_president'].includes(user.role)) {
      const Club = require('../models/Club');
      const authorizedClub = await Club.findOne({ accessEmails: normalizedEmail }).select('_id name');
      if (!authorizedClub) return res.status(403).json({ message: 'This student account has not been granted Club President portal access. Ask the Club Coordinator to authorize this email for the club.' });
      tokenClaims = { portalRole: 'president', portalClubId: String(authorizedClub._id) };
      responseUser = { ...responseUser, role: 'president', club: authorizedClub._id, portalAccess: true, portalClubId: String(authorizedClub._id), portalClubName: authorizedClub.name, originalRole: user.role }; 
    } else if (portal && String(portal).toLowerCase() !== user.role) {
      return res.status(403).json({ message: `This account is assigned to ${user.role.replaceAll('_', ' ')}. Please return to the portal page and choose the matching portal.` });
    }
    return res.json({ user: responseUser, token: generateToken(user._id, tokenClaims) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route GET /api/auth/me
exports.me = async (req, res) => {
  const user = await User.findById(req.user._id).populate('assignedMentor', 'name email role');
  return res.json({ user: user.toSafeObject() });
};

exports.updateAccount = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'system_admin';
    const isDirector = req.user.role === 'director';
    if (!isAdmin && !isDirector) return res.status(403).json({ message: 'Only the Director or Account Administrator can edit permitted accounts.' });
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'Account not found.' });
    const { name, email, role, isActive, password, position } = req.body;
    if (isDirector && !['student','president','vice_president'].includes(target.role)) return res.status(403).json({ message: 'The Director can edit student accounts only; staff accounts are managed by the Account Administrator.' });
    if (isDirector && (role !== undefined || isActive !== undefined || password)) return res.status(403).json({ message: 'The Director can edit a student name, email and position only.' });
    if (String(target._id) === String(req.user._id) && role && role !== target.role) return res.status(400).json({ message: 'You cannot change your own administrator role.' });
    if (email && String(email).trim().toLowerCase() !== target.email) { const duplicate = await User.findOne({ email: String(email).trim().toLowerCase(), _id: { $ne: target._id } }); if (duplicate) return res.status(409).json({ message: 'That email is already used by another account.' }); target.email = String(email).trim().toLowerCase(); }
    if (name !== undefined) target.name = String(name).trim();
    if (role !== undefined) { if (!require('../models/User').ROLES.includes(role)) return res.status(400).json({ message: 'Invalid role.' }); target.role = role; }
    if (isActive !== undefined) target.isActive = Boolean(isActive);
    if (position !== undefined) target.position = String(position);
    if (password) { if (String(password).length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' }); target.password = password; }
    await target.save(); res.json({ message: 'Account updated.', user: target.toSafeObject() });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.deleteAccount = async (req, res) => {
 try {
  const isAdmin = req.user.role === 'system_admin';
  const isDirector = req.user.role === 'director';
  if (!isAdmin && !isDirector) return res.status(403).json({ message: 'Only the Director or Account Administrator can delete permitted accounts.' });
  if (String(req.params.id) === String(req.user._id)) return res.status(400).json({ message: 'You cannot delete the account currently signed in.' });
  const target = await User.findById(req.params.id); if (!target) return res.status(404).json({ message: 'Account not found.' });
  if (target.role === 'system_admin') return res.status(400).json({ message: 'System administrator accounts cannot be deleted here.' });
  if (isDirector && !['student','president','vice_president'].includes(target.role)) return res.status(403).json({ message: 'The Director can delete student accounts only.' });
  const ClubJoining = require('../models/ClubJoining');
  const ClubJoiningRequest = require('../models/ClubJoiningRequest');
  const Event = require('../models/Event');
  const Attendance = require('../models/Attendance');
  const Budget = require('../models/Budget');
  const Notification = require('../models/Notification');
  const Message = require('../models/Message');
  const AttendanceSession = require('../models/AttendanceSession');
  const ODList = require('../models/ODList');
  // Capture clubs overseen by this account before removing leadership references.
  const affectedClubIds = await Club.find({ $or: [{ president: target._id }, { vicePresident: target._id }, { facultyCoordinator: target._id }] }).distinct('_id');
  await Club.updateMany({}, { $pull: { members: target._id, memberRoles: { user: target._id }, accessEmails: target.email } });
  await Club.updateMany({ president: target._id }, { $set: { president: null } });
  await Club.updateMany({ vicePresident: target._id }, { $set: { vicePresident: null } });
  await Club.updateMany({ facultyCoordinator: target._id }, { $set: { facultyCoordinator: null } });
  await User.updateMany({ assignedMentor: target._id }, { $set: { assignedMentor: null } });
  await User.updateMany({ mentees: target._id }, { $pull: { mentees: target._id } });
  await ClubJoining.deleteMany({ student: target._id });
  await ClubJoiningRequest.deleteMany({ student: target._id });
  // Remove events authored by the deleted account; delete their dependent records too.
  const authoredEvents = await Event.find({ createdBy: target._id }).distinct('_id');
  if (authoredEvents.length) {
    await Attendance.deleteMany({ event: { $in: authoredEvents } });
    await Budget.deleteMany({ event: { $in: authoredEvents } });
    await Event.deleteMany({ _id: { $in: authoredEvents } });
  }
  await Attendance.updateMany({ 'records.student': target._id }, { $pull: { records: { student: target._id } } });
  await AttendanceSession.updateMany({ 'records.student': target._id }, { $pull: { records: { student: target._id } } });
  await ODList.updateMany({ 'rows.student': target._id }, { $pull: { rows: { student: target._id } } });
  await ODList.deleteMany({ submittedBy: target._id });
  await Notification.deleteMany({ recipient: target._id });
  await Message.deleteMany({ $or: [{ sender: target._id }, { recipient: target._id }] });
  await target.deleteOne();
  res.json({ message: 'Account deleted and related club, event, attendance, mentor, message and notification references cleaned up.' });
 } catch (err) { res.status(500).json({ message: err.message }); }
};


// Directory is intentionally limited to authenticated accounts; clients filter by role permissions.
exports.directory = async (req, res) => {
  const recipientRoles = {
    student: ['president','vice_president','club_coordinator','faculty_mentor'],
    president: ['student','vice_president','faculty_coordinator','club_coordinator','venue_admin','faculty_mentor'],
    vice_president: ['student','president','faculty_coordinator','club_coordinator','venue_admin','faculty_mentor'],
    faculty_coordinator: ['president','vice_president','club_coordinator','venue_admin'],
    club_coordinator: ['president','vice_president','faculty_coordinator','venue_admin'],
    venue_admin: ['president','vice_president','faculty_coordinator','club_coordinator'],
    faculty_mentor: ['student','president','vice_president'],
    director: ['student','president','vice_president','faculty_coordinator','faculty_mentor','club_coordinator','venue_admin'],
    system_admin: ['student','president','vice_president','faculty_coordinator','faculty_mentor','club_coordinator','venue_admin','director']
  };
  let query = { isActive: true, role: { $in: recipientRoles[req.user.role] || [] } };
  if (req.user.role === 'faculty_mentor') query._id = { $in: req.user.mentees || [] };
  const users = await User.find(query).select('name email role club position').sort('role email');
  if (['student','president','vice_president'].includes(req.user.role)) {
    const mentorId = req.user.assignedMentor ? String(req.user.assignedMentor) : '';
    return res.json(users.filter(u => u.role !== 'faculty_mentor' || String(u._id) === mentorId));
  }
  return res.json(users);
};


// Director-only account directory: always reads current records from MongoDB.
exports.accountDirectory = async (req, res) => {
  if (!['director','system_admin'].includes(req.user.role)) return res.status(403).json({ message: 'You are not allowed to view the account directory.' });
  try {
    const users = await User.find({}).select('name email role club position assignedMentor coordinatedClubs mentees isActive createdAt')
      .populate('club', 'name').populate('assignedMentor', 'name email').sort({ role: 1, email: 1 });
    res.json(users.map(u => ({ _id:u._id, name:u.name, email:u.email, role:u.role, club:u.club?.name || '', position:u.position || '', assignedMentor:u.assignedMentor ? { _id:u.assignedMentor._id, name:u.assignedMentor.name, email:u.assignedMentor.email } : null, isActive:u.isActive, createdAt:u.createdAt })));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.bulkCreate = async (req, res) => {
  try {
    if (req.user.role !== 'system_admin') return res.status(403).json({ message: 'Only the system account administrator can create accounts.' });
    const { role, count, start = 1, password } = req.body;
    const allowed = ['student', 'president', 'vice_president', 'faculty_coordinator', 'faculty_mentor'];
    const n = Number(count), first = Number(start);
    if (!allowed.includes(role)) return res.status(400).json({ message: 'This role is not available for account creation' });
    if (!Number.isInteger(n) || n < 1 || n > 100 || !Number.isInteger(first) || first < 1) return res.status(400).json({ message: 'Count must be 1-100 and starting number must be positive' });
    if (!password || String(password).length < 8) return res.status(400).json({ message: 'Temporary password must be at least 8 characters' });
    if (!Array.isArray(req.body.accounts) || req.body.accounts.length !== n) return res.status(400).json({ message: 'Provide a name and email for every account.' });

    const accounts = req.body.accounts.map((a, index) => ({
      name: String(a?.name || '').trim(),
      email: String(a?.email || '').trim().toLowerCase(),
      index
    }));
    for (const a of accounts) {
      if (!a.name) return res.status(400).json({ message: `Enter a name for account ${a.index + 1}.` });
      if (a.name.length > 120) return res.status(400).json({ message: `Name for account ${a.index + 1} must be 120 characters or fewer.` });
      if (a.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) return res.status(400).json({ message: `Enter a valid email address for ${a.name}.` });
    }
    const submittedEmails = accounts.map(a => a.email);
    if (new Set(submittedEmails).size !== submittedEmails.length) return res.status(400).json({ message: 'Each account must have a different email address.' });

    const created = [], skipped = [];
    for (const account of accounts) {
      const existing = await User.findOne({ email: account.email });
      if (existing) { skipped.push(account.email); continue; }
      const user = await User.create({
        name: account.name,
        email: account.email,
        password,
        role,
        position: role === 'president' ? 'President' : role === 'vice_president' ? 'Vice President' : role === 'student' ? 'Member' : ''
      });
      created.push({ name: user.name, email: user.email, password });
    }
    res.status(201).json({ created, skipped });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'An account with one of those email addresses already exists. Refresh the directory and try again.' });
    res.status(500).json({ message: err.message });
  }
};

exports.assignMentees = async (req, res) => {
  try {
    if (req.user.role !== 'director') return res.status(403).json({ message: 'Only the Director can assign mentors.' });
    const { mentorEmail, studentEmails } = req.body;
    const mentor = await User.findOne({ email: String(mentorEmail || '').toLowerCase(), role: 'faculty_mentor' });
    if (!mentor) return res.status(404).json({ message: 'Mentor account not found' });
    if (!Array.isArray(studentEmails)) return res.status(400).json({ message: 'Student email list is required' });
    const students = await User.find({ email: { $in: studentEmails.map(e => String(e).trim().toLowerCase()) }, role: { $in: ['student','president','vice_president'] } }).select('_id email role');
    const studentIds = students.map(s => s._id);
    // Remove only the selected students from any previous mentor, preserving all other mentees.
    await User.updateMany({ role: 'faculty_mentor', _id: { $ne: mentor._id } }, { $pull: { mentees: { $in: studentIds } } });
    await User.updateMany({ _id: mentor._id }, { $addToSet: { mentees: { $each: studentIds } } });
    await User.updateMany({ _id: { $in: studentIds } }, { $set: { assignedMentor: mentor._id } });
    res.json({ message: 'Mentees assigned', mentor: mentor.email, assigned: students.map(s => s.email) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};


// Director can assign or remove the mentor of an individual student account.
exports.setAccountMentor = async (req, res) => {
  try {
    if (req.user.role !== 'director') return res.status(403).json({ message: 'Only the Director can change student mentor assignments.' });
    const student = await User.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Account not found.' });
    if (!['student','president','vice_president'].includes(student.role)) return res.status(400).json({ message: 'Mentors can only be assigned to student accounts, including student club leaders.' });
    const mentorId = req.body.mentorId ? String(req.body.mentorId).trim() : '';
    const previousMentorId = student.assignedMentor ? String(student.assignedMentor) : '';
    let mentor = null;
    if (mentorId) {
      mentor = await User.findOne({ _id: mentorId, role: 'faculty_mentor', isActive: true });
      if (!mentor) return res.status(400).json({ message: 'Select an active faculty mentor.' });
    }
    if (previousMentorId && previousMentorId !== mentorId) await User.updateOne({ _id: previousMentorId, role: 'faculty_mentor' }, { $pull: { mentees: student._id } });
    student.assignedMentor = mentor ? mentor._id : null;
    await student.save();
    if (mentor) await User.updateOne({ _id: mentor._id }, { $addToSet: { mentees: student._id } });
    if (previousMentorId !== mentorId) {
      const { createNotification } = require('../utils/notify');
      const message = mentor ? `Your assigned mentor has been changed to ${mentor.name} (${mentor.email}).` : 'Your mentor assignment has been removed by the Director.';
      await createNotification(student._id, 'Mentor assignment updated', message, 'mentor_assignment');
    }
    return res.json({ message: mentor ? `Mentor assigned to ${student.name}.` : `Mentor removed from ${student.name}.`, assignedMentor: mentor ? { _id: mentor._id, name: mentor.name, email: mentor.email } : null });
  } catch (err) { return res.status(500).json({ message: err.message }); }
};
