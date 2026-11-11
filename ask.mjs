export default async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST to ask a question.' }), {
      status: 405, headers: { 'Content-Type': 'application/json', 'Allow': 'POST' }
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'The assistant is not configured yet. Please try again later.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message || message.length > 1000) {
      return Response.json({ error: 'Please enter a question of 1–1000 characters.' }, { status: 400 });
    }

    const suppliedHistory = Array.isArray(body.history) ? body.history.slice(-10) : [];
    const contents = [];
    for (const item of suppliedHistory) {
      if (item && (item.role === 'user' || item.role === 'model') && typeof item.text === 'string') {
        contents.push({ role: item.role, parts: [{ text: item.text.slice(0, 2000) }] });
      }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'You are Trendora, a friendly, clear educational assistant. Help with AI tools, technology, digital skills, study skills, and online safety. Use simple language and practical explanations. Be respectful and age-appropriate. Do not request passwords, API keys, private contact details, or other sensitive information. Do not provide dangerous instructions. For medical, legal, or financial decisions, give general information only and encourage asking a qualified trusted adult or professional. If unsure, say so.' }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 700 },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
        ]
      })
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('Gemini API returned status:', response.status);
      return Response.json({ error: 'The AI service could not answer right now. Check the API setup in Netlify or try again later.' }, { status: 502 });
    }
    const reply = result.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
    if (!reply) return Response.json({ error: 'The AI service did not return a text answer. Please try another question.' }, { status: 502 });
    return Response.json({ reply });
  } catch (error) {
    console.error('Trendora assistant error:', error);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
};
