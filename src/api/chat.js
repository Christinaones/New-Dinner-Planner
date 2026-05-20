// api/chat.js
// Vercel 后端中转 —— 使用 DeepSeek API，国内无需 VPN
// 部署后在 Vercel 后台 Settings → Environment Variables 添加：
//   DEEPSEEK_API_KEY = 你的 DeepSeek API Key

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { prompt, maxTokens } = req.body
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' })

  if (!process.env.DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: '请在 Vercel 后台配置 DEEPSEEK_API_KEY 环境变量' })
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: maxTokens || 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return res.status(response.status).json({ error: errText })
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''
    return res.status(200).json({ text })

  } catch (err) {
    console.error('DeepSeek API error:', err)
    return res.status(500).json({ error: '服务器内部错误，请重试' })
  }
}
