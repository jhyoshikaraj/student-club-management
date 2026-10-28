const Message = require('../models/Message');
const User = require('../models/User');

const allowedRecipients = {
  student: ['president', 'vice_president', 'club_coordinator', 'faculty_mentor'],
  president: ['student', 'vice_president', 'faculty_coordinator', 'club_coordinator', 'venue_admin', 'faculty_mentor'],
  vice_president: ['student', 'president', 'faculty_coordinator', 'club_coordinator', 'venue_admin', 'faculty_mentor'],
  faculty_coordinator: ['president', 'vice_president', 'club_coordinator', 'venue_admin'],
  club_coordinator: ['president', 'vice_president', 'faculty_coordinator', 'venue_admin'],
  venue_admin: ['president', 'vice_president', 'faculty_coordinator', 'club_coordinator'],
  faculty_mentor: ['student', 'president', 'vice_president'],
  director: ['faculty_mentor', 'student', 'club_coordinator', 'faculty_coordinator', 'venue_admin', 'president', 'vice_president']
};

exports.listMessages = async (req, res) => {
  const messages = await Message.find({ $or: [{ sender: req.user._id }, { recipient: req.user._id }] })
    .populate('sender', 'name email role').populate('recipient', 'name email role').sort('-createdAt').limit(200);
  res.json(messages);
};

exports.sendMessage = async (req, res) => {
  try {
    const { to, subject, body, threadId } = req.body;
    if (!to || !subject?.trim() || !body?.trim()) return res.status(400).json({ message: 'Recipient email, subject and message are required' });
    const recipient = await User.findOne({ email: String(to).trim().toLowerCase(), isActive: true });
    if (!recipient) return res.status(404).json({ message: 'No active account was found for that email' });
    const allowed = allowedRecipients[req.user.role] || [];
    if (!allowed.includes(recipient.role)) return res.status(403).json({ message: `Your role cannot message a ${recipient.role} account` });
    if (['student','president','vice_president'].includes(req.user.role) && recipient.role === 'faculty_mentor') {
      const self = await User.findById(req.user._id).select('assignedMentor');
      if (!self.assignedMentor || String(self.assignedMentor) !== String(recipient._id)) return res.status(403).json({ message: 'You can message only your assigned mentor.' });
    }
    if (req.user.role === 'faculty_mentor') {
      const mentor = await User.findById(req.user._id).select('mentees');
      if (!mentor.mentees.some(id => id.toString() === recipient._id.toString())) return res.status(403).json({ message: 'Mentors can message only their assigned mentees' });
    }
    if (req.user.role === 'student' && !['president','vice_president','club_coordinator','faculty_mentor'].includes(recipient.role)) return res.status(403).json({ message: 'Students can message only club leadership or the Club Coordinator' });
    const message = await Message.create({ sender: req.user._id, recipient: recipient._id, subject: subject.trim(), body: body.trim(), threadId: threadId || null });
    const Notification = require('../models/Notification');
    await Notification.create({ recipient: recipient._id, title: subject.trim(), message: `${req.user.name} sent you a message. Open Messages to read it.`, type: 'message' });
    res.status(201).json(await message.populate([{path:'sender',select:'name email role'},{path:'recipient',select:'name email role'}]));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.readMessage = async (req, res) => {
  const message = await Message.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { readAt: new Date() }, { new: true })
    .populate('sender', 'name email role').populate('recipient', 'name email role');
  if (!message) return res.status(404).json({ message: 'Message not found' });
  res.json(message);
};
