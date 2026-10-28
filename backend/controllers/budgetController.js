const Budget = require('../models/Budget');
const Club = require('../models/Club');
const { isClubLeader } = require('../middleware/roles');

// @route POST /api/budgets
// President/VP propose a budget for their own event/club
exports.proposeBudget = async (req, res) => {
  try {
    const { event, club, proposedAmount, justification } = req.body;

    if (!isClubLeader(req.user, club)) {
      return res.status(403).json({ message: 'Only the President/VP of this club can propose a budget' });
    }

    const budget = await Budget.create({
      event,
      club,
      proposedBy: req.user._id,
      proposedAmount,
      justification
    });

    return res.status(201).json(budget);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route GET /api/budgets  (director's queue, or filter by club)
exports.listBudgets = async (req, res) => {
  if (!['president','vice_president','club_coordinator'].includes(req.user.role)) return res.status(403).json({ message: 'Budgets are available only to club leaders and the Club Coordinator' });
  const filter = {};
  if (['president','vice_president'].includes(req.user.role)) filter.club = req.user.club;
  if (req.query.club && req.user.role === 'club_coordinator') filter.club = req.query.club;
  if (req.query.status) filter.status = req.query.status;

  const budgets = await Budget.find(filter)
    .populate('club', 'name accountBalance')
    .populate('proposedBy', 'name role')
    .populate('event', 'title date');
  return res.json(budgets);
};

// @route PATCH /api/budgets/:id/decision
// body: { decision: 'approved'|'rejected', note }
// Allowed for: director (designated approver) OR the club's faculty_coordinator (override)
exports.decideBudget = async (req, res) => {
  try {
    const { decision, note } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ message: 'decision must be approved or rejected' });
    }

    const budget = await Budget.findById(req.params.id);
    if (!budget) return res.status(404).json({ message: 'Budget not found' });

    const isClubCoordinator = req.user.role === 'club_coordinator';

    if (!isClubCoordinator) {
      return res.status(403).json({ message: 'Not authorized to decide on this budget' });
    }

    budget.status = decision;
    budget.decisionNote = note || '';
    budget.decisionBy = req.user._id;


    await budget.save();
    return res.json(budget);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route POST /api/budgets/:id/bills
// President/VP submit a bill against an APPROVED budget
exports.submitBill = async (req, res) => {
  try {
    const { description, amount, receiptUrl } = req.body;
    const budget = await Budget.findById(req.params.id);
    if (!budget) return res.status(404).json({ message: 'Budget not found' });

    if (budget.status !== 'approved') {
      return res.status(400).json({ message: 'Bills can only be submitted against an approved budget' });
    }
    if (!isClubLeader(req.user, budget.club)) {
      return res.status(403).json({ message: 'Only the President/VP can submit bills' });
    }

    budget.bills.push({ description, amount, receiptUrl });
    await budget.save();
    return res.status(201).json(budget);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// @route PATCH /api/budgets/:id/bills/:billId/decision
// body: { decision: 'approved'|'rejected' }
// Director approves the bill -> money is released into the club's account balance.
// Faculty coordinator can override this decision too.
exports.decideBill = async (req, res) => {
  try {
    const { decision } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ message: 'decision must be approved or rejected' });
    }

    const budget = await Budget.findById(req.params.id);
    if (!budget) return res.status(404).json({ message: 'Budget not found' });

    const bill = budget.bills.id(req.params.billId);
    if (!bill) return res.status(404).json({ message: 'Bill not found' });

    const isClubCoordinator = req.user.role === 'club_coordinator';

    if (!isClubCoordinator) {
      return res.status(403).json({ message: 'Not authorized to decide on this bill' });
    }

    bill.status = decision;
    bill.decisionBy = req.user._id;


    if (decision === 'approved' && !bill.releasedToAccount) {
      bill.releasedToAccount = true;
      await Club.findByIdAndUpdate(budget.club, { $inc: { accountBalance: bill.amount } });
    }

    await budget.save();
    return res.json(budget);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
