const mongoose = require('mongoose');
const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true, trim: true },
  body: { type: String, required: true, trim: true },
  threadId: { type: mongoose.Schema.Types.ObjectId, default: null },
  readAt: { type: Date, default: null }
}, { timestamps: true });
module.exports = mongoose.model('Message', messageSchema);
