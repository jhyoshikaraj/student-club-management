const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Not authorized, user not found or inactive' });
    }
    if (decoded.portalRole === 'president' && ['student','vice_president'].includes(user.role)) {
      const Club = require('../models/Club');
      const club = await Club.findOne({ _id: decoded.portalClubId, accessEmails: user.email }).select('_id president accessEmails');
      if (!club) return res.status(403).json({ message: 'President portal access has been revoked. Please sign in again or contact the Club Coordinator.' });
      // Session-only override: never save this mutated document. The database role remains student.
      user.role = 'president';
      user.club = club._id;
      user.portalAccess = true;
      user.portalClubId = String(club._id);
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

module.exports = { protect };
