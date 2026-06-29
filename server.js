/**
 * MoleculeOS Pioneer Partner Form - Backend Server
 * Serves the form HTML and handles submissions via Feishu API
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const feishu = require('./feishu-api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// Static Files - Serve the form
// ==========================================
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// API: Form Submission
// ==========================================
app.post('/api/submit', async (req, res) => {
  try {
    const formData = {
      name: req.body.name || '',
      phone: req.body.phone || '',
      email: req.body.email || '',
      company: req.body.company || '',
      department: req.body.department || '',
      usedAiPlatform: req.body.usedAiPlatform || '',
      aiTools: req.body.aiTools || ''
    };

    // Basic validation
    if (!formData.name || !formData.phone || !formData.email || !formData.company || !formData.usedAiPlatform) {
      return res.status(400).json({
        success: false,
        message: '请填写所有必填字段'
      });
    }

    console.log('[Server] Form submission received:', formData);

    // Write to Feishu + Send notification
    const results = await feishu.submitFormData(formData);

    res.json({
      success: true,
      message: '提交成功'
    });

  } catch (err) {
    console.error('[Server] Submission error:', err.message);
    res.status(500).json({
      success: false,
      message: '提交失败，请稍后重试',
      error: err.message
    });
  }
});

// ==========================================
// API: Test Feishu connection (for debugging)
// ==========================================
app.get('/api/test-feishu', async (req, res) => {
  try {
    const token = await feishu.getTenantAccessToken();
    
    // Try to detect spreadsheet structure
    let sheetInfo = null;
    let bitableInfo = null;
    
    try {
      const sheetId = await feishu.detectSheetId(token);
      sheetInfo = { sheetId, status: 'ok' };
    } catch (e) {
      sheetInfo = { status: 'failed', error: e.message };
    }

    try {
      const tableId = await feishu.detectTableId(token);
      const fields = await feishu.listBitableFields(token, tableId);
      bitableInfo = {
        tableId,
        fields: fields.map(f => ({ name: f.field_name, type: f.type, id: f.field_id })),
        status: 'ok'
      };
    } catch (e) {
      bitableInfo = { status: 'failed', error: e.message };
    }

    res.json({
      success: true,
      token: 'obtained',
      spreadsheet: sheetInfo,
      bitable: bitableInfo,
      webhook: process.env.FEISHU_WEBHOOK_URL ? 'configured' : 'not configured'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ==========================================
// Health check
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    feishu: {
      appId: process.env.FEISHU_APP_ID ? 'configured' : 'not configured',
      appSecret: process.env.FEISHU_APP_SECRET ? 'configured' : 'not configured',
      webhook: process.env.FEISHU_WEBHOOK_URL ? 'configured' : 'not configured'
    },
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// Start Server
// ==========================================
app.listen(PORT, () => {
  console.log(`[Server] MoleculeOS Form Server running on port ${PORT}`);
  console.log(`[Server] Feishu App ID: ${process.env.FEISHU_APP_ID || 'NOT CONFIGURED'}`);
  console.log(`[Server] Feishu Webhook: ${process.env.FEISHU_WEBHOOK_URL || 'NOT CONFIGURED'}`);
});
