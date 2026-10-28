require('dotenv').config();
const mongoose = require('mongoose');
const Club = require('../models/Club');
const ClubJoining = require('../models/ClubJoining');
const ClubJoiningRequest = require('../models/ClubJoiningRequest');
const Event = require('../models/Event');
const Budget = require('../models/Budget');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
(async()=>{
 try { if(!process.env.MONGO_URI) throw new Error('MONGO_URI is missing from .env'); await mongoose.connect(process.env.MONGO_URI);
 const clubs=await Club.find({name:/innovation/i});
 if(!clubs.length){console.log('No Innovation club found.');return;}
 console.log('Matching clubs:'); clubs.forEach(c=>console.log(`${c.name} (${c._id})`));
 if(process.argv.includes('--confirm')) { const ids=clubs.map(c=>c._id); const events=await Event.find({club:{$in:ids}}).select('_id'); const eventIds=events.map(e=>e._id); await Promise.all([ClubJoining.deleteMany({club:{$in:ids}}),ClubJoiningRequest.deleteMany({club:{$in:ids}}),Attendance.deleteMany({event:{$in:eventIds}}),Budget.deleteMany({$or:[{club:{$in:ids}},{event:{$in:eventIds}}]}),Event.deleteMany({_id:{$in:eventIds}}),User.updateMany({club:{$in:ids}},{$set:{club:null,position:''}}),User.updateMany({coordinatedClubs:{$in:ids}},{$pull:{coordinatedClubs:{$in:ids}}}),Club.deleteMany({_id:{$in:ids}})]); console.log('Innovation club and linked membership, request, and event records deleted.'); } else console.log('Dry run only. To confirm deletion, run: npm run remove:innovation-club -- --confirm');
 } catch(e){console.error(e.message);process.exitCode=1;} finally {await mongoose.disconnect().catch(()=>{});} })();
