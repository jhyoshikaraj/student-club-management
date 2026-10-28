require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
async function run() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing in .env');
  const email = String(process.env.SYSTEM_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.SYSTEM_ADMIN_PASSWORD || '');
  const name = String(process.env.SYSTEM_ADMIN_NAME || 'System Account Administrator').trim();
  if (!email || !password || password.length < 10) throw new Error('Set SYSTEM_ADMIN_EMAIL and a SYSTEM_ADMIN_PASSWORD of at least 10 characters in backend/.env before running setup:admin.');
  await mongoose.connect(process.env.MONGO_URI);
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== 'system_admin') throw new Error(`The email ${email} already exists with role ${existing.role}; choose a different SYSTEM_ADMIN_EMAIL.`);
    console.log(`System account administrator already exists: ${email}`);
  } else {
    await User.create({ name, email, password, role: 'system_admin' });
    console.log(`Created system account administrator: ${email}`);
  }
  console.log('No existing users, clubs, events, or venues were deleted.');
  await mongoose.disconnect();
}
run().catch(async e => { console.error(e.message); try { await mongoose.disconnect(); } catch {} process.exit(1); });
