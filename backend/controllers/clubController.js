const Club = require('../models/Club');

// @route POST /api/clubs  (director/admin sets up a new club)
exports.createClub = async (req, res) => {
  try {
    const { name, description, president, vicePresident, facultyCoordinator } = req.body;
    const club = await Club.create({ name, description, president, vicePresident, facultyCoordinator });
    return res.status(201).json(club);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route GET /api/clubs
exports.listClubs = async (req, res) => {
  const clubs = await Club.find()
    .populate('president vicePresident facultyCoordinator', 'name email role')
    .populate('members', 'name email role position assignedMentor');
  return res.json(clubs);
};

// @route GET /api/clubs/:id
exports.getClub = async (req, res) => {
  const club = await Club.findById(req.params.id)
    .populate('president vicePresident facultyCoordinator', 'name email role')
    .populate('members', 'name email role position assignedMentor');
  if (!club) return res.status(404).json({ message: 'Club not found' });
  return res.json(club);
};


// Club Coordinator creates a club and its initial leadership accounts together.
exports.myClubs = async (req, res) => {
  const User = require('../models/User');
  let filter;
  if (req.user.role === 'faculty_coordinator') filter = { facultyCoordinator: req.user._id };
  else if (req.user.role === 'president') filter = { $or: [{ president: req.user._id }, { accessEmails: String(req.user.email).toLowerCase() }] };
  else if (req.user.role === 'vice_president') filter = { $or: [{ vicePresident: req.user._id }, { accessEmails: String(req.user.email).toLowerCase() }] };
  else if (req.user.role === 'student') filter = { members: req.user._id };
  else return res.status(403).json({ message: 'My Clubs is available only to student club members and club leadership.' });
  const clubs = await Club.find(filter).populate('president vicePresident facultyCoordinator', 'name email role assignedMentor position').populate('members', 'name email role position assignedMentor');
  return res.json(clubs);
};

exports.updateClubMember = async (req, res) => {
  const User = require('../models/User');
  try {
    const club = await Club.findById(req.params.id);
    if (!club) return res.status(404).json({ message: 'Club not found' });
    if (String(club.president) !== String(req.user._id) && !(club.accessEmails || []).includes(String(req.user.email).toLowerCase())) return res.status(403).json({ message: 'Only this club president or an explicitly authorized account can manage its members.' });
    const { email, position, action = 'update', name, newEmail } = req.body;
    const member = await User.findOne({ email: String(email || '').trim().toLowerCase() });
    if (!member) return res.status(404).json({ message: 'Student account not found. Create the student account first.' });
    if (!['student','president','vice_president'].includes(member.role)) return res.status(400).json({ message: 'Only student accounts can be club members.' });
    if (action === 'remove') {
      if (String(club.president || '') === String(member._id)) return res.status(400).json({ message: 'The club president cannot be removed from their own club.' });
      club.members.pull(member._id);
      if (String(club.vicePresident || '') === String(member._id)) club.vicePresident = null;
      club.accessEmails = (club.accessEmails || []).filter(e => String(e).toLowerCase() !== member.email.toLowerCase());
      club.memberRoles = club.memberRoles.filter(r => String(r.user) !== String(member._id));
      await club.save();
      const ClubJoining = require('../models/ClubJoining');
      const ClubJoiningRequest = require('../models/ClubJoiningRequest');
      await ClubJoining.findOneAndUpdate({ student: member._id, club: club._id }, { active: false });
      await ClubJoiningRequest.updateOne({ student: member._id, club: club._id, status: 'approved' }, { $set: { status: 'rejected', reviewNote: 'Membership ended by club President.' } });
      return res.json({ message: `${member.name} removed from ${club.name}.` });
    }
    const oldEmail = member.email;
    if (name !== undefined && String(name).trim()) member.name = String(name).trim();
    if (newEmail !== undefined && String(newEmail).trim()) {
      const normalizedNewEmail = String(newEmail).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedNewEmail)) return res.status(400).json({ message: 'Enter a valid new email address.' });
      const duplicate = await User.findOne({ email: normalizedNewEmail, _id: { $ne: member._id } });
      if (duplicate) return res.status(409).json({ message: 'That email address belongs to another account.' });
      member.email = normalizedNewEmail;
    }
    await member.save();
    if (oldEmail !== member.email) club.accessEmails = (club.accessEmails || []).map(e => String(e).toLowerCase() === oldEmail ? member.email : e);
    const memberPosition = String(position || 'Member').trim();
    if (memberPosition.toLowerCase() === 'president' && String(club.president || '') !== String(member._id)) return res.status(400).json({ message: 'The President role is controlled by the club leadership assignment.' });
    // Keep the club-specific position on the Club record; a student can hold different roles in different clubs.
    club.members.addToSet(member._id);
    const roleRecord = club.memberRoles.find(r => String(r.user) === String(member._id));
    if (roleRecord) roleRecord.position = memberPosition; else club.memberRoles.push({ user: member._id, position: memberPosition });
    if (memberPosition.toLowerCase() === 'vice president') {
      if (club.vicePresident && String(club.vicePresident) !== String(member._id)) return res.status(409).json({ message: 'This club already has a Vice President. Change that member first.' });
      club.vicePresident = member._id; club.accessEmails = [...new Set([...(club.accessEmails || []), member.email.toLowerCase()])];
    } else if (String(club.vicePresident || '') === String(member._id)) {
      club.vicePresident = null; club.accessEmails = (club.accessEmails || []).filter(e => String(e).toLowerCase() !== member.email.toLowerCase());
    }
    await club.save();
    const ClubJoining = require('../models/ClubJoining');
    await ClubJoining.findOneAndUpdate({ student: member._id, club: club._id }, { student: member._id, club: club._id, active: true, joinedAt: new Date() }, { upsert: true });
    return res.json({ message: 'Club member details updated.', member: member.toSafeObject() });
  } catch (err) { return res.status(500).json({ message: err.message }); }
};


exports.updateClub = async (req, res) => {
  const User = require('../models/User');
  try {
    if (req.user.role !== 'club_coordinator') return res.status(403).json({ message: 'Only the Club Coordinator can edit club records.' });
    const club = await Club.findById(req.params.id);
    if (!club) return res.status(404).json({ message: 'Club not found.' });
    const { name, description, accessEmails, facultyCoordinatorEmail, presidentEmail } = req.body;
    const previousPresident = club.president ? await User.findById(club.president).select('_id email role') : null;
    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName || cleanName.length > 100) return res.status(400).json({ message: 'Club name must contain 1 to 100 characters.' });
      const duplicate = await Club.findOne({ name: cleanName, _id: { $ne: club._id } });
      if (duplicate) return res.status(409).json({ message: 'A club with this name already exists.' });
      club.name = cleanName;
    }
    if (description !== undefined) club.description = String(description).trim().slice(0, 2000);
    if (presidentEmail !== undefined) {
      const email = String(presidentEmail || '').trim().toLowerCase();
      const president = email ? await User.findOne({ email, role: { $in: ['student','president','vice_president'] }, isActive: true }) : null;
      if (email && !president) return res.status(400).json({ message: 'Select an existing active student account for the actual club President.' });
      if (president) {
        club.president = president._id;
        club.members.addToSet(president._id);
        const record = (club.memberRoles || []).find(r => String(r.user) === String(president._id));
        if (record) record.position = 'President'; else club.memberRoles.push({ user: president._id, position: 'President' });
      }
    }
    if (accessEmails !== undefined) {
      const emails = [...new Set((Array.isArray(accessEmails) ? accessEmails : String(accessEmails).split(/[\n,;]+/)).map(e => String(e).trim().toLowerCase()).filter(Boolean))];
      if (emails.some(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))) return res.status(400).json({ message: 'One or more authorized access emails are invalid.' });
      const accounts = await User.find({ email: { $in: emails }, role: { $in: ['student','president','vice_president'] }, isActive: true }).select('_id email');
      const found = new Set(accounts.map(a => a.email));
      const presidentAccount = club.president ? await User.findById(club.president).select('email') : null;
      const presidentEmail = String(presidentAccount?.email || '').toLowerCase();
      const missing = emails.filter(e => !found.has(e) && e !== presidentEmail);
      if (missing.length) return res.status(400).json({ message: `Create student accounts before authorizing them: ${missing.join(', ')}` });
      const presidentAccountForAccess = club.president ? await User.findById(club.president).select('email') : null;
      if (presidentAccountForAccess?.email) emails.push(String(presidentAccountForAccess.email).toLowerCase());
      if (previousPresident?.email && previousPresident.role !== 'student') emails.push(String(previousPresident.email).toLowerCase());
      club.accessEmails = [...new Set(emails)];
      for (const account of accounts) {
        club.members.addToSet(account._id);
        if (!(club.memberRoles || []).some(r => String(r.user) === String(account._id))) club.memberRoles.push({ user: account._id, position: 'Member' });
      }
    }
    if (facultyCoordinatorEmail !== undefined) {
      const email = String(facultyCoordinatorEmail || '').trim().toLowerCase();
      const faculty = email ? await User.findOne({ email, role: 'faculty_coordinator', isActive: true }) : null;
      if (email && !faculty) return res.status(400).json({ message: 'Select an existing active Faculty Coordinator account.' });
      const previous = club.facultyCoordinator;
      if (previous && String(previous) !== String(faculty?._id || '')) await User.updateOne({ _id: previous }, { $pull: { coordinatedClubs: club._id } });
      club.facultyCoordinator = faculty?._id || null;
      if (faculty) await User.updateOne({ _id: faculty._id }, { $addToSet: { coordinatedClubs: club._id } });
    }
    await club.save();
    const updated = await Club.findById(club._id).populate('president vicePresident facultyCoordinator', 'name email role').populate('members', 'name email role position');
    return res.json({ message: 'Club details updated.', club: updated });
  } catch (err) { return res.status(500).json({ message: err.message }); }
};

// Club Coordinator creates the club; the president can be a student account already used by another club.
exports.createClubWithLeadership = async (req, res) => {
  const User = require('../models/User');
  const createdUserIds = [];
  let createdClubId = null;
  try {
    const { name, description = '', president, facultyCoordinator, accessEmails = [], vicePresident = null } = req.body;
    if (!String(name || '').trim()) return res.status(400).json({ message: 'Club name is required.' });
    const p = president || {};
    const f = facultyCoordinator || {};
    if (!String(p.name || '').trim() || !String(p.email || '').trim()) return res.status(400).json({ message: 'President name and email are required.' });
    if (!String(f.name || '').trim() || !String(f.email || '').trim() || String(f.password || '').length < 8) return res.status(400).json({ message: 'Faculty Coordinator name, email, and password (at least 8 characters) are required.' });
    const emails = [String(p.email).trim().toLowerCase(), String(f.email).trim().toLowerCase()];
    if (vicePresident && String(vicePresident.email || '').trim()) {
      if (!String(vicePresident.name || '').trim() || String(vicePresident.password || '').length < 8) return res.status(400).json({ message: 'Vice President name and password (at least 8 characters) are required when creating that optional account.' });
      emails.push(String(vicePresident.email).trim().toLowerCase());
    }
    if (new Set(emails).size !== emails.length) return res.status(400).json({ message: 'Leadership accounts must use different emails.' });
    const existingClub = await Club.findOne({ name: String(name).trim() });
    if (existingClub) return res.status(409).json({ message: 'A club with this name already exists.' });
    const existingFaculty = await User.findOne({ email: emails[1] });
    if (existingFaculty) return res.status(409).json({ message: 'Faculty Coordinator email already belongs to an account. Use a different email.' });
    const normalizedAccess = [...new Set((Array.isArray(accessEmails) ? accessEmails : String(accessEmails || '').split(/[\n,;]+/)).map(e => String(e).trim().toLowerCase()).filter(Boolean))];
    const invalid = normalizedAccess.find(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (invalid) return res.status(400).json({ message: `Invalid authorized access email: ${invalid}` });
    const accessAccounts = normalizedAccess.length ? await User.find({ email: { $in: normalizedAccess } }).select('email role') : [];
    const foundEmails = new Set(accessAccounts.map(u => u.email));
    const unknown = normalizedAccess.filter(e => !foundEmails.has(e) && e !== emails[0]);
    if (unknown.length) return res.status(400).json({ message: `Create these accounts first before granting club access: ${unknown.join(', ')}` });
    let presidentUser = await User.findOne({ email: emails[0] });
    if (presidentUser && !['student','president','vice_president'].includes(presidentUser.role)) return res.status(400).json({ message: 'The president email belongs to a non-student account.' });
    if (!presidentUser) {
      if (String(p.password || '').length < 8) return res.status(400).json({ message: 'For a new president account, provide a password of at least 8 characters.' });
      presidentUser = await User.create({ name: String(p.name).trim(), email: emails[0], password: p.password, role: 'student', position: 'Member' });
      createdUserIds.push(presidentUser._id);
    } // Existing president accounts are not modified until club creation succeeds.
    const facultyUser = await User.create({ name: String(f.name).trim(), email: emails[1], password: f.password, role: 'faculty_coordinator', position: 'Faculty Coordinator' });
    createdUserIds.push(facultyUser._id);
    let vpUser = null;
    if (vicePresident && String(vicePresident.email || '').trim()) {
      vpUser = await User.findOne({ email: emails[2] });
      if (!vpUser) {
        vpUser = await User.create({ name: String(vicePresident.name || '').trim(), email: emails[2], password: vicePresident.password, role: 'vice_president', position: 'Vice President' });
        createdUserIds.push(vpUser._id);
      }
    }
    const presidentAccessEmails = [...new Set([...normalizedAccess, emails[0]])];
    const club = await Club.create({ name: String(name).trim(), description: String(description).trim(), president: presidentUser._id, vicePresident: vpUser?._id || null, facultyCoordinator: facultyUser._id, members: [presidentUser._id, ...(vpUser ? [vpUser._id] : [])], memberRoles: [{ user: presidentUser._id, position: 'President' }, ...(vpUser ? [{ user: vpUser._id, position: 'Vice President' }] : [])], accessEmails: presidentAccessEmails });
    createdClubId = club._id;
    presidentUser.name = String(p.name).trim();
    // Preserve an existing student's primary role; club-specific President status lives in memberRoles.
    if (!['student','president','vice_president'].includes(presidentUser.role)) presidentUser.role = 'student';
    if (presidentUser.role === 'student') presidentUser.position = presidentUser.position || 'Member';
    presidentUser.club = presidentUser.club || club._id; await presidentUser.save();
    if (vpUser) { vpUser.club = vpUser.club || club._id; await vpUser.save(); }
    facultyUser.coordinatedClubs = [...(facultyUser.coordinatedClubs || []), club._id]; await facultyUser.save();
    return res.status(201).json({ message: 'Club created.', club, accounts: [{name: presidentUser.name,email: presidentUser.email,role: presidentUser.role}, ...(vpUser?[{name:vpUser.name,email:vpUser.email,role:vpUser.role}]:[]), {name:facultyUser.name,email:facultyUser.email,role:facultyUser.role}] });
  } catch (err) {
    if (createdClubId) await Club.findByIdAndDelete(createdClubId).catch(() => {});
    if (createdUserIds.length) await User.deleteMany({ _id: { $in: createdUserIds } }).catch(() => {});
    if (err.code === 11000) return res.status(409).json({ message: 'A club or account with that name/email already exists.' });
    return res.status(500).json({ message: err.message });
  }
};


exports.setApprovals = async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) return res.status(404).json({ message: 'Club not found.' });
    if (String(club.president || '') !== String(req.user._id) && !(club.accessEmails || []).includes(String(req.user.email).toLowerCase())) return res.status(403).json({ message: 'Only this club president or an authorized club account can open or close joining approvals.' });
    if (Boolean(req.body.open) && !(club.openRoles || []).length) return res.status(400).json({ message: 'Add and save at least one recruitment role before opening recruitment.' });
    club.approvalsOpen = Boolean(req.body.open);
    await club.save();
    const Notification = require('../models/Notification');
    const User = require('../models/User');
    const students = await User.find({ role: 'student', isActive: true }).select('_id');
    const title = club.approvalsOpen ? 'Club recruitment is open' : 'Club recruitment is closed';
    const message = club.approvalsOpen ? `${club.name} is now accepting joining requests.` : `${club.name} is no longer accepting new joining requests.`;
    if (students.length) await Notification.insertMany(students.map(s => ({ recipient: s._id, title, message, type: 'club_announcement', read: false })));
    return res.json({ message, approvalsOpen: club.approvalsOpen });
  } catch (err) { return res.status(500).json({ message: err.message }); }
};

exports.addAnnouncement = async (req, res) => {
  try {
    const text = String(req.body.text || '').trim();
    if (!text || text.length > 2000) return res.status(400).json({ message: 'Announcement must contain 1 to 2000 characters.' });
    const club = await Club.findById(req.params.id);
    if (!club) return res.status(404).json({ message: 'Club not found.' });
    if (String(club.president || '') !== String(req.user._id) && !(club.accessEmails || []).includes(String(req.user.email).toLowerCase())) return res.status(403).json({ message: 'Only this club president or an authorized club account can publish announcements.' });
    club.announcements.unshift({ author: req.user._id, text });
    await club.save();
    const Notification = require('../models/Notification');
    const User = require('../models/User');
    const ids = (club.members || []).filter(id => String(id) !== String(req.user._id));
    if (ids.length) await Notification.insertMany(ids.map(id => ({ recipient: id, title: `Announcement: ${club.name}`, message: text, type: 'club_announcement', read: false })));
    return res.status(201).json({ message: 'Announcement published.', announcements: club.announcements });
  } catch (err) { return res.status(500).json({ message: err.message }); }
};


exports.updateRecruitmentRoles = async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) return res.status(404).json({ message: 'Club not found.' });
    const authorized = String(club.president || '') === String(req.user._id) || (club.accessEmails || []).map(x => String(x).toLowerCase()).includes(String(req.user.email).toLowerCase());
    if (req.user.role !== 'president' || !authorized) return res.status(403).json({ message: 'Only this club President can manage recruitment roles.' });
    if (club.approvalsOpen) return res.status(409).json({ message: 'Close recruitment before editing available roles.' });
    const roles = Array.isArray(req.body.roles) ? [...new Set(req.body.roles.map(x => String(x).trim()).filter(Boolean))] : [];
    if (!roles.length || roles.length > 20 || roles.some(x => x.length > 80)) return res.status(400).json({ message: 'Add between 1 and 20 valid roles.' });
    club.openRoles = roles;
    await club.save();
    return res.json({ message: 'Recruitment roles saved.', roles: club.openRoles });
  } catch (err) { return res.status(500).json({ message: err.message }); }
};
