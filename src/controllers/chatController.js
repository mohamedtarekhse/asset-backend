const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const askAssistant = async (req, res) => {
  const { message, model, systemPrompt, temperature } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, message: 'message is required.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      success: false,
      message: 'OPENAI_API_KEY is not configured on the server.',
    });
  }

  try {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: typeof temperature === 'number' ? temperature : 0.2,
        messages: [
          {
            role: 'system',
            content:
              systemPrompt ||
              'You are an ERP assistant. Provide concise, practical answers for operations, finance, procurement, and asset workflows.',
          },
          {
            role: 'user',
            content: message.trim(),
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: data?.error?.message || 'OpenAI request failed.',
      });
    }

    return res.json({
      success: true,
      model: data.model,
      response: data.choices?.[0]?.message?.content || '',
      usage: data.usage || null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to contact OpenAI.',
    });
  }
};

module.exports = { askAssistant };
