// Restrict a route to a fixed set of roles
const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden: insufficient role' });
  }
  next();
};

// True if this faculty coordinator oversees the given club id
const coordinates = (user, clubId) => {
  if (user.role !== 'faculty_coordinator') return false;
  return user.coordinatedClubs.some((c) => c.toString() === clubId.toString());
};

// True if the user is president/VP OF the specific club (not just any club)
const isClubLeader = (user, clubId) => {
  return (
    ['president', 'vice_president'].includes(user.role) &&
    user.club &&
    user.club.toString() === clubId.toString()
  );
};

// A decision on a club-scoped resource can be made by the designated approver role,
// OR overridden by the faculty coordinator of that specific club.
const canDecide = (user, clubId, approverRole) => {
  if (user.role === approverRole) return true;
  if (coordinates(user, clubId)) return true;
  return false;
};

module.exports = { allowRoles, coordinates, isClubLeader, canDecide };
