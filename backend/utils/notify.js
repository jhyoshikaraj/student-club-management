const Notification = require('../models/Notification');

async function createNotification(recipient, title, message, type = 'general') {
  if (!recipient) return null;
  return Notification.create({ recipient, title, message, type });
}

async function createNotifications(recipients, title, message, type = 'general') {
  const ids = [...new Set((recipients || []).filter(Boolean).map(String))];
  if (!ids.length) return [];
  return Notification.insertMany(ids.map((recipient) => ({ recipient, title, message, type })));
}

module.exports = { createNotification, createNotifications };
