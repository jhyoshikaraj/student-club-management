require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
async function run() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing in .env');
  await mongoose.connect(process.env.MONGO_URI);
  let coordinator = await User.findOne({ role:'club_coordinator' });
  if (!coordinator) {
    coordinator = await User.create({ name:'Club Coordinator', email:'clubcoordinator@college.edu', password:'Pass@123', role:'club_coordinator' });
    console.log('Created clubcoordinator@college.edu with temporary password Pass@123');
  } else console.log(`Club Coordinator already exists: ${coordinator.email}`);
  console.log('No existing users, clubs, events, or venues were deleted.');
  await mongoose.disconnect();
}
run().catch(async e=>{console.error(e);try{await mongoose.disconnect()}catch{}process.exit(1)});
