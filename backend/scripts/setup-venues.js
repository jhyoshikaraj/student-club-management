require('dotenv').config();
const mongoose = require('mongoose');
const Venue = require('../models/Venue');

function buildInventory() {
  const venues = [];
  for (const building of ['AB-1', 'AB-2']) {
    for (const floor of [0,1,2,3,4]) {
      for (let room=1; room<=33; room++) {
        const roomNo = floor===0 ? `G${String(room).padStart(2,'0')}` : `${floor}${String(room).padStart(2,'0')}`;
        venues.push({ name: `${building} ${roomNo}`, location: `${building}, ${floor===0?'Ground Floor':`${floor}${floor===1?'st':floor===2?'nd':floor===3?'rd':'th'} Floor`}`, capacity: 40 });
      }
    }
  }
  for (let room=1; room<=33; room++) {
    const roomNo = `G${String(room).padStart(2,'0')}`;
    venues.push({ name: `CB ${roomNo}`, location: `CB, Ground Floor`, capacity: 40 });
  }
  venues.push(
    { name:'Einstein Hall', location:'AB-1', capacity:180 },
    { name:'Newton Hall', location:'AB-1', capacity:180 },
    { name:'Auditorium', location:'AB-2', capacity:500 },
    { name:'Amphitheatre', location:'AB-2', capacity:350 },
    { name:'SAC Ground Floor', location:'SAC, Ground Floor', capacity:0 },
    { name:'SAC 2nd Floor', location:'SAC, 2nd Floor', capacity:0 }
  );
  return venues;
}
async function run() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing in .env');
  await mongoose.connect(process.env.MONGO_URI);
  const venues = buildInventory();
  let created=0, existing=0;
  for (const v of venues) {
    const result = await Venue.updateOne({ name:v.name, location:v.location }, { $setOnInsert:v }, { upsert:true });
    if (result.upsertedCount) created++; else existing++;
  }
  console.log(`Venue inventory complete. Added ${created}; already existed ${existing}; total definitions ${venues.length}. Existing venues were not deleted.`);
  await mongoose.disconnect();
}
run().catch(async e=>{ console.error(e); try{await mongoose.disconnect()}catch{} process.exit(1); });
