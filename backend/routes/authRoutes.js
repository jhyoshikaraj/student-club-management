const express = require('express');
const router = express.Router();
const { register, login, me, directory, accountDirectory, bulkCreate, assignMentees, updateAccount, deleteAccount } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, me);
router.get('/directory', protect, directory);
router.get('/accounts', protect, accountDirectory);
router.post('/bulk-create', protect, bulkCreate);
router.post('/assign-mentees', protect, assignMentees);
router.patch('/accounts/:id/mentor', protect, require('../controllers/authController').setAccountMentor);
router.patch('/accounts/:id', protect, updateAccount);
router.delete('/accounts/:id', protect, deleteAccount);

module.exports = router;
