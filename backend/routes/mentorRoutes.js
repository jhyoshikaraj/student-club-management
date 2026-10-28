const express = require('express');
const router = express.Router();
const { getMentees, getMyMentor } = require('../controllers/mentorController');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

router.get('/me', protect, allowRoles('student','president','vice_president'), getMyMentor);
router.get('/mentees', protect, allowRoles('faculty_mentor'), getMentees);

module.exports = router;
