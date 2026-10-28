require('dotenv').config();
const readline = require('readline/promises');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Event = require('../models/Event');
const Budget = require('../models/Budget');
const Attendance = require('../models/Attendance');

async function run() {
  await connectDB();
  const matches = await Event.find({ title: { $regex: /codeathon/i } }).select('_id title date status');
  if (!matches.length) {
    console.log('No event with "Codeathon" in its title was found. No records were deleted.');
    await mongoose.disconnect();
    return;
  }
  console.log('The following events match "Codeathon":');
  matches.forEach((event, i) => console.log(`${i + 1}. ${event.title} | ${event.date?.toISOString?.() || 'no date'} | ${event.status} | ID ${event._id}`));
  console.log('Only these events and their linked budget/attendance records can be deleted by this script.');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const confirmation = await rl.question('Type DELETE CODEATHON to confirm, or anything else to cancel: ');
  rl.close();
  if (confirmation.trim() !== 'DELETE CODEATHON') {
    console.log('Cancelled. No records were deleted.');
    await mongoose.disconnect();
    return;
  }
  const ids = matches.map(e => e._id);
  const [budgets, attendance] = await Promise.all([
    Budget.deleteMany({ event: { $in: ids } }),
    Attendance.deleteMany({ event: { $in: ids } })
  ]);
  const deletedEvents = await Event.deleteMany({ _id: { $in: ids } });
  console.log(`Deleted ${deletedEvents.deletedCount} Codeathon event(s), ${budgets.deletedCount} linked budget record(s), and ${attendance.deletedCount} linked attendance record(s). Other clubs, events, users, and venues were not changed.`);
  await mongoose.disconnect();
}
run().catch(async err => {
  console.error('Codeathon cleanup failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
