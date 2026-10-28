const express = require('express');
const router = express.Router();
const {
  proposeBudget,
  listBudgets,
  decideBudget,
  submitBill,
  decideBill
} = require('../controllers/budgetController');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

router.post('/', protect, allowRoles('president', 'vice_president'), proposeBudget);
router.get('/', protect, listBudgets);
router.patch('/:id/decision', protect, allowRoles('club_coordinator'), decideBudget);
router.post('/:id/bills', protect, allowRoles('president', 'vice_president'), submitBill);
router.patch(
  '/:id/bills/:billId/decision',
  protect,
  allowRoles('club_coordinator'),
  decideBill
);

module.exports = router;
