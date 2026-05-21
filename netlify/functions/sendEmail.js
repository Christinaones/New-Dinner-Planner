exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }
  const { subject, text } = JSON.parse(event.body || '{}')
  if (!process.env.RESEND_API_KEY) return { statusCode: 500, body: JSON.stringify({ error: '请配置 RESEND_API_KEY' }) }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: '63290739@qq.com',
        subject: subject || '本周晚餐菜单',
        text: text || '',
      }),
    })
    const data = await response.json()
    if (data.error) throw new Error(data.error.message)
    return { statusCode: 200, body: JSON.stringify({ ok: true }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
