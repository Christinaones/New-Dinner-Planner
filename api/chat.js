export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { prompt, maxTokens } = req.body
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: '请配置 ANTHROPIC_API_KEY 环境变量' })
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
        max_tokens: maxTokens || 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!response.ok) return res.status(response.status).json({ error: await response.text() })
    const data = await response.json()
    const text = data.content?.map(i => i.text || '').join('') || ''
    return res.status(200).json({ text })
  } catch (err) {
    return res.status(500).json({ error: '服务器错误，请重试' })
  }
}
