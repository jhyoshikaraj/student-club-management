require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Club = require('../models/Club');
const Venue = require('../models/Venue');

async function seed() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing in .env');
  await mongoose.connect(process.env.MONGO_URI);

  await Promise.all([User.deleteMany({}), Club.deleteMany({}), Venue.deleteMany({})]);

  const director = await User.create({ name: 'Dr. Ananya Rao', email: 'director@college.edu', password: 'Pass@123', role: 'director' });
  const coordinator = await User.create({ name: 'Prof. Kavya Menon', email: 'coordinator@college.edu', password: 'Pass@123', role: 'faculty_coordinator' });
  const venueAdmin = await User.create({ name: 'Prof. Arun Kumar', email: 'venue@college.edu', password: 'Pass@123', role: 'venue_admin' });
  const mentor = await User.create({ name: 'Prof. Meera Shah', email: 'mentor@college.edu', password: 'Pass@123', role: 'faculty_mentor' });
  const president = await User.create({ name: 'Rahul Sharma', email: 'president@college.edu', password: 'Pass@123', role: 'president', position: 'President' });
  const vp = await User.create({ name: 'Priya Nair', email: 'vp@college.edu', password: 'Pass@123', role: 'vice_president', position: 'Vice President' });
  const student = await User.create({ name: 'Aarav Patel', email: 'student@college.edu', password: 'Pass@123', role: 'student', position: 'Member' });

  const club = await Club.create({ name: 'Coding Club', description: 'A student community for programming, hackathons and technical workshops.' });
  const secondClub = await Club.create({ name: 'Innovation Club', description: 'Build, prototype and present creative technology ideas.' });

  club.president = president._id; club.vicePresident = vp._id; club.facultyCoordinator = coordinator._id; club.members = [president._id, vp._id, student._id]; await club.save();
  secondClub.facultyCoordinator = coordinator._id; await secondClub.save();

  await User.findByIdAndUpdate(coordinator._id, { coordinatedClubs: [club._id, secondClub._id] });
  await User.findByIdAndUpdate(president._id, { club: club._id });
  await User.findByIdAndUpdate(vp._id, { club: club._id });
  await User.findByIdAndUpdate(student._id, { club: club._id });
  await User.findByIdAndUpdate(mentor._id, { mentees: [student._id] });

  await Venue.insertMany([
    { name: 'Main Auditorium', location: 'Block A', capacity: 500 },
    { name: 'Seminar Hall 1', location: 'Block B, First Floor', capacity: 120 },
    { name: 'Innovation Lab', location: 'Tech Block', capacity: 60 }
  ]);

  console.log('\nSeed complete. Demo password for all users: Pass@123\n');
  console.log('director@college.edu');
  console.log('coordinator@college.edu');
  console.log('venue@college.edu');
  console.log('mentor@college.edu');
  console.log('president@college.edu');
  console.log('vp@college.edu');
  console.log('student@college.edu');
  await mongoose.disconnect();
}

seed().catch(async (err) => { console.error(err); try { await mongoose.disconnect(); } catch {} process.exit(1); });
