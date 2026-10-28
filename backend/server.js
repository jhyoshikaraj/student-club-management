require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const clubRoutes = require('./routes/clubRoutes');
const eventRoutes = require('./routes/eventRoutes');
const venueRoutes = require('./routes/venueRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const mentorRoutes = require('./routes/mentorRoutes');
const joiningRoutes = require('./routes/joiningRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const messageRoutes = require('./routes/messageRoutes');

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'Club Management System API' }));

app.use('/api/auth', authRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/mentors', mentorRoutes);
app.use('/api/joining-requests', joiningRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);

const path = require('path');
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));
app.get('/', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(frontendPath, 'pages', 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(frontendPath, 'pages', 'dashboard.html')));

// 404 handler
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Generic error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
