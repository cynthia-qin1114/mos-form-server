/**
 * MoleculeOS Pioneer Partner Form - Backend Server
 * Serves the form HTML and handles submissions via Feishu API
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
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

    // Test Bitable connectivity (primary method)
    let bitableInfo = null;
    try {
      // Try listing records (limit 1) to verify bitable access
      const listRes = await fetch(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${process.env.BITABLE_APP_TOKEN}/tables/${process.env.BITABLE_TABLE_ID}/records?page_size=1`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const listData = await listRes.json();
      if (listData.code === 0) {
        bitableInfo = {
          status: 'ok',
          appToken: process.env.BITABLE_APP_TOKEN,
          tableId: process.env.BITABLE_TABLE_ID,
          totalRecords: listData.data.total || 0,
          message: 'Bitable 连接正常'
        };
      } else {
        bitableInfo = { status: 'failed', error: listData.msg };
      }
    } catch (e) {
      bitableInfo = { status: 'failed', error: e.message };
    }

    res.json({
      success: true,
      token: 'obtained',
      bitable: bitableInfo,
      webhook: process.env.FEISHU_WEBHOOK_URL ? 'configured' : 'not configured',
      notifyOpenId: process.env.FEISHU_NOTIFY_OPEN_ID ? 'configured' : 'not configured'
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
