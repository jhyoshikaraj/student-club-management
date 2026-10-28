const express = require('express');
const router = express.Router();
const {
  listVenues,
  createVenue,
  pendingRequests,
  decideVenueRequest
} = require('../controllers/venueController');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

router.get('/', protect, listVenues);
router.post('/', protect, allowRoles('venue_admin'), createVenue);
router.get('/requests/pending', protect, allowRoles('venue_admin'), pendingRequests);
router.patch(
  '/:eventId/decision',
  protect,
  allowRoles('venue_admin'),
  decideVenueRequest
);

module.exports = router;
