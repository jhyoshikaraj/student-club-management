const ClubJoiningRequest = require('../models/ClubJoiningRequest');
const Club = require('../models/Club');
const User = require('../models/User');
const ClubJoining = require('../models/ClubJoining');
const { createNotification } = require('../utils/notify');

exports.submitRequest = async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ message: 'Only students can submit club joining requests' });
    const club = await Club.findById(req.params.clubId);
    if (!club) return res.status(404).json({ message: 'Club not found' });
    if (req.user.club && req.user.club.toString() === club._id.toString()) {
      return res.status(400).json({ message: 'You are already in this club' });
    }
    if (!club.approvalsOpen) return res.status(403).json({ message: 'This club is not currently accepting new recruits.' });
    const activeMembership = await ClubJoining.findOne({ student: req.user._id, club: club._id, active: true });
    if (activeMembership) return res.status(400).json({ message: 'You are already a member of this club.' });

    const motivation = String(req.body.motivation || '').trim();
    const roleChoices = Array.isArray(req.body.roleChoices) ? [...new Set(req.body.roleChoices.map(x => String(x).trim()).filter(Boolean))].slice(0, 3) : [];
    if (!motivation) return res.status(400).json({ message: 'Please explain why you want to join this club.' });
    if (!roleChoices.length) return res.status(400).json({ message: 'Choose at least one role preference.' });
    const availableRoles = (club.openRoles || []).map(x => String(x));
    if (!availableRoles.length) return res.status(400).json({ message: 'This club has not configured recruitment roles yet.' });
    if (roleChoices.some(x => !availableRoles.includes(x))) return res.status(400).json({ message: 'One or more selected roles are not currently offered by this club.' });
    const existing = await ClubJoiningRequest.findOne({ student: req.user._id, club: club._id });
    if (existing && existing.status === 'pending') return res.status(400).json({ message: 'A joining request is already pending' });
    if (existing && existing.status === 'approved') {
      const membership = await ClubJoining.findOne({ student: req.user._id, club: club._id, active: true });
      if (membership) return res.status(400).json({ message: 'Your request was already approved and you are still a member.' });
      existing.status = 'rejected';
    }
    if (existing) {
      existing.status = 'pending';
      existing.reviewedBy = null;
      existing.reviewNote = '';
      existing.motivation = motivation;
      existing.roleChoices = roleChoices;
      await existing.save();
      if (club.president) await createNotification(club.president, 'New club joining request', `${req.user.name} submitted a joining request for ${club.name}.`, 'joining_request');
      return res.status(201).json(existing);
    }

    const request = await ClubJoiningRequest.create({ student: req.user._id, club: club._id, motivation, roleChoices });
    if (club.president) await createNotification(club.president, 'New club joining request', `${req.user.name} submitted a joining request for ${club.name}.`, 'joining_request');
    return res.status(201).json(request);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.myClubs = async (req, res) => {
  const populateClub = { path: 'club', populate: [
    { path: 'president', select: 'name email' },
    { path: 'vicePresident', select: 'name email' },
    { path: 'facultyCoordinator', select: 'name email' }
  ] };
  let memberships = await ClubJoining.find({ student: req.user._id, active: true }).populate(populateClub).sort('-joinedAt');
  const represented = new Set(memberships.map(m => String(m.club?._id)).filter(Boolean));
  // Compatibility for legacy data where Club.members/User.club were set before ClubJoining existed.
  const legacyClubs = await Club.find({ members: req.user._id }).populate('president', 'name email').populate('vicePresident', 'name email').populate('facultyCoordinator', 'name email');
  for (const club of legacyClubs) if (!represented.has(String(club._id))) memberships.push({ _id: `legacy-${club._id}`, club, joinedAt: club.createdAt, student: req.user._id, active: true });
  for (const membership of memberships) {
    if (!membership.club) continue;
    if (!membership.club.president) membership.club.president = await User.findOne({ club: membership.club._id, role: 'president' }).select('name email');
    if (!membership.club.vicePresident) membership.club.vicePresident = await User.findOne({ club: membership.club._id, role: 'vice_president' }).select('name email');
    if (!membership.club.facultyCoordinator) membership.club.facultyCoordinator = await User.findOne({ coordinatedClubs: membership.club._id, role: 'faculty_coordinator' }).select('name email');
  }
  return res.json(memberships);
};

exports.myRequests = async (req, res) => {
  const requests = await ClubJoiningRequest.find({ student: req.user._id })
    .populate('club', 'name description')
    .populate('reviewedBy', 'name role')
    .sort('-createdAt');
  return res.json(requests);
};

exports.pendingRequests = async (req, res) => {
  if (req.user.role !== 'president') return res.status(403).json({ message: 'Only a club president can review joining requests.' });
  const Club = require('../models/Club');
  const clubs = await Club.find({ $or: [{ president: req.user._id }, { accessEmails: String(req.user.email).toLowerCase() }] }).select('_id');
  const ids = clubs.map(c => c._id);
  const requests = await ClubJoiningRequest.find({ status: 'pending', club: { $in: ids } })
    .populate('student', 'name email position assignedMentor')
    .populate('club', 'name president openRoles')
    .sort('-createdAt');
  return res.json(requests);
};

exports.decideRequest = async (req, res) => {
  try {
    const { decision, note } = req.body;
    if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ message: 'Decision must be approved or rejected' });

    const request = await ClubJoiningRequest.findById(req.params.id).populate('student', 'name email role club').populate('club', 'name facultyCoordinator');
    if (!request) return res.status(404).json({ message: 'Joining request not found' });

    const targetClub = await Club.findById(request.club._id).select('president accessEmails');
    const isPresident = targetClub && (String(targetClub.president || '') === String(req.user._id) || (targetClub.accessEmails || []).includes(String(req.user.email).toLowerCase()));
    if (req.user.role !== 'president' || !isPresident) return res.status(403).json({ message: 'Only the president of the requested club can approve or reject this request.' });
    if (request.status !== 'pending') return res.status(400).json({ message: 'This request has already been reviewed' });

    request.status = decision;
    request.reviewedBy = req.user._id;
    request.reviewNote = note || '';
    await request.save();

    if (decision === 'approved') {
      const clubDoc = await Club.findById(request.club._id);
      if (clubDoc) {
        clubDoc.members.addToSet(request.student._id);
        if (!(clubDoc.memberRoles || []).some(r => String(r.user) === String(request.student._id))) clubDoc.memberRoles.push({ user: request.student._id, position: 'Member' });
        await clubDoc.save();
      }
      await ClubJoining.findOneAndUpdate(
        { student: request.student._id, club: request.club._id },
        { student: request.student._id, club: request.club._id, active: true },
        { upsert: true, new: true }
      );
      const studentUser = await User.findById(request.student._id);
      if (!studentUser.club) await User.findByIdAndUpdate(request.student._id, { club: request.club._id, position: 'Member' });
      await createNotification(request.student._id, 'Club joining approved', `Your request to join ${request.club.name} has been approved.`, 'joining_decision');
    } else {
      await createNotification(request.student._id, 'Club joining request rejected', `Your request to join ${request.club.name} was rejected.${note ? ` Note: ${note}` : ''}`, 'joining_decision');
    }

    return res.json(request);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
