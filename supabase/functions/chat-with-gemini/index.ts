
// Supabase Edge Function for Gemini AI chat with streaming
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
// Updated to use Gemini 2.0 Flash
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash:streamGenerateContent";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, user_id, session_id } = await req.json();
    
    // Log the incoming request for debugging
    console.log(`Processing request for session ${session_id} from user ${user_id}`);
    console.log(`Number of messages in context: ${messages.length}`);
    
    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not set");
      return new Response(
        JSON.stringify({ data: { error: "API key not configured", content: "Error: API key not configured" } }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Transform messages to Gemini format
    const geminiMessages = messages.map(msg => {
      return {
        role: msg.sender === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      };
    });

    console.log("Prepared Gemini messages:", JSON.stringify(geminiMessages).substring(0, 200));

    // Prepare request body for Gemini API
    const requestBody = {
      contents: geminiMessages,
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 2048,
      },
    };

    // Get the full URL with API key
    const url = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
    console.log(`Calling Gemini API at ${GEMINI_API_URL}`);

    // Make the request to Gemini
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`Gemini API response status: ${response.status}`);

    // Check if there was an error
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error (${response.status}): ${errorText}`);
      
      return new Response(
        JSON.stringify({ 
          data: { 
            error: `Gemini API error: ${response.status}`, 
            content: `Error: Gemini API returned status ${response.status}. Please try again later.` 
          } 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Process the non-streaming response
    const responseData = await response.json();
    console.log("Gemini response data:", JSON.stringify(responseData).substring(0, 500));

    // Extract the response content
    let content = "";
    let tokensUsed = 0;

    if (responseData.candidates && 
        responseData.candidates[0] && 
        responseData.candidates[0].content && 
        responseData.candidates[0].content.parts && 
        responseData.candidates[0].content.parts[0] && 
        responseData.candidates[0].content.parts[0].text) {
      
      content = responseData.candidates[0].content.parts[0].text;
      // Rough estimation of token count
      tokensUsed = Math.ceil(content.length / 4);
    } else {
      console.error("No valid content found in Gemini response");
      content = "Error: Failed to extract content from Gemini response.";
    }

    // Estimate total tokens and cost
    const inputTokens = Math.ceil(JSON.stringify(messages).length / 4);
    const outputTokens = tokensUsed;
    const totalTokens = inputTokens + outputTokens;
    
    // Gemini pricing (approximate as of implementation time)
    // $0.0010 per 1K input tokens, $0.0020 per 1K output tokens
    const inputCost = (inputTokens / 1000) * 0.0005; // Adjust rates for Gemini Flash
    const outputCost = (outputTokens / 1000) * 0.0010;
    const totalCost = inputCost + outputCost;
    
    console.log(`Completed response for session ${session_id}: ${totalTokens} tokens, $${totalCost.toFixed(6)} cost`);

    // Return the processed response
    return new Response(
      JSON.stringify({
        data: {
          content: content,
          tokens: totalTokens,
          cost: totalCost,
          model: "gemini-flash"
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error("General error in chat-with-gemini function:", error);
    return new Response(
      JSON.stringify({ 
        data: { 
          error: error.message, 
          content: `Error: ${error.message}` 
        } 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
