
// Supabase Edge Function for Gemini AI chat with streaming
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:streamGenerateContent";

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
        JSON.stringify({ error: "API key not configured" }),
        { 
          status: 500, 
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

    // Set up streaming response
    const responseInit = {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    };

    // Create a TransformStream for handling the streaming response
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    // Start a background task to fetch from Gemini and write to our stream
    const fetchAndStreamResponse = async () => {
      try {
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

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Gemini API error (${response.status}): ${errorText}`);
          
          // Send error to client
          writer.write(encoder.encode(`event: error\ndata: ${JSON.stringify({ 
            error: `Gemini API error: ${response.status} - ${errorText}` 
          })}\n\n`));
          writer.close();
          return;
        }

        // Process the streaming response
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Response body is null");
        }

        let decoder = new TextDecoder();
        let isFirstChunk = true;
        let tokensProcessed = 0;

        // Start reading chunks
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          console.log("Raw chunk from Gemini:", chunk.substring(0, 100));
          
          const lines = chunk.split("\n");
          
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.substring(6);
              
              // Check if it's the "[DONE]" message
              if (data.trim() === "[DONE]") continue;
              
              try {
                const parsedData = JSON.parse(data);
                console.log("Parsed data:", JSON.stringify(parsedData).substring(0, 100));
                
                // Extract text from Gemini's response
                if (parsedData.candidates && 
                    parsedData.candidates[0] && 
                    parsedData.candidates[0].content && 
                    parsedData.candidates[0].content.parts && 
                    parsedData.candidates[0].content.parts[0] && 
                    parsedData.candidates[0].content.parts[0].text) {
                  
                  const text = parsedData.candidates[0].content.parts[0].text;
                  console.log("Extracted text:", text.substring(0, 50));
                  
                  // For the first chunk, send model info
                  if (isFirstChunk) {
                    writer.write(encoder.encode(`event: start\ndata: ${JSON.stringify({ 
                      model: "gemini-1.5-pro" 
                    })}\n\n`));
                    isFirstChunk = false;
                  }
                  
                  // Send the text chunk to the client
                  writer.write(encoder.encode(`event: chunk\ndata: ${JSON.stringify({ 
                    content: text 
                  })}\n\n`));
                  
                  // Estimate tokens (rough approximation)
                  tokensProcessed += Math.ceil(text.length / 4);
                } else {
                  console.log("No text content found in response");
                }
              } catch (e) {
                console.error("Error parsing JSON from Gemini:", e);
                console.error("Problematic data:", data);
              }
            }
          }
        }
        
        // Estimate total tokens and cost
        const inputTokens = Math.ceil(JSON.stringify(messages).length / 4);
        const outputTokens = tokensProcessed;
        const totalTokens = inputTokens + outputTokens;
        
        // Gemini Pro pricing (approximate as of implementation time)
        // $0.0010 per 1K input tokens, $0.0020 per 1K output tokens
        const inputCost = (inputTokens / 1000) * 0.0010;
        const outputCost = (outputTokens / 1000) * 0.0020;
        const totalCost = inputCost + outputCost;
        
        // Send the completion event
        writer.write(encoder.encode(`event: done\ndata: ${JSON.stringify({ 
          model: "gemini-1.5-pro",
          tokens: totalTokens,
          cost: totalCost 
        })}\n\n`));
        
        console.log(`Completed response for session ${session_id}: ${totalTokens} tokens, $${totalCost.toFixed(6)} cost`);
      } catch (error) {
        console.error("Error in Gemini streaming:", error);
        writer.write(encoder.encode(`event: error\ndata: ${JSON.stringify({ 
          error: error.message 
        })}\n\n`));
      } finally {
        writer.close();
      }
    };

    // Start the background task without blocking the response
    fetchAndStreamResponse();

    // Return the stream to the client
    return new Response(stream.readable, responseInit);
  } catch (error) {
    console.error("General error in chat-with-gemini function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
