// _worker.js - 完整版（AI 代理 + 账户注销）
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ===== 1. AI API 代理 =====
    if (url.pathname === '/api') {
      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
      }

      try {
        const requestBody = await request.json();
        const API_KEY = env.BAILIAN_API_KEY;
        const BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

        const response = await fetch(`${BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
          },
          body: JSON.stringify({
            model: requestBody.model || 'qwen-plus',
            messages: requestBody.messages || [],
            temperature: requestBody.temperature || 0.7,
            max_tokens: requestBody.max_tokens || 2000,
          }),
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: '代理请求失败：' + error.message }), {
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
        });
      }
    }

    // ===== 2. 账户注销 API =====
    if (url.pathname === '/api/delete-account' && request.method === 'POST') {
      try {
        const { userId, username, password } = await request.json();

        const SUPABASE_URL = env.SUPABASE_URL || 'https://vmvwlqoadwusvivqffjb.supabase.co';
        const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;

        // 2.1 验证密码
        const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
          },
          body: JSON.stringify({
            email: username + '@workbuddy.local',
            password: password,
          }),
        });

        if (!authResponse.ok) {
          return new Response(JSON.stringify({ error: '密码错误，请重新输入' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // 2.2 先删除 profiles 记录（级联删除所有业务数据）
        const deleteProfileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        });
        if (!deleteProfileRes.ok) {
          const errText = await deleteProfileRes.text();
          throw new Error(`删除用户资料失败 (HTTP ${deleteProfileRes.status}): ${errText}`);
        }

        // 2.3 删除 Auth 用户
        const deleteAuthRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        });
        if (!deleteAuthRes.ok) {
          const errText = await deleteAuthRes.text();
          throw new Error(`删除 Auth 用户失败 (HTTP ${deleteAuthRes.status}): ${errText}`);
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // ===== 3. 静态文件托管 =====
    return env.ASSETS.fetch(request);
  }
};