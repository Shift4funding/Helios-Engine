const express = require('express');
const router = express.Router();
const zohoService = require('../services/zohoService');
const { param, body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');

/**
 * @route POST /api/zoho/sync/analysis/:analysisId
 * @desc Sync analysis results to Zoho CRM
 * @access Private
 */
router.post('/sync/analysis/:analysisId', [
    auth,
    param('analysisId').isMongoId().withMessage('Invalid analysis ID'),
    validateRequest
], async (req, res) => {
    try {
        const { analysisId } = req.params;
        
        // Fetch analysis data from the database
        const Analysis = require('../models/Analysis');
        const analysis = await Analysis.findById(analysisId);
        
        if (!analysis) {
            return res.status(404).json({ success: false, message: 'Analysis not found' });
        }
        
        // Sync the analysis data to Zoho
        const result = await zohoService.syncTransactionsToZoho(analysis);
        
        // Update the analysis record to indicate it's been synced to Zoho
        analysis.integrations = analysis.integrations || {};
        analysis.integrations.zoho = {
            synced: true,
            syncedAt: new Date(),
            recordCount: result.recordCount
        };
        await analysis.save();
        
        return res.status(200).json({
            success: true,
            message: 'Data successfully synced to Zoho CRM',
            result
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to sync data to Zoho CRM',
            error: error.message
        });
    }
});

/**
 * @route POST /api/zoho/setup
 * @desc Configure Zoho CRM integration settings
 * @access Private
 */
router.post('/setup', [
    auth,
    body('authToken').notEmpty().withMessage('Zoho auth token is required'),
    body('crmUrl').isURL().withMessage('Valid Zoho CRM URL is required'),
    body('fieldMappings').optional().isObject().withMessage('Field mappings must be an object'),
    validateRequest
], async (req, res) => {
    try {
        const { authToken, crmUrl, fieldMappings } = req.body;
        
        // Store these settings in environment variables or a secure configuration store
        // For demo purposes, we're just returning success, but in production you'd want to:
        // 1. Store these securely
        // 2. Validate the credentials with Zoho before accepting them
        
        // Here we would typically update process.env.ZOHO_AUTH_TOKEN and process.env.ZOHO_CRM_URL
        // But environment variables can't be changed at runtime in a safe way
        // In a real app, you'd use a secure configuration store
        
        return res.status(200).json({
            success: true,
            message: 'Zoho CRM integration configured successfully',
            settings: {
                crmUrl,
                fieldMappings: fieldMappings || {}
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to configure Zoho CRM integration',
            error: error.message
        });
    }
});

/**
 * @route GET /api/zoho/status
 * @desc Check Zoho CRM integration status
 * @access Private
 */
router.get('/status', auth, async (req, res) => {
    try {
        // Check if Zoho credentials are configured
        const isConfigured = process.env.ZOHO_AUTH_TOKEN && process.env.ZOHO_CRM_URL;
        
        if (!isConfigured) {
            return res.status(200).json({
                success: true,
                status: 'not_configured',
                message: 'Zoho CRM integration is not configured'
            });
        }
        
        // In a real application, you would validate the token here
        // by making a test call to the Zoho API
        
        return res.status(200).json({
            success: true,
            status: 'configured',
            message: 'Zoho CRM integration is configured and ready to use',
            crmUrl: process.env.ZOHO_CRM_URL
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to check Zoho CRM integration status',
            error: error.message
        });
    }
});

module.exports = router;
