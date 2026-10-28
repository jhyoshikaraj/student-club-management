const express = require('express');
const router = express.Router();
const { markAttendance, getAttendance, getStudentOD, listSessions, getSession, confirmSession, listODs, getOD, submitOD, decideOD } = require('../controllers/attendanceController');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

router.get('/sessions', protect, allowRoles('president','faculty_coordinator','club_coordinator'), listSessions);
router.post('/sessions', protect, allowRoles('president'), confirmSession);
router.get('/sessions/:id', protect, allowRoles('president','faculty_coordinator','club_coordinator'), getSession);
router.put('/sessions/:id/confirm', protect, allowRoles('president'), confirmSession);
router.get('/ods', protect, allowRoles('president','club_coordinator'), listODs);
router.post('/ods', protect, allowRoles('president'), submitOD);
router.get('/ods/:id', protect, allowRoles('president','club_coordinator'), getOD);
router.put('/ods/:id', protect, allowRoles('president'), submitOD);
router.patch('/ods/:id/decision', protect, allowRoles('club_coordinator'), decideOD);
router.post('/:eventId/mark', protect, allowRoles('president', 'vice_president'), markAttendance);
router.get('/student/:studentId/od', protect, getStudentOD);
router.get('/:eventId', protect, getAttendance);
module.exports = router;
