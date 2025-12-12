import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { item_name, description } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    if (!apiKey) {
      console.error('Missing GEMINI_API_KEY')
      throw new Error('Missing GEMINI_API_KEY')
    }

    if (!description && !item_name) {
      throw new Error('Missing item description')
    }

    console.log(`Estimating item: ${item_name || ''} ${description || ''}`)

    const prompt = `
      You are an expert construction estimator specialized in the New York City market. 
      Your goal is to provide accurate *Unit Prices* for construction line items, accounting for the high cost of labor, logistics, and union requirements in NYC.

      Item: "${item_name || ''} ${description || ''}"

      CRITICAL PRICING RULES:
      1. **Renovation & Demolition:** Scan the description for keywords like "Remove", "Replace", "Demo", "Strip", or "Disconnect".
         - If found, you MUST include labor costs for: 
           a) Demolition/Removal
           b) Surface Preparation (e.g., scraping glue, patching holes)
           c) Disposal/Carting fees
         - *Note: "Remove and Replace" is significantly more expensive than new installation.*
      
      2. **Labor Rates:** Use NYC Union / Prevailing Wage rates. Assume labor is the dominant cost factor.
      
      3. **Material:** Use current market pricing for materials delivered to NYC.

      Return ONLY a raw JSON object (no markdown, no backticks) with this structure:
      {
        "material_cost": number, // Price per unit
        "labor_cost": number,    // Price per unit (include demo/prep here if applicable)
        "confidence_score": number, // 0-100 (100 = very standard item, 0 = unknown)
        "reasoning": string      // Explain your logic. Explicitly state if you included demo/prep costs.
      }
    `

    // Using modern Gemini 2.x and 3.x models (1.5 is deprecated)
    const modelsToTry = [
      'gemini-3-pro',           // Primary: Highest Accuracy for Pricing
      'gemini-2.5-flash',       // Backup: Fast & Balanced
      'gemini-2.5-flash-lite',  // Backup: Fastest
      'gemini-2.0-flash'        // Backup: Legacy Next-Gen
    ]
    
    let data = null
    let lastError = null

    for (const modelName of modelsToTry) {
      try {
        console.log(`Trying model: ${modelName}`)
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              // REMOVED generationConfig to fix "Invalid JSON payload" error on v1 endpoint
              safetySettings: [
                {
                  category: "HARM_CATEGORY_HARASSMENT",
                  threshold: "BLOCK_NONE",
                },
                {
                  category: "HARM_CATEGORY_HATE_SPEECH",
                  threshold: "BLOCK_NONE",
                },
                {
                  category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                  threshold: "BLOCK_NONE",
                },
                {
                  category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                  threshold: "BLOCK_NONE",
                },
              ],
            }),
          }
        )

        data = await response.json()

        if (data.error) {
          // If it's a "model not found" error, try next model
          if (data.error.message && (data.error.message.includes('not found') || data.error.code === 404)) {
            console.log(`Model ${modelName} not found, trying next...`)
            lastError = data.error
            continue
          }
          // Otherwise, it's a different error - throw it
          console.error(`Gemini API Returned Error with ${modelName}:`, data.error)
          throw new Error(`Gemini API Error: ${data.error.message}`)
        }

        // Success! Break out of loop
        console.log(`Successfully using model: ${modelName}`)
        break
      } catch (err) {
        lastError = err
        // If this is the last model, throw the error
        if (modelName === modelsToTry[modelsToTry.length - 1]) {
          throw err
        }
        // Otherwise, try next model
        console.log(`Error with ${modelName}, trying next model...`)
        continue
      }
    }

    if (!data || data.error) {
      console.error('All models failed. Last error:', lastError)
      throw new Error(`Gemini API Error: ${lastError?.message || 'All models failed'}`)
    }

    if (!data.candidates || data.candidates.length === 0) {
      console.error('Gemini API Error - Raw Response:', JSON.stringify(data))
      // Check for safety ratings blocking the response
      if (data.promptFeedback?.blockReason) {
         throw new Error(`AI blocked request: ${data.promptFeedback.blockReason}`)
      }
      throw new Error('AI returned no results. Check logs for details.')
    }

    const textResponse = data.candidates[0].content.parts[0].text
    console.log('Gemini Raw Text:', textResponse)

    // Parse JSON response (handles both JSON mode and text responses)
    let result
    try {
      // Try parsing directly first
      result = JSON.parse(textResponse)
    } catch (e) {
      // If direct parse fails, clean up markdown formatting and try again
      // Aggressive cleanup: remove markdown blocks AND any leading/trailing text
      const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
      } else {
           // Fallback to basic cleanup if regex match fails
           const jsonStr = textResponse.replace(/```json/g, '').replace(/```/g, '').trim()
           result = JSON.parse(jsonStr)
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Edge Function Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
