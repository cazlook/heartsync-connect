require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const logger = require('./utils/logger');

const authRoutes = require('./auth/auth.routes');
const usersRoutes = require('./users/users.routes');
const biometricsRoutes = require('./biometrics/biometrics.routes');
const matchingRoutes = require('./matching/matching.routes');
const debugRoutes = require('./debug/debug.routes');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS || '*' }));
app.use(express.json({ limit: '10kb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests' }
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/biometrics', biometricsRoutes);
app.use('/api/matching', matchingRoutes);
app.use('/api/debug', debugRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', version: '2.0.0' }));

// Global error handler
app.use((err, req, res, next) => {
  logger.error({ message: err.message, stack: err.stack, path: req.path });
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// DB + start
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/heartsync_v2';

mongoose.connect(MONGO_URI)
  .then(() => {
    logger.info('MongoDB connected');
    app.listen(PORT, () => logger.info(`HeartsSync v2 running on port ${PORT}`));
  })
  .catch(err => {
    logger.error('MongoDB connection failed: ' + err.message);
    process.exit(1);
  });

module.exports = app;
