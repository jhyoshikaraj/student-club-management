const express = require('express');
const router = express.Router();
const { createClub, createClubWithLeadership, listClubs, getClub, myClubs, updateClubMember, updateClub, setApprovals, addAnnouncement, updateRecruitmentRoles } = require('../controllers/clubController');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

router.get('/', protect, listClubs);
router.get('/my-clubs', protect, allowRoles('president','vice_president','faculty_coordinator','student'), myClubs);
router.patch('/:id', protect, allowRoles('club_coordinator'), updateClub);
router.patch('/:id/members', protect, allowRoles('president','vice_president'), updateClubMember);
router.patch('/:id/approvals', protect, allowRoles('president'), setApprovals);
router.patch('/:id/recruitment-roles', protect, allowRoles('president'), updateRecruitmentRoles);
router.post('/:id/announcements', protect, allowRoles('president'), addAnnouncement);
router.get('/:id', protect, getClub);
router.post('/', protect, allowRoles('director'), createClub);
router.post('/coordinator-create', protect, allowRoles('club_coordinator'), createClubWithLeadership);

module.exports = router;
