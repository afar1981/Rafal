export async function POST(request) {
  try {
    const { name_pl, description_pl } = await request.json()

    if (!name_pl && !description_pl) {
      return Response.json(
        { error: 'Brak tekstu do tłumaczenia.' },
        { status: 400 }
      )
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        input: [
          {
            role: 'system',
            content:
              'Translate Polish food product names and descriptions into natural, professional English suitable for a Polish food shop in the UK. Preserve the meaning. Do not add information that is not present in the Polish text. Return only valid JSON with keys name_en and description_en.'
          },
          {
            role: 'user',
            content: JSON.stringify({
              name_pl: name_pl || '',
              description_pl: description_pl || ''
            })
          }
        ]
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('OpenAI error:', data)

      return Response.json(
        { error: 'Błąd połączenia z usługą tłumaczenia.' },
        { status: 500 }
      )
    }

    const text = data.output_text

    const result = JSON.parse(text)

    return Response.json({
      name_en: result.name_en || '',
      description_en: result.description_en || ''
    })

  } catch (error) {
    console.error('Translation error:', error)

    return Response.json(
      { error: 'Nie udało się przetłumaczyć produktu.' },
      { status: 500 }
    )
  }
}
