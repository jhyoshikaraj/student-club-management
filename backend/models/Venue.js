const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    location: { type: String, default: '' },
    capacity: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Venue', venueSchema);
