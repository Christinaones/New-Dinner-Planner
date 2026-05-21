exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }
  const { prompt, maxTokens } = JSON.parse(event.body || '{}')
  if (!prompt) return { statusCode: 400, body: JSON.stringify({ error: 'Missing prompt' }) }
  if (!process.env.DEEPSEEK_API_KEY) return { statusCode: 500, body: JSON.stringify({ error: '请配置 DEEPSEEK_API_KEY' }) }
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: maxTokens || 5000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''
    return { statusCode: 200, body: JSON.stringify({ text }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: '服务器错误，请重试' }) }
  }
}
