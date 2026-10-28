const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { listMessages, sendMessage, readMessage } = require('../controllers/messageController');
router.use(protect);
router.get('/', listMessages);
router.post('/', sendMessage);
router.patch('/:id/read', readMessage);
module.exports = router;
