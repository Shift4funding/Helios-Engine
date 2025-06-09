const express = require('express');
const multer = require('multer');

// Create test app
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Basic middleware
app.use(express.json());

// Mock analysis endpoint
app.post('/api/analysis/statement', 
    upload.single('bankStatement'),
    (req, res) => {
        res.json({
            success: true,
            data: {
                summary: 'Test analysis',
                pages: 1,
                transactions: []
            }
        });
    }
);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

module.exports = app;