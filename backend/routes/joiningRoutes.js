const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { submitRequest, myRequests, myClubs, pendingRequests, decideRequest } = require('../controllers/joiningController');

router.get('/my', protect, allowRoles('student'), myRequests);
router.get('/my-clubs', protect, allowRoles('student'), myClubs);
router.get('/pending', protect, allowRoles('president'), pendingRequests);
router.post('/club/:clubId', protect, allowRoles('student'), submitRequest);
router.patch('/:id/decision', protect, allowRoles('president'), decideRequest);

module.exports = router;
