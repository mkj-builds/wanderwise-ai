/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export async function getAirports(country: string): Promise<string[]> {
  const model = 'gemini-3-flash-preview';
  const prompt = `List the top 3 to 5 major international airports in ${country}. Return only the airport names.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error('Error fetching airports:', error);
    throw new Error('Failed to fetch airports. Please try again.');
  }
}

export interface RoutePoint {
  name: string;
  lat: number;
  lng: number;
  type: 'start' | 'stop' | 'end';
}

export async function generateItinerary(
  country: string, 
  airport: string, 
  numberOfDays: number, 
  maxTravelTime: string,
  transportMode: string,
  accommodationType: string,
  publicTransportOption?: string,
  arrivalDate?: string,
  isWholeCountryTour?: boolean,
  sleeperTrainOption?: 'none' | 'always' | 'wherever_possible',
  includeEtiquette?: boolean,
  startDay: number = 1,
  endDay: number = 10,
  previousItinerary?: string
): Promise<{ itinerary: string; imageUrlLocation: string; route: RoutePoint[] }> {
  const model = 'gemini-3-flash-preview';
  
  let transportContext = '';
  if (transportMode === 'car') {
    transportContext = `The user prefers to rent a car for the entire trip. 
    Include a dedicated section with essential information for tourists: 
    - Car rental tips and best practices for this destination.
    - Key road rules (e.g., side of the road, speed limits, unique local signs).
    - Toll systems and how to pay them (e.g., vignettes, electronic tags).
    - License requirements (e.g., if an International Driving Permit is required).
    - Parking tips in major cities.`;
  } else {
    transportContext = `The user prefers public transport. Specifically: ${publicTransportOption}. 
    Suggest tourist-accessible passes (like the Deutschland Ticket in Germany or JR Pass in Japan) if they exist for the destination. 
    Recommend individual tickets if a pass isn't worth it. 
    Suggest Uber or local ride-sharing where it is more practical than public transport for tourists.
    **CRITICAL:** If you recommend the Eurail pass or Interrail pass, you MUST include a good, detailed section on how to go about booking it properly. Explicitly explain how to avoid scammy reservation online fee tourist traps (like third-party booking sites that charge extra). Wherever possible, make sure to recommend exactly the way the locals use their pass or book reservations (e.g., booking directly through the national railway carrier's website or app).`;
  }

  let sleeperTrainContext = '';
  if (sleeperTrainOption === 'always') {
    sleeperTrainContext = `\n    **CRITICAL TRANSPORT REQUIREMENT:** The user has selected "No Limit" for pace and explicitly requested to ALWAYS use overnight/sleeper trains for long-distance travel. You MUST include sleeper train journeys in the itinerary wherever geographically feasible between distant cities. For each sleeper train, explicitly state the departure city and arrival city in the results section. Provide detailed instructions on how to book and use the sleeper train tickets, what to expect on board (e.g., couchette vs. sleeper cabin), and how to navigate the stations.`;
  } else if (sleeperTrainOption === 'wherever_possible') {
    sleeperTrainContext = `\n    **CRITICAL TRANSPORT REQUIREMENT:** The user has selected "No Limit" for pace and requested to use overnight/sleeper trains WHEREVER POSSIBLE for long-distance travel. Include sleeper train journeys in the itinerary when it makes logical sense for the route. For any recommended sleeper train, explicitly state the departure city and arrival city in the results section. Provide detailed instructions on how to book and use the sleeper train tickets, what to expect on board (e.g., couchette vs. sleeper cabin), and how to navigate the stations.`;
  }

  const dateContext = arrivalDate 
    ? `The trip starts on ${arrivalDate}. Please label each day with the specific date (e.g., "Day 1: Monday, June 12, 2024").` 
    : '';

  let googleHotelsSearchTerm = accommodationType;
  if (accommodationType === 'Budget-Friendly') {
    googleHotelsSearchTerm = 'cheap';
  } else if (accommodationType === 'Luxury') {
    googleHotelsSearchTerm = 'luxury';
  } else if (accommodationType === 'Boutique & Unique') {
    googleHotelsSearchTerm = 'boutique';
  } else if (accommodationType === 'Family-Friendly') {
    googleHotelsSearchTerm = 'family';
  }

  let concisenessInstruction = `CRITICAL: You are generating a 10-day block of the itinerary. You MUST provide detailed instructions for each day. Focus heavily on moving around, especially train numbers, connections, and enjoying the place/experience to its fullest. Provide the same high level of detail for every single day in this block. HOWEVER, YOU MUST BE CONCISE ENOUGH TO FIT ALL 10 DAYS WITHIN THE OUTPUT LIMIT. DO NOT WRITE OVERLY LONG PARAGRAPHS. USE BULLET POINTS.`;

  const chunkContext = startDay > 1 
    ? `\n\n**CRITICAL INSTRUCTION:** You are generating PART ${Math.ceil(startDay/10)} of a ${numberOfDays}-day itinerary. You MUST ONLY generate the detailed daily plan for **Day ${startDay} through Day ${endDay}**. Do NOT generate days before Day ${startDay} or after Day ${endDay}. \n\nHere is the itinerary generated so far for context:\n\n${previousItinerary}\n\nNow, continue the itinerary starting exactly at Day ${startDay}. YOU MUST REACH DAY ${endDay} BEFORE STOPPING.`
    : `**CRUCIAL: GENERATE A DETAILED DAILY PLAN FOR EXACTLY DAY ${startDay} THROUGH DAY ${endDay} OUT OF A TOTAL ${numberOfDays} DAYS. YOU MUST OUTPUT DAY ${startDay} THROUGH DAY ${endDay}. DO NOT STOP EARLY. DO NOT SKIP ANY DAYS OR PROVIDE INCOMPLETE PLANS.**`;

  const prompt = `${chunkContext}

    Plan a perfect ${numberOfDays}-day holiday itinerary for ${country}, starting and ending at ${airport}. 
    ${isWholeCountryTour ? `**CRITICAL REQUIREMENT:** This is a WHOLE COUNTRY TOUR. You MUST include at least one place in ALL states or provinces of ${country} for the user to visit throughout the ${numberOfDays} days.` : `Plan direct travel routes for ${numberOfDays} days from this airport to explore the best places to see.`}
    Constraint: The maximum travel time between locations on any given day should be approximately ${maxTravelTime}. 
    Transport Preference: ${transportContext} ${sleeperTrainContext}
    Accommodation Preference: For EACH destination/city where the user stays overnight, select ONE specific example hotel that aligns with the user's preference for '${accommodationType}'. 
    IMPORTANT: You MUST place the hotel recommendation at the bottom of the "Evening" section for that day. Do NOT use a repetitive tagline like "A curated selection for your stay."

    Example Day Structure:
    ## Day X: [City Name], [Date (if arrivalDate provided)]
    ### Morning
    - [Activity 1]
    - [Activity 2]
    ### Afternoon
    - [Activity 3]
    - [Activity 4]
    ### Evening
    - [Activity 5]
    
    **Accommodation:** [[Hotel Name]](https://www.google.com/travel/search?q=[Hotel+Name]+[City]+[Country]) | [Explore More ${accommodationType} Hotels](https://www.google.com/travel/search?q=${googleHotelsSearchTerm}+hotels+in+[City]+[Country])

    Crucial:
    1. For the Google Hotels links, construct the URL exactly like this: https://www.google.com/travel/search?q=hotel+name+city+country (replace spaces with + or %20, and CRITICALLY, you MUST URL-encode ampersands as %26 INSIDE THE URL ONLY, e.g., "B&B" becomes "B%26B" in the link). DO NOT use %26 in the visible text of the itinerary; always display the normal "&" character to the user.
    2. Use the \`googleSearch\` tool to find a specific, real Komoot "discover" URL for the exact landmark, park, or trail you are recommending. For example, search for "site:komoot.com/discover [Landmark Name] [City]".
    3. **CRITICAL KOMOOT LINK RULES:**
       - NEVER use individual user-created tour links (e.g., URLs starting with https://www.komoot.com/tour/...). These can be deleted by users.
       - You MUST use "discover" links. Ideally, find a specific highlight link like this: https://www.komoot.com/discover/View_of_Nice_and_Villefranche-sur-Mer_from_Fort_du_Mont_Boron/@43.6899270,7.3016570/tours?sport=hike&map=true&toursThroughHighlight=4359857&max_distance=30000&pageNumber=1
       - If you cannot find a specific highlight link, you MUST explicitly fallback to this exact format for the city walking tours: https://www.komoot.com/discover/[City_Name]/@[Lat],[Lon]/tours?sport=hike&map=true&max_distance=5000&pageNumber=1 (You must look up the exact Latitude and Longitude for the city).
       - **VERIFICATION REQUIRED:** You MUST confirm that the city coordinates are correct and exactly match the itinerary city place name for the Komoot tour. You MUST also confirm that the Komoot link will not show a "No content found" error message. You must explicitly ensure the tour exists and is visible to the user when the link is clicked on.
    4. **MANDATORY:** You MUST include exactly ONE Komoot tour link EVERY SINGLE DAY. Do NOT show the raw URL. Display it as a nice text link, for example: [Walking Tour on Komoot](https://www.komoot.com/discover/...) or [Hiking Trail on Komoot](https://www.komoot.com/discover/...). Place this link naturally within the Morning or Afternoon activities.
    5. **PROPER NAMES FORMATTING:** In the results text, you MUST use black bold text for proper names like buildings, castles, districts, villages, arenas, palaces, train stations, meals, towers, etc. (for example, **Duomo di Milano**). You MUST also add a hyperlink to a Wikipedia article for each of these proper names so the user can click or hover to see it. Format it as a markdown link with bold text, like this: \`[**Duomo di Milano**](https://en.wikipedia.org/wiki/Milan_Cathedral)\`.

    ${dateContext}
    Include details on travel between locations and suggest activities. 
    ${includeEtiquette && startDay === 1 ? `\n    **CULTURAL INSIGHTS:** For each new destination/city in the itinerary, add a small section titled 'Local Etiquette & Customs'. Include a few key points about social norms, greetings, dress codes, and tipping practices that tourists should be aware of.` : ''}
    
    **CRITICAL LENGTH INSTRUCTION:** ${concisenessInstruction} You MUST dynamically adjust the amount of detail you provide per day so that you NEVER run out of output tokens before reaching Day ${endDay}. It is completely unacceptable to stop at Day ${endDay - 1} or earlier.
    
    Important: Do NOT use LaTeX notation (like $\rightarrow$) for arrows or routes. Use standard text or simple characters like "to" or "→".
    Format the entire output as markdown. Also, identify one prominent city or landmark from the itinerary that would make a great banner image and return it as 'imageUrlLocation'.
    Finally, extract the main cities/towns visited in order to create a 'route' array. Each item should have 'name' (city name), 'lat' (latitude), 'lng' (longitude), and 'type' (either 'start', 'stop', or 'end').

    The final response MUST be a JSON object with three properties: 'route' (array of objects with name, lat, lng, type), 'imageUrlLocation' (string, containing the prominent city or landmark), and 'itinerary' (string, containing the full markdown itinerary).
    `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        maxOutputTokens: 8192,
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            itinerary: { type: Type.STRING },
            imageUrlLocation: { type: Type.STRING },
            route: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  lat: { type: Type.NUMBER },
                  lng: { type: Type.NUMBER },
                  type: { type: Type.STRING }
                },
                required: ['name', 'lat', 'lng', 'type']
              }
            }
          },
          required: ['itinerary', 'imageUrlLocation', 'route'],
        },
      },
    });
    
    let responseText = response.text || '{}';
    let parsedResponse: any = {};
    
    try {
      // Clean up potential markdown code blocks
      const cleanText = responseText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
      parsedResponse = JSON.parse(cleanText);
    } catch (parseError) {
      console.warn('JSON parsing failed, attempting to fix truncated JSON...', parseError);
      
      // Try to extract itinerary using a more forgiving regex
      const itineraryMatch = responseText.match(/["']?itinerary["']?\s*:\s*["']?([\s\S]*)/i);
      if (itineraryMatch) {
        let extracted = itineraryMatch[1];
        
        // If there are other keys after itinerary, cut them off
        const nextKeyMatch = extracted.match(/["']\s*,\s*["'][a-zA-Z0-9_]+["']\s*:/);
        if (nextKeyMatch) {
          extracted = extracted.substring(0, nextKeyMatch.index);
        } else {
          // Truncated, remove trailing JSON artifacts
          extracted = extracted.replace(/["}\s\]]+$/, '');
        }
        
        parsedResponse.itinerary = extracted.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }

      // Try to extract route
      const routeMatch = responseText.match(/["']?route["']?\s*:\s*(\[[\s\S]*?\])/i);
      if (routeMatch) {
        try {
          parsedResponse.route = JSON.parse(routeMatch[1]);
        } catch (e) {}
      }

      // Try to extract imageUrlLocation
      const imageMatch = responseText.match(/["']?imageUrlLocation["']?\s*:\s*["']([^"']*)["']/i);
      if (imageMatch) {
        parsedResponse.imageUrlLocation = imageMatch[1];
      }

      if (!parsedResponse.itinerary) {
         // If we STILL don't have an itinerary, maybe the model just output plain text markdown?
         if (/day/i.test(responseText) || responseText.length > 100) {
             let text = responseText;
             // Clean up potential markdown code blocks
             text = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
             // Clean up trailing json artifacts
             text = text.replace(/["}\s\]]+$/, '');
             // Unescape if it looks like it has escaped newlines
             if (text.includes('\\n')) {
                 text = text.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
             }
             
             // If the text looks like a JSON string (starts with { and has route), it means it got truncated before itinerary
             if (text.startsWith('{') && text.includes('"route"')) {
                 throw new Error('Failed to parse the generated itinerary. The AI response was incomplete or malformed. Please try again.');
             }
             
             parsedResponse.itinerary = text;
         } else {
             throw new Error('Failed to parse the generated itinerary. The AI response was incomplete or malformed. Please try again.');
         }
      }
    }

    if (typeof parsedResponse.itinerary !== 'string') {
      if (Array.isArray(parsedResponse.itinerary)) {
        parsedResponse.itinerary = parsedResponse.itinerary.join('\n\n');
      } else if (typeof parsedResponse.itinerary === 'object' && parsedResponse.itinerary !== null) {
        parsedResponse.itinerary = Object.values(parsedResponse.itinerary).join('\n\n');
      } else {
        parsedResponse.itinerary = String(parsedResponse.itinerary || '');
      }
    }

    let finalItinerary = parsedResponse.itinerary || '';
    
    // Fix instances where the AI put %26 in the visible text
    // 1. Replace all %26 with & globally to fix the visible text
    finalItinerary = finalItinerary.replace(/%26/g, '&');
    // 2. Re-encode & to %26 ONLY inside the q= parameter of Google Hotels links
    finalItinerary = finalItinerary.replace(/(https:\/\/www\.google\.com\/travel\/search\?q=)([^)\s]+)/g, (match, p1, p2) => {
      return p1 + p2.replace(/&/g, '%26');
    });

    return { 
      itinerary: finalItinerary, 
      imageUrlLocation: parsedResponse.imageUrlLocation || country,
      route: parsedResponse.route || [],
    };
  } catch (error: any) {
    console.error('Error generating itinerary:', error);
    if (error.message && error.message.includes('Failed to parse')) {
      throw error;
    }
    throw new Error('Failed to generate itinerary. Please try again.');
  }
}
