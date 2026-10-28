const Event = require('../models/Event');
const User = require('../models/User');
const { isClubLeader } = require('../middleware/roles');
const { createNotification } = require('../utils/notify');

async function getAllClubStudentMembers(clubId, clubDocument = null) {
  const ClubJoining = require('../models/ClubJoining');
  const ClubJoiningRequest = require('../models/ClubJoiningRequest');
  const Club = require('../models/Club');
  const ids = new Set();
  const addId = value => {
    const id = value?._id || value;
    if (id) ids.add(String(id));
  };
  const club = clubDocument || await Club.findById(clubId).select('members president vicePresident');
  if (club) {
    (club.members || []).forEach(addId);
    addId(club.president);
    addId(club.vicePresident);
  }
  const [joinings, approvedRequests, usersByClub] = await Promise.all([
    ClubJoining.find({ club: clubId, active: true }).select('student'),
    ClubJoiningRequest.find({ club: clubId, status: 'approved' }).select('student'),
    User.find({ club: clubId, role: { $in: ['student', 'president', 'vice_president'] }, isActive: { $ne: false } }).select('_id')
  ]);
  joinings.forEach(x => addId(x.student));
  approvedRequests.forEach(x => addId(x.student));
  usersByClub.forEach(addId);
  if (!ids.size) return [];
  return User.find({
    _id: { $in: Array.from(ids) },
    role: { $in: ['student', 'president', 'vice_president'] },
    isActive: { $ne: false }
  }).select('name email role position assignedMentor').sort({ name: 1, email: 1 }).lean();
}

exports.createEvent = async (req, res) => {
 try {
  const { title, description, requirements, proposedBudget, date, expectedStartTime, expectedEndTime, venue, alternativeVenues = [], participantLimit = 100, club, hasOD, eventType = 'solo', collaboratingClubs = [] } = req.body;
  const Club = require('../models/Club');
  const primaryClub = await Club.findById(club);
  if (!primaryClub) return res.status(404).json({ message: 'Primary club not found.' });
  // Creation is restricted to authenticated President/Vice President portal sessions.
  // Ordinary Student sessions must never create events, even if the student belongs to a club.
  if (!['president', 'vice_president'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only an authorized Club President or Vice President can create events.' });
  }
  // Student accounts authorized for a club are upgraded to a President portal role only
  // for that specific session by auth middleware. Enforce that club scope here.
  const portalClubId = req.user.portalClubId ? String(req.user.portalClubId) : null;
  const isAssignedPresident = String(primaryClub.president || '') === String(req.user._id);
  const isAssignedVicePresident = String(primaryClub.vicePresident || '') === String(req.user._id);
  const isAuthorizedEmail = (primaryClub.accessEmails || []).some(email => String(email).toLowerCase() === String(req.user.email).toLowerCase());
  const authorized = portalClubId ? portalClubId === String(primaryClub._id) : (isAssignedPresident || isAssignedVicePresident || (req.user.role === 'president' && isAuthorizedEmail));
  if (!authorized) return res.status(403).json({ message: 'You can create events only for a club where you have President or Vice President access.' });
  if (!title || !String(title).trim() || !date || !venue) return res.status(400).json({ message: 'Event title, date, and venue are required.' });
  const Venue = require('../models/Venue');
  const requestedVenueIds = Array.isArray(req.body.requestedVenues) && req.body.requestedVenues.length ? [...new Set(req.body.requestedVenues.map(String))] : [String(venue)];
  if (!requestedVenueIds.includes(String(venue))) requestedVenueIds.unshift(String(venue));
  const validVenues = await Venue.find({ _id: { $in: requestedVenueIds } }).select('_id');
  if (validVenues.length !== requestedVenueIds.length) return res.status(400).json({ message: 'Select only existing venues.' });
  if (!Number.isInteger(Number(participantLimit)) || Number(participantLimit) < 1 || Number(participantLimit) > 10000) return res.status(400).json({ message: 'Maximum participants must be between 1 and 10000.' });
  if (expectedStartTime && expectedEndTime && expectedEndTime <= expectedStartTime) return res.status(400).json({ message: 'Expected end time must be later than expected start time.' });
  if (!['solo','collaborative'].includes(eventType)) return res.status(400).json({message:'Event type must be solo or collaborative.'});
  const collabs = Array.isArray(collaboratingClubs) ? [...new Set(collaboratingClubs.map(String).filter(id => id !== String(club)))] : [];
  if (eventType === 'solo' && collabs.length) return res.status(400).json({ message: 'Solo events cannot include collaborating clubs.' });
  if (eventType === 'collaborative' && !collabs.length) return res.status(400).json({ message: 'Choose at least one collaborating club.' });
  let collaborationApprovals = [];
  if (collabs.length) {
    const found = await Club.find({ _id: { $in: collabs } }).select('_id name president');
    if (found.length !== collabs.length) return res.status(400).json({ message: 'One or more collaborating clubs were not found.' });
    const noPresident = found.find(c => !c.president);
    if (noPresident) return res.status(400).json({ message: `${noPresident.name} needs a club president before it can collaborate.` });
    collaborationApprovals = found.map(c => ({ club: c._id, president: c.president, status: 'pending' }));
  }
  const event = await Event.create({title,description,requirements: requirements || '',proposedBudget: Number(proposedBudget || 0),date,expectedStartTime: expectedStartTime || '',expectedEndTime: expectedEndTime || '',venue,alternativeVenues,requestedVenues:requestedVenueIds,participantLimit:Math.max(1,Number(participantLimit)||100),published:false,registrationOpen:false,club,eventType,collaboratingClubs: collabs,collaborationApprovals,createdBy:req.user._id,hasOD:Boolean(hasOD),facultyStatus:'pending',coordinatorStatus:'pending',venueStatus:'pending'});
  for (const approval of collaborationApprovals) await createNotification(approval.president, `Collaboration request: ${title}`, `${req.user.name} invited your club to collaborate on "${title}". Review the event before it proceeds to Club Coordinator approval.`, 'collaboration_request');
  const facultyIds = new Set([String(primaryClub.facultyCoordinator || '')].filter(Boolean));
  for (const id of facultyIds) await createNotification(id, `Faculty approval required: ${title}`, `${req.user.name} submitted "${title}" for your club's faculty approval. The next step is Club Coordinator review.`, 'event_review');
  return res.status(201).json(event);
 } catch(err) { return res.status(500).json({message:err.message}); }
};
exports.listEvents = async (req,res) => {
 const Club = require('../models/Club');
 let filter = {};
 if (req.query.club) filter = { $or: [{ club: req.query.club }, { collaboratingClubs: req.query.club }] };
 const today = new Date(); today.setHours(0,0,0,0);
 const role = req.user.role;
 if (role === 'student') {
   const memberClubs = await Club.find({ members: req.user._id }).select('_id');
   const ids = memberClubs.map(c => c._id);
   const publicEvents = { published: true, $or: [{ facultyStatus: 'approved' }, { facultyStatus: { $exists: false } }], coordinatorStatus: 'approved', venueStatus: 'approved', date: { $gte: today } };
   const clubWorkflow = ids.length ? { $or: [{ club: { $in: ids } }, { collaboratingClubs: { $in: ids } }] } : null;
   filter = clubWorkflow ? { $and: [filter, { $or: [publicEvents, clubWorkflow] }] } : { $and: [filter, publicEvents] };
 } else if (role === 'president') {
   const managed = await Club.find({ $or: [{ president: req.user._id }, { accessEmails: String(req.user.email).toLowerCase() }] }).select('_id');
   const ids = managed.map(c => c._id);
   filter = { $and: [filter, { $or: [{ club: { $in: ids } }, { collaboratingClubs: { $in: ids } }] }] };
 } else if (role === 'faculty_coordinator') {
   const assigned = await Club.find({ facultyCoordinator: req.user._id }).select('_id');
   const ids = assigned.map(c => c._id);
   filter = { $and: [filter, { $or: [{ club: { $in: ids } }, { collaboratingClubs: { $in: ids } }, { published: true, facultyStatus: 'approved', coordinatorStatus: 'approved', venueStatus: 'approved', date: { $gte: today } }] }] };
 } else if (role === 'faculty_mentor') {
   filter = { $and: [filter, { published: true, $or: [{ facultyStatus: 'approved' }, { facultyStatus: { $exists: false } }], coordinatorStatus: 'approved', venueStatus: 'approved', date: { $gte: today } }] };
 }
 const events = await Event.find(filter).populate('club','name president facultyCoordinator members accessEmails').populate('collaboratingClubs','name president facultyCoordinator members').populate('venue','name location').populate('alternativeVenues','name location').populate('requestedVenues','name location').populate('createdBy','name role').populate('coordinatorDecisionBy','name').populate('facultyDecisionBy','name').populate('roleAssignments.student','name email').sort('date');
 if (role === 'student') {
   const membershipIds = new Set((await Club.find({members:req.user._id}).select('_id')).map(c=>String(c._id)));
   return res.json(events.map(e=>{
     const obj=e.toObject();
     const isClubMember = membershipIds.has(String(e.club?._id)) || (e.collaboratingClubs||[]).some(c=>membershipIds.has(String(c._id)));
     // Approval workflow is private to members of the organizing/collaborating clubs and only before publication.
     // Public event listings never disclose internal approval states, even when the event is already published.
     obj.viewerCanSeeWorkflow = isClubMember;
     if (!obj.viewerCanSeeWorkflow) {
       delete obj.facultyStatus; delete obj.facultyDecisionNote; delete obj.facultyDecisionBy; delete obj.coordinatorStatus; delete obj.venueStatus;
       delete obj.coordinatorDecisionNote; delete obj.venueDecisionNote;
       delete obj.coordinatorDecisionBy;
     }
     return obj;
   }));
 }
 return res.json(events);
};
exports.getEvent = async(req,res)=>{
 const event=await Event.findById(req.params.id)
   .populate({path:'club',select:'name president vicePresident facultyCoordinator members accessEmails'})
   .populate({path:'collaboratingClubs',select:'name president facultyCoordinator members'})
   .populate('venue','name location').populate('alternativeVenues','name location')
   .populate('requestedVenues','name location').populate('createdBy','name role')
   .populate('facultyDecisionBy','name').populate('coordinatorDecisionBy','name')
   .populate('roleAssignments.student','name email');
 if(!event)return res.status(404).json({message:'Event not found'});
 // Build the member list from every membership representation used by this project:
 // Club.members, active ClubJoining records, approved join requests, and User.club.
 let clubMemberDetails = [];
 if (event.club?._id) {
   clubMemberDetails = await getAllClubStudentMembers(event.club._id, event.club);
 }
 const role=req.user.role;
 if(role==='president') {
   const Club=require('../models/Club');
   const managed=await Club.find({$or:[{president:req.user._id},{accessEmails:String(req.user.email).toLowerCase()}]}).select('_id');
   const ids=new Set(managed.map(c=>String(c._id)));
   const relevant=ids.has(String(event.club?._id))||(event.collaboratingClubs||[]).some(c=>ids.has(String(c._id)));
   if(!relevant)return res.status(404).json({message:'Event not found'});
 }
 if(role==='student') {
   const Club=require('../models/Club');
   const memberships=await Club.find({members:req.user._id}).select('_id'); const ids=new Set(memberships.map(c=>String(c._id)));
   const memberOfEvent=ids.has(String(event.club?._id)) || (event.collaboratingClubs||[]).some(c=>ids.has(String(c._id)));
   const publicApproved=event.published && (event.facultyStatus==='approved' || event.facultyStatus==null) && event.coordinatorStatus==='approved' && event.venueStatus==='approved';
   if(!publicApproved && !memberOfEvent) return res.status(404).json({message:'Event not found'});
   // Hide internal approval information from students viewing the public event catalogue.
   if (!memberOfEvent) {
     const obj=event.toObject();
     delete obj.facultyStatus; delete obj.facultyDecisionNote; delete obj.facultyDecisionBy; delete obj.coordinatorStatus; delete obj.venueStatus;
     delete obj.coordinatorDecisionNote; delete obj.venueDecisionNote;
     delete obj.coordinatorDecisionBy;
     return res.json(obj);
   }
 }
 if(role==='faculty_mentor' && !(event.published && (event.facultyStatus==='approved' || event.facultyStatus==null) && event.coordinatorStatus==='approved' && event.venueStatus==='approved')) return res.status(404).json({message:'Event not found'});
 if(role==='faculty_coordinator') {
   const Club=require('../models/Club'); const assigned=await Club.exists({facultyCoordinator:req.user._id,_id:{$in:[event.club?._id,...(event.collaboratingClubs||[]).map(c=>c._id)]}});
   if(!assigned && !(event.published && (event.facultyStatus==='approved' || event.facultyStatus==null) && event.coordinatorStatus==='approved' && event.venueStatus==='approved')) return res.status(404).json({message:'Event not found'});
 }
 const response = event.toObject();
 if (response.club) response.club.members = clubMemberDetails;
 return res.json(response);
};

exports.registerForEvent = async (req,res) => {
 try {
  if (req.user.role !== 'student') return res.status(403).json({message:'Only student accounts can register for events.'});
  const event=await Event.findById(req.params.id);
  if(!event || !event.published || !event.registrationOpen || !(event.facultyStatus==='approved'||event.facultyStatus==null) || event.coordinatorStatus!=='approved' || event.venueStatus!=='approved' || new Date(event.date)<new Date()) return res.status(400).json({message:'Registration is not open for this event.'});
  const Registration=require('../models/EventRegistration');
  const existing=await Registration.findOne({event:event._id,student:req.user._id}); if(existing)return res.status(409).json({message:'You are already registered for this event.'});
  const count=await Registration.countDocuments({event:event._id}); if(count>=event.participantLimit){event.registrationOpen=false;await event.save();return res.status(409).json({message:'Registration is full. Registration has been closed.'});}
  const reg=await Registration.create({event:event._id,student:req.user._id});
  if(await Registration.countDocuments({event:event._id})>=event.participantLimit){event.registrationOpen=false;await event.save();}
  return res.status(201).json({message:'Registration successful.',registration:reg});
 } catch(err){ if(err.code===11000)return res.status(409).json({message:'You are already registered for this event.'}); return res.status(500).json({message:err.message}); }
};
exports.listRegistrations = async (req,res) => {
 const event=await Event.findById(req.params.id).populate('club','president accessEmails').populate('collaboratingClubs','president accessEmails');
 if(!event)return res.status(404).json({message:'Event not found'});
 const canManage = ['club_coordinator','venue_admin','director','faculty_coordinator'].includes(req.user.role) || String(event.createdBy)===String(req.user._id) || String(event.club?.president||'')===String(req.user._id) || (event.collaboratingClubs||[]).some(c=>String(c.president||'')===String(req.user._id)) || (event.club?.accessEmails||[]).map(x=>x.toLowerCase()).includes(String(req.user.email).toLowerCase());
 if(!canManage)return res.status(403).json({message:'Only the organizing or collaborating club leadership can view registrations.'});
 const Registration=require('../models/EventRegistration'); const rows=await Registration.find({event:event._id}).populate('student','name email role').sort('registeredAt');
 return res.json(rows);
};
exports.updatePublication = async(req,res)=>{
 const event=await Event.findById(req.params.id).populate('club','president accessEmails').populate('collaboratingClubs','president'); if(!event)return res.status(404).json({message:'Event not found'});
 const allowed=String(event.club?.president||'')===String(req.user._id)||(event.club?.accessEmails||[]).map(x=>x.toLowerCase()).includes(String(req.user.email).toLowerCase());
 if(req.user.role!=='president'||!allowed)return res.status(403).json({message:'Only the authorized organizing Club President can publish this event.'});
 const {published,registrationOpen,registrationDescription}=req.body;
 if(published && (!event.roleAllocationConfirmed || !(event.facultyStatus==='approved'||event.facultyStatus==null)||event.coordinatorStatus!=='approved'||event.venueStatus!=='approved'||(event.collaborationApprovals||[]).some(a=>a.status!=='approved'))) return res.status(400).json({message:'All approvals and confirmed event-role allocation are required before publishing.'});
 event.published=Boolean(published);
 event.registrationOpen=Boolean(registrationOpen)&&event.published;
 if (typeof registrationDescription === 'string') event.registrationDescription = registrationDescription.trim().slice(0,2000);
 await event.save(); return res.json({message:event.published?(event.registrationOpen?'Event published and registration opened.':'Event published; registration is closed.'):'Event unpublished.',event});
};
exports.decideEvent = async(req,res)=>{
 try {
  const {decision,note}=req.body;
  if(req.user.role!=='club_coordinator')return res.status(403).json({message:'Only the Club Coordinator can approve events'});
  if(!['approved','rejected'].includes(decision))return res.status(400).json({message:'Decision must be approved or rejected'});
  const event=await Event.findById(req.params.id).populate('createdBy','_id name').populate('club','name');
  if(!event)return res.status(404).json({message:'Event not found'});
  if(event.facultyStatus!=='approved')return res.status(400).json({message:'Faculty Coordinator approval is required before Club Coordinator review.'});
  if(event.coordinatorStatus!=='pending')return res.status(400).json({message:'This event has already been reviewed'});
  if ((event.collaborationApprovals || []).some(a => a.status === 'pending')) return res.status(400).json({ message: 'Wait until every collaborating club president decides the collaboration request.' });
  if ((event.collaborationApprovals || []).some(a => a.status === 'rejected')) return res.status(400).json({ message: 'This event has a rejected collaboration request and cannot be approved.' });
  event.coordinatorStatus=decision; event.coordinatorDecisionBy=req.user._id; event.coordinatorDecisionNote=note||'';
  if(decision==='rejected') event.venueStatus='rejected';
  await event.save();
  await createNotification(event.createdBy._id, `Event ${decision}: ${event.title}`, decision==='approved'?`Your event "${event.title}" was approved by the Club Coordinator. The venue request is now available to the Venue Administrator.`:`Your event "${event.title}" was rejected.${note?` Note: ${note}`:''}`, 'event_decision');
  if(decision==='approved'){
   const admins=await User.find({role:'venue_admin',isActive:true}).select('_id');
   for(const a of admins) await createNotification(a._id,`Venue request: ${event.title}`,`The event "${event.title}" has passed Club Coordinator approval and is ready for venue review.`, 'venue_request');
  }
  return res.json(event);
 }catch(err){return res.status(500).json({message:err.message});}
};
exports.updateEventStatus=async(req,res)=>{
 const event=await Event.findById(req.params.id); if(!event)return res.status(404).json({message:'Event not found'});
 const Club = require('../models/Club'); const club = await Club.findById(event.club); const allowed = club && (String(club.president||'')===String(req.user._id) || String(club.vicePresident||'')===String(req.user._id) || (club.accessEmails||[]).includes(String(req.user.email).toLowerCase())); if(!allowed)return res.status(403).json({message:'Only this club president or an authorized club account can update event status'});
 event.status=req.body.status; await event.save(); return res.json(event);
};

exports.deletePastEvent = async (req, res) => {
 try {
  if (req.user.role !== 'club_coordinator') return res.status(403).json({ message: 'Only the Club Coordinator can delete past events.' });
  const event = await Event.findById(req.params.id);
  if (!event) return res.status(404).json({ message: 'Event not found.' });
  const past = new Date(event.date).getTime() < Date.now() || ['completed','cancelled'].includes(event.status);
  if (!past) return res.status(400).json({ message: 'Only past, completed, or cancelled events can be deleted.' });
  await Event.findByIdAndDelete(event._id);
  const Budget = require('../models/Budget'); const Attendance = require('../models/Attendance');
  await Promise.all([Budget.deleteMany({ event: event._id }), Attendance.deleteMany({ event: event._id })]);
  return res.json({ message: 'Past event and its linked budget records were deleted.' });
 } catch (err) { return res.status(500).json({ message: err.message }); }
};

exports.decideCollaboration = async (req, res) => {
 try {
  const { decision, note = '' } = req.body;
  if (!['approved','rejected'].includes(decision)) return res.status(400).json({ message: 'Decision must be approved or rejected.' });
  const event = await Event.findById(req.params.id).populate('createdBy','_id name').populate('club','name');
  if (!event) return res.status(404).json({ message: 'Event not found.' });
  const approval = (event.collaborationApprovals || []).find(a => String(a.president) === String(req.user._id));
  if (!approval || req.user.role !== 'president') return res.status(403).json({ message: 'Only the president of a requested collaborating club can decide this invitation.' });
  if (approval.status !== 'pending') return res.status(400).json({ message: 'You have already decided this collaboration request.' });
  approval.status = decision; approval.note = String(note).slice(0,1000); approval.decidedAt = new Date();
  if (decision === 'rejected') { event.coordinatorStatus = 'rejected'; event.venueStatus = 'rejected'; event.coordinatorDecisionNote = `Collaboration declined by ${req.user.name}.${note ? ` ${note}` : ''}`; }
  await event.save();
  await createNotification(event.createdBy._id, `Collaboration ${decision}: ${event.title}`, `${req.user.name} ${decision} the collaboration invitation for "${event.title}".${note ? ` Note: ${note}` : ''}`, 'collaboration_decision');
  return res.json({ message: `Collaboration ${decision}.`, event });
 } catch (err) { return res.status(500).json({ message: err.message }); }
};


exports.decideFacultyApproval = async (req, res) => {
 try {
  const { decision, note = '' } = req.body;
  if (!['approved','rejected'].includes(decision)) return res.status(400).json({message:'Decision must be approved or rejected.'});
  const Club = require('../models/Club');
  const event = await Event.findById(req.params.id).populate('club','name facultyCoordinator president').populate('createdBy','_id name');
  if (!event) return res.status(404).json({message:'Event not found.'});
  if (req.user.role !== 'faculty_coordinator' || String(event.club?.facultyCoordinator || '') !== String(req.user._id)) return res.status(403).json({message:'Only this club’s assigned Faculty Coordinator can decide this event.'});
  if (event.facultyStatus !== 'pending') return res.status(409).json({message:'Faculty approval has already been decided.'});
  event.facultyStatus = decision;
  event.facultyDecisionBy = req.user._id;
  event.facultyDecisionNote = String(note).trim().slice(0,1500);
  if (decision === 'rejected') { event.coordinatorStatus='rejected'; event.venueStatus='rejected'; event.published=false; event.registrationOpen=false; }
  await event.save();
  const presidentIds = new Set([String(event.createdBy?._id || '')].filter(Boolean));
  if (event.club?.president) presidentIds.add(String(event.club.president));
  for (const id of presidentIds) await createNotification(id, `Faculty ${decision}: ${event.title}`, `Faculty Coordinator ${decision} the event "${event.title}".${event.facultyDecisionNote ? ` Note: ${event.facultyDecisionNote}` : ''}`, 'event_decision');
  if (decision === 'approved') {
    const coordinators = await User.find({role:'club_coordinator',isActive:true}).select('_id');
    for (const c of coordinators) await createNotification(c._id, `Event approval: ${event.title}`, `The event "${event.title}" has passed Faculty Coordinator approval and is ready for Club Coordinator review.`, 'event_review');
  }
  return res.json({message:`Faculty approval ${decision}.`,event});
 } catch(err) { return res.status(500).json({message:err.message}); }
};

exports.updateRoleAssignments = async (req, res) => {
 try {
  const event = await Event.findById(req.params.id).populate('club','president accessEmails members');
  if (!event) return res.status(404).json({message:'Event not found.'});
  const authorized = req.user.role === 'president' && (String(event.club?.president || '') === String(req.user._id) || (event.club?.accessEmails || []).some(x=>String(x).toLowerCase()===String(req.user.email).toLowerCase()));
  if (!authorized) return res.status(403).json({message:'Only the organizing Club President can allocate event roles.'});
  if (!(event.facultyStatus==='approved' && event.coordinatorStatus==='approved' && event.venueStatus==='approved' && (event.collaborationApprovals||[]).every(a=>a.status==='approved'))) return res.status(409).json({message:'All required approvals must be complete before allocating event roles.'});
  if (event.roleAllocationConfirmed && req.body.confirm !== true) return res.status(409).json({message:'Role allocation is confirmed. Send confirm:true to save an edited allocation.'});
  const assignments = Array.isArray(req.body.assignments) ? req.body.assignments : [];
  const allClubMembers = await getAllClubStudentMembers(event.club?._id, event.club);
  const members = new Set(allClubMembers.map(m => String(m._id)));
  const seen = new Set();
  for (const a of assignments) {
    const student = String(a.student || '');
    const role = String(a.role || 'Member').trim().slice(0,100) || 'Member';
    if (!members.has(student)) return res.status(400).json({message:'Every assigned student must belong to the organizing club.'});
    if (seen.has(student)) return res.status(400).json({message:'Each student can have only one event role.'});
    seen.add(student);
    a.role = role;
  }
  event.roleAssignments = assignments.map(a=>({student:a.student,role:String(a.role||'Member').trim().slice(0,100)||'Member'}));
  event.roleAllocationConfirmed = req.body.confirm === true;
  event.roleAllocationConfirmedAt = event.roleAllocationConfirmed ? new Date() : null;
  await event.save();
  await event.populate('roleAssignments.student','name email assignedMentor');
  if (event.roleAllocationConfirmed) {
    for (const assignment of event.roleAssignments) {
      const student = assignment.student;
      if (!student?._id) continue;
      await createNotification(student._id, `Event role assigned: ${event.title}`, `Your role for "${event.title}" is "${assignment.role || 'Member'}". Contact your Club President if you need clarification.`, 'event_role_assignment');
      if (student.assignedMentor) await createNotification(student.assignedMentor, `Mentee event role updated: ${event.title}`, `Your mentee ${student.name} has the event role "${assignment.role || 'Member'}" for "${event.title}".`, 'mentee_event_role');
    }
  }
  return res.json({message:event.roleAllocationConfirmed?'Event role allocation confirmed.':'Event role allocation saved as a draft.',event});
 } catch(err) { return res.status(500).json({message:err.message}); }
};
