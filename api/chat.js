// api/chat.js
// Vercel 后端中转函数 —— 保护 API Key，不暴露给前端
// 部署后需要在 Vercel 后台 Settings → Environment Variables 添加：
//   ANTHROPIC_API_KEY = 你的 API Key

export default async function handler(req, res) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { prompt, maxTokens } = req.body

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' })
  }

  // 检查 API Key 是否已配置
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: '请在 Vercel 后台配置 ANTHROPIC_API_KEY 环境变量'
    })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens || 6000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return res.status(response.status).json({ error: errText })
    }

    const data = await response.json()
    const text = data.content?.map(i => i.text || '').join('') || ''
    return res.status(200).json({ text })

  } catch (err) {
    console.error('API error:', err)
    return res.status(500).json({ error: '服务器内部错误，请重试' })
  }
}
