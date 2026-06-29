/**
 * Feishu API Integration Module
 * - Get tenant_access_token
 * - Write records to Feishu Bitable (多维表格) - PRIMARY method
 * - Write records to Feishu Spreadsheet (电子表格) - FALLBACK method
 * - Send IM direct message notification to Cynthia
 * - Send webhook notification to Feishu group (optional)
 */

const fetch = require('node-fetch');

// ==========================================
// Configuration
// ==========================================
const FEISHU_APP_ID = process.env.FEISHU_APP_ID || '';
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || '';
const FEISHU_WEBHOOK_URL = process.env.FEISHU_WEBHOOK_URL || '';
const FEISHU_NOTIFY_OPEN_ID = process.env.FEISHU_NOTIFY_OPEN_ID || '';

// Bitable config (app-owned, fully accessible)
const BITABLE_APP_TOKEN = process.env.BITABLE_APP_TOKEN || '';
const BITABLE_TABLE_ID = process.env.BITABLE_TABLE_ID || '';

// Spreadsheet config (fallback - requires doc permission)
const SPREADSHEET_APP_TOKEN = process.env.SPREADSHEET_APP_TOKEN || '';
const SPREADSHEET_SHEET_ID = process.env.SPREADSHEET_SHEET_ID || '';

// ==========================================
// Token Management
// ==========================================
let tokenCache = { token: null, expiresAt: 0 };

async function getTenantAccessToken() {
  if (tokenCache.token && tokenCache.expiresAt > Date.now() / 1000 + 60) {
    return tokenCache.token;
  }

  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
    throw new Error('Feishu App ID or App Secret not configured');
  }

  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET })
  });

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`Failed to get tenant_access_token: ${data.msg}`);
  }

  tokenCache = { token: data.tenant_access_token, expiresAt: data.expire };
  console.log('[Feishu] Got tenant_access_token');
  return data.tenant_access_token;
}

// ==========================================
// Bitable Operations (PRIMARY)
// ==========================================

async function insertBitableRecord(formData) {
  const token = await getTenantAccessToken();
  const appToken = BITABLE_APP_TOKEN;
  const tableId = BITABLE_TABLE_ID;

  if (!appToken || !tableId) {
    throw new Error('Bitable app_token or table_id not configured');
  }

  const fields = {
    '提交时间': new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    '姓名': formData.name,
    '电话': formData.phone,
    '邮箱': formData.email,
    '公司/机构': formData.company,
    '所属部门': formData.department,
    '是否使用过AI平台': formData.usedAiPlatform,
    '常用AI工具': formData.aiTools || ''
  };

  const res = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: Buffer.from(JSON.stringify({ fields }), 'utf-8')
    }
  );

  const data = await res.json();
  if (data.code !== 0) {
    console.error('[Feishu] Bitable write failed:', data);
    throw new Error(`Bitable write failed: ${data.msg}`);
  }

  console.log('[Feishu] Bitable record inserted successfully');
  return data;
}

// ==========================================
// Spreadsheet Operations (FALLBACK)
// ==========================================

async function insertSpreadsheetRow(formData) {
  const token = await getTenantAccessToken();

  if (!SPREADSHEET_APP_TOKEN) {
    throw new Error('Spreadsheet app_token not configured');
  }

  // Detect sheet_id if not set
  let sheetId = SPREADSHEET_SHEET_ID;
  if (!sheetId) {
    const sheetRes = await fetch(
      `https://open.feishu.cn/open-apis/sheet/v3/spreadsheets/${SPREADSHEET_APP_TOKEN}/sheets/query`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const sheetData = await sheetRes.json();
    if (sheetData.code !== 0) {
      throw new Error(`Failed to query sheets: ${sheetData.msg}`);
    }
    sheetId = sheetData.data.sheets[0].sheet_id;
  }

  const values = [
    [new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })],
    [formData.name],
    [formData.phone],
    [formData.email],
    [formData.company],
    [formData.department],
    [formData.usedAiPlatform],
    [formData.aiTools || '']
  ];

  const res = await fetch(
    `https://open.feishu.cn/open-apis/sheet/v2/spreadsheets/${SPREADSHEET_APP_TOKEN}/values`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: Buffer.from(JSON.stringify({
        valueRange: { range: `${sheetId}!A1:H1`, values }
      }), 'utf-8')
    }
  );

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`Spreadsheet write failed: ${data.msg}`);
  }

  console.log('[Feishu] Spreadsheet row inserted successfully');
  return data;
}

// ==========================================
// IM Direct Message Notification
// ==========================================

async function sendImNotification(formData) {
  if (!FEISHU_NOTIFY_OPEN_ID) {
    console.warn('[Feishu] No open_id configured for IM notification, skipping');
    return null;
  }

  const token = await getTenantAccessToken();

  // Build rich card message
  const message = {
    receive_id: FEISHU_NOTIFY_OPEN_ID,
    msg_type: 'interactive',
    content: JSON.stringify({
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: '🆕 MoleculeOS表单新提交' },
        template: 'purple'
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: [
              `**姓名**：${formData.name}`,
              `**电话**：${formData.phone}`,
              `**邮箱**：${formData.email}`,
              `**公司/机构**：${formData.company}`,
              `**所属部门**：${formData.department}`,
              `**是否使用过AI平台**：${formData.usedAiPlatform}`,
              formData.aiTools ? `**常用AI工具**：${formData.aiTools}` : '',
              `**提交时间**：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
            ].filter(Boolean).join('\n')
          }
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '查看多维表格' },
              type: 'primary',
              url: `https://zibmvy2yng.feishu.cn/base/${BITABLE_APP_TOKEN}`
            }
          ]
        }
      ]
    })
  };

  const res = await fetch(
    'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id',
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: Buffer.from(JSON.stringify(message), 'utf-8')
    }
  );

  const data = await res.json();
  if (data.code !== 0) {
    console.error('[Feishu] IM notification failed:', data);
    // Don't throw - notification failure shouldn't block submission
  } else {
    console.log('[Feishu] IM notification sent successfully');
  }
  return data;
}

// ==========================================
// Webhook Notification (optional, group bot)
// ==========================================

async function sendWebhookNotification(formData) {
  if (!FEISHU_WEBHOOK_URL) {
    console.warn('[Feishu] Webhook URL not configured, skipping');
    return null;
  }

  const message = {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: '🆕 MoleculeOS表单新提交' },
        template: 'purple'
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: [
              `**姓名**：${formData.name}`,
              `**电话**：${formData.phone}`,
              `**邮箱**：${formData.email}`,
              `**公司/机构**：${formData.company}`,
              `**所属部门**：${formData.department}`,
              `**是否使用过AI平台**：${formData.usedAiPlatform}`,
              formData.aiTools ? `**常用AI工具**：${formData.aiTools}` : '',
              `**提交时间**：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
            ].filter(Boolean).join('\n')
          }
        }
      ]
    }
  };

  const res = await fetch(FEISHU_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: Buffer.from(JSON.stringify(message), 'utf-8')
  });

  const data = await res.json();
  if (data.code !== 0) {
    console.error('[Feishu] Webhook notification failed:', data);
  } else {
    console.log('[Feishu] Webhook notification sent successfully');
  }
  return data;
}

// ==========================================
// Main: Write data + Notify
// ==========================================

async function submitFormData(formData) {
  const results = { bitable: null, spreadsheet: null, im: null, webhook: null };

  // Primary: Write to Bitable
  try {
    results.bitable = await insertBitableRecord(formData);
  } catch (bitableErr) {
    console.warn('[Feishu] Bitable write failed, trying spreadsheet:', bitableErr.message);
    // Fallback: Try Spreadsheet
    try {
      results.spreadsheet = await insertSpreadsheetRow(formData);
    } catch (sheetErr) {
      console.error('[Feishu] Both bitable and spreadsheet write failed');
      throw new Error(`Data write failed: ${bitableErr.message}`);
    }
  }

  // Send IM direct message notification
  try {
    results.im = await sendImNotification(formData);
  } catch (err) {
    console.warn('[Feishu] IM notification failed:', err.message);
  }

  // Send webhook notification (if configured)
  try {
    results.webhook = await sendWebhookNotification(formData);
  } catch (err) {
    console.warn('[Feishu] Webhook notification failed:', err.message);
  }

  return results;
}

module.exports = {
  getTenantAccessToken,
  submitFormData,
  insertBitableRecord,
  insertSpreadsheetRow,
  sendImNotification,
  sendWebhookNotification
};
