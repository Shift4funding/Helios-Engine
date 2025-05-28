// This file configures the Express application, sets up middleware for parsing requests, and defines API routes.

const express = require('express');
const multer = require('multer');
const analysisRoutes = require('./routes/analysisRoutes');

const app = express();

// Middleware for parsing JSON requests
app.use(express.json());

// Middleware for handling file uploads
const upload = multer({ dest: 'uploads/' });
app.use(upload.single('bankStatement'));

// Define API routes
app.use('/api/analysis', analysisRoutes);

module.exports = app;