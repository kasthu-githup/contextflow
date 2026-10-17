import { GoogleGenAI } from '@google/genai';
import { BrandVoice } from './db';

// Lazy-initialize GoogleGenAI client with standard User-Agent
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Sleep helper with jitter
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Check if error is transient (e.g. 503 unavailable, high demand, 429 rate limit, network reset)
function isTransientError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || error.toString() || '').toLowerCase();
  const status = error.status || error.code || error.error?.code;

  return (
    status === 503 ||
    status === 429 ||
    status === 500 ||
    status === 'UNAVAILABLE' ||
    status === 'RESOURCE_EXHAUSTED' ||
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('spikes in demand') ||
    msg.includes('rate limit') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('overloaded') ||
    msg.includes('try again later') ||
    msg.includes('econnreset') ||
    msg.includes('fetch failed')
  );
}

// Map of model cooldowns (e.g. when 429 daily quota limit is hit)
const modelCooldownMap = new Map<string, number>();

function isModelCooledDown(model: string): boolean {
  const cooldownUntil = modelCooldownMap.get(model);
  if (!cooldownUntil) return true;
  if (Date.now() > cooldownUntil) {
    modelCooldownMap.delete(model);
    return true;
  }
  return false;
}

function markModelExhausted(model: string, durationMs = 60 * 1000) {
  modelCooldownMap.set(model, Date.now() + durationMs);
}

// Resilient executor with exponential backoff and fallback model chaining
async function executeGeminiWithRetry<T>(
  operation: (model: string) => Promise<T>,
  preferredModel = 'gemini-3.1-flash-lite'
): Promise<T> {
  // Candidate models pool with diverse quota buckets
  const baseCandidates = [
    preferredModel,
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-3.7-flash'
  ];

  // Remove duplicates and prioritize models not currently on quota cooldown
  const uniqueCandidates = Array.from(new Set(baseCandidates));
  const availableCandidates = uniqueCandidates.filter(isModelCooledDown);
  const fallbackCandidates = uniqueCandidates.filter((m) => !isModelCooledDown(m));
  const modelsToTry = [...availableCandidates, ...fallbackCandidates];

  let lastError: any = null;

  for (let m = 0; m < modelsToTry.length; m++) {
    const currentModel = modelsToTry[m];
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation(currentModel);
        // Successful call - clear any cooldown for this model
        modelCooldownMap.delete(currentModel);
        return result;
      } catch (err: any) {
        lastError = err;
        const msg = (err?.message || err?.toString() || '').toLowerCase();
        const isQuota429 = msg.includes('quota') || msg.includes('429') || msg.includes('resource_exhausted');
        const isDailyQuota = msg.includes('perday') || msg.includes('limit: 20');
        const isDemand503 = msg.includes('503') || msg.includes('high demand') || msg.includes('unavailable');

        console.warn(`[Gemini API] Model ${currentModel} attempt ${attempt}/${maxRetries} failed:`, err?.message || err);

        if (!isTransientError(err)) {
          // Non-transient error (e.g. invalid parameter/config), throw immediately
          throw err;
        }

        // If rate limit / quota exceeded (429) for this specific model, mark cooldown & immediately switch
        if (isQuota429) {
          const cooldownDuration = isDailyQuota ? 30 * 60 * 1000 : 30 * 1000;
          markModelExhausted(currentModel, cooldownDuration);
          console.warn(`[Gemini API] Quota limit reached for ${currentModel}. Switching to next candidate model.`);
          break; // Break inner retry loop to try next model in candidates list
        }

        if (attempt < maxRetries) {
          const backoff = isDemand503 ? 1000 + Math.floor(Math.random() * 500) : 800;
          console.log(`[Gemini API] Waiting ${backoff}ms before retry on ${currentModel}...`);
          await delay(backoff);
        }
      }
    }

    console.warn(`[Gemini API] Model ${currentModel} exhausted or throttled. Moving to fallback candidate...`);
  }

  // All candidates and retries failed
  const parsedMsg = lastError?.message || lastError?.error?.message || 'AI service temporarily unavailable due to high demand. Please try again in a few moments.';
  throw new Error(parsedMsg);
}

export interface GenerateParams {
  topic: string;
  platform?: string;
  contentType?: string;
  language?: 'english' | 'tamil' | 'thanglish';
  tone?: string;
  targetAudience?: string;
  contentLength?: string;
  cta?: string;
  customCta?: string;
  style?: string;
  brandVoice?: BrandVoice | null;
  useBrandVoice?: boolean;
  context?: string;
  additionalContext?: string;
  keyPoints?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string;
  niche?: string;
}

export interface AIActionParams {
  content: string;
  action: 'improve' | 'viral' | 'shorten' | 'expand' | 'emotional' | 'professional' | 'conversational' | 'translate' | 'cta';
  targetLanguage?: 'english' | 'tamil' | 'thanglish';
  targetTone?: string;
  platform?: string;
}

// Multi-language system guidance
function getLanguageInstruction(language?: string): string {
  const lang = (language || 'english').toLowerCase().trim();
  switch (lang) {
    case 'tamil':
      return `CRITICAL LANGUAGE REQUIREMENT:
The user selected TAMIL (தமிழ்).
You MUST write all generated spoken scripts, dialogue, hooks, body text, points, captions, tips, and calls to action EXCLUSIVELY IN TAMIL SCRIPT (தமிழ் எழுத்துக்களில்).
DO NOT write the spoken dialogue or text in English.
Make it sound 100% natural, colloquial, modern, and engaging for Tamil social media audiences.
Example style:
"வணக்கம் நண்பர்களே! உங்கள் இன்ஸ்டாகிராம் ரீல்ஸ் வைரல் ஆக இந்த 3 சீக்ரெட் டிப்ஸ்களை இப்போதே பாருங்கள்..."`;

    case 'thanglish':
    case 'tanglish':
      return `CRITICAL LANGUAGE REQUIREMENT:
The user selected THANGLISH (Colloquial Tamil written using English/Latin alphabet).
You MUST write all generated spoken scripts, hooks, body copy, and captions in natural spoken THANGLISH.
DO NOT write standard English. Every hook and body sentence must be natural spoken Tamil typed using English letters.
Example style:
"Ungaloda Instagram reach adhigamaaga indha 3 simple tips kandippa follow pannunga! Daily customers attract panna idhu romba useful."`;

    case 'english':
    default:
      return `LANGUAGE: Modern, crisp, conversational American/International English. Highly engaging, active voice, zero robotic AI cliches.`;
  }
}

// Brand voice & permanent creator context formatting
function getBrandVoicePrompt(brandVoice?: BrandVoice | null, useBrandVoice?: boolean): string {
  if (!useBrandVoice || !brandVoice || !brandVoice.is_active) {
    return '';
  }

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERMANENT CREATOR CONTEXT & BRAND PERSONA (STRICT REQUIREMENT):
- Creator / Brand Name: ${brandVoice.brand_name}
- Core Business Context & Offer: ${brandVoice.business_description}
- Target Audience: ${brandVoice.target_audience}
- Preferred Tone: ${brandVoice.preferred_tone}
- Brand Personality: ${brandVoice.brand_personality}
- Call to Action Style: ${brandVoice.cta_style}
${brandVoice.words_to_use ? `- Words / Phrases to include: ${brandVoice.words_to_use}` : ''}
${brandVoice.words_to_avoid ? `- FORBIDDEN WORDS (NEVER USE): ${brandVoice.words_to_avoid}` : ''}
Strictly infuse this permanent creator context into every line of the output.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

export async function generateAIContent(params: GenerateParams): Promise<{
  content: string;
  title: string;
  meta: {
    estimated_duration?: string;
    word_count: number;
    char_count: number;
    tags?: string[];
  };
  structured_data?: any;
}> {
  const ai = getAiClient();
  const langPrompt = getLanguageInstruction(params.language);
  const brandPrompt = getBrandVoicePrompt(params.brandVoice, params.useBrandVoice);
  const resolvedCta = params.cta === 'Custom CTA' && params.customCta ? params.customCta : (params.cta || 'Relevant Call to Action');

  const langKey = (params.language || 'english').toLowerCase().trim();
  let langDirective = '';
  if (langKey === 'tamil') {
    langDirective = `\n\n🚨 STRICT MANDATORY LANGUAGE DIRECTIVE:
You MUST output the entire script/content in TAMIL SCRIPT (தமிழ் எழுத்துக்கள்).
Do NOT write the spoken dialogue, hooks, points, captions, or call-to-actions in English! All text to be read or spoken by the creator MUST be in Tamil.`;
  } else if (langKey === 'thanglish' || langKey === 'tanglish') {
    langDirective = `\n\n🚨 STRICT MANDATORY LANGUAGE DIRECTIVE:
You MUST output the entire script/content in THANGLISH (spoken Tamil written phonetically using English letters).
Do NOT write in pure English. The spoken sentences must be in colloquial Tamil spelled with English alphabet (e.g. "Ungaloda business reach increase panna indha tips follow pannunga").`;
  } else {
    langDirective = `\n\nLanguage: English (High-converting, natural, engaging)`;
  }

  // Build unified user context block
  const contextDetails = params.context || params.additionalContext || '';
  const keyPointsDetails = params.keyPoints || '';
  
  const userContextBlock = `
================ USER SPECIFIED CONTEXT & TOPIC ================
CORE TOPIC / TITLE: "${params.topic}"
${contextDetails ? `SPECIFIC CONTEXT & DETAILS TO COVER:\n"${contextDetails}"\n` : ''}${keyPointsDetails ? `KEY TALKING POINTS:\n"${keyPointsDetails}"\n` : ''}${params.targetAudience ? `TARGET AUDIENCE: ${params.targetAudience}\n` : ''}${params.niche ? `NICHE: ${params.niche}\n` : ''}${params.primaryKeyword ? `PRIMARY KEYWORD: ${params.primaryKeyword}\n` : ''}${params.secondaryKeywords ? `SECONDARY KEYWORDS: ${params.secondaryKeywords}\n` : ''}CALL TO ACTION: ${resolvedCta}
================================================================
`;

  let systemPrompt = `You are ContentFlow AI, an elite SaaS AI copywriter and content strategist trusted by top digital marketing agencies and viral social media creators.
Your task is to generate natural, high-converting, human-sounding content with zero fluff or robotic clichés.

${langPrompt}

🚨 PERMANENT MANDATORY CONTEXT FIDELITY DIRECTIVE:
1. STRICT SUBJECT & CONTEXT ADHERENCE:
   The user's input topic, details, scenario, product, service, target audience, and key points are the ABSOLUTE FOUNDATION of the generation.
   - You MUST tailor 100% of the content, dialogue, hooks, examples, explanations, and CTA directly to the user's provided context and topic.
   - NEVER generate generic, vague, or one-size-fits-all advice. Every single line must sound like an expert who deeply understands this specific topic/business.
   - If the user provided specific details (e.g., niche, location, price, product features, target customer, problem points), EVERY single detail MUST be accurately and naturally woven into the content.
   - If the input is in Tamil, Thanglish, or English, match the exact cultural, industry, and contextual nuances of that topic.
2. Never use generic AI filler like "In today's fast-paced digital world", "Are you ready to dive in?", or "Without further ado".
3. Prioritize hook power, crisp short sentences, strong emotional or logical hooks, concrete examples, and clear takeaways.
4. Keep sentences conversational and readable at standard speaking pace.
5. Integrate the requested platform dynamics (e.g., Instagram needs visual cues, LinkedIn needs crisp white-spaced lines, YouTube needs high-CTR curiosity).
6. Always generate all content strictly in the requested language: ${params.language || 'English'}.
${brandPrompt}`;

  let userPrompt = '';
  const contentType = (params.contentType || 'general').toLowerCase();

  if (contentType.includes('reel') || params.contentType === 'Reel Script') {
    userPrompt = `Generate a high-retention REEL / SHORT VIDEO SCRIPT strictly tailored to this exact topic and context:

${userContextBlock}
Target Platform: ${params.platform || 'Instagram'}
Tone: ${params.tone || 'Conversational'}
Style: ${params.style || 'Viral'}
Desired Duration: ${params.contentLength || '60 Seconds'}${langDirective}

MANDATORY INSTRUCTION:
The script MUST directly speak about the exact topic and context specified above. Do NOT make it generic. Every hook, talking point, and visual cue must specifically fit this topic.

Format the output strictly into three clear sections:

HOOK (0-3s):
[First 3 seconds: Must stop the scroll immediately with curiosity, shock, or relatable pain point. Include a brief camera/visual direction if helpful]

BODY:
[Short, punchy spoken sentences in the requested language. Pacing suitable for speaking out loud. Include natural transitions and 1-2 concrete takeaways]

CTA:
[Short, seamless call to action that makes commenting, saving, or following feel natural]

End with a summary line:
ESTIMATED_DURATION: [e.g., 45 Seconds]`;
  } else if (contentType === 'hook' || contentType === 'viral hook' || params.contentType === 'Viral Hook') {
    userPrompt = `Generate exactly 10 VIRAL HOOKS strictly tailored to this exact topic and context:

${userContextBlock}
Platform: ${params.platform || 'Instagram / LinkedIn / X'}
Tone: ${params.tone || 'Bold'}${langDirective}

MANDATORY CONTEXT REQUIREMENT:
Every single hook MUST directly mention, challenge, or spotlight the exact topic, product, service, or situation described above. ZERO generic filler templates.

Provide 10 hooks categorized across these 10 viral psychological angles (write each hook in the requested language):
1. [Curiosity]: Hook creating an irresistible knowledge gap about this exact topic
2. [Controversial]: Bold contrarian take challenging conventional wisdom on this topic
3. [Emotional]: Deep relatable human sentiment or fear of missing out on this topic
4. [Question]: Sharp question directly implicating the viewer's struggle with this topic
5. [Shock]: Eye-opening statement or unexpected reality regarding this topic
6. [Story]: Hook launching straight into a real-world scenario about this topic
7. [Problem]: Direct callout of a painful daily struggle related to this topic
8. [Statistics]: Compelling realistic number or ratio hook for this topic
9. [Mistake]: Hook identifying a costly mistake people make in this specific area
10. [You Are Doing This Wrong]: Direct behavioral challenge hook on this topic

Ensure each hook is punchy, memorable, and ready to use in ${params.language || 'English'}.`;
  } else if (contentType === 'caption' || params.contentType === 'Caption') {
    userPrompt = `Generate a complete high-converting CAPTION strictly tailored to this exact topic and context:

${userContextBlock}
Platform: ${params.platform || 'Instagram'}
Tone: ${params.tone || 'Conversational'}${langDirective}

MANDATORY CONTEXT REQUIREMENT:
The caption must be 100% focused on the specific context, product/service, and key points provided above.

Provide the following formatted sections:

SHORT CAPTION:
[A punchy 1-2 sentence version in the requested language with strong hook and immediate CTA]

LONG CAPTION:
[A deep, engaging storytelling/value-packed caption in the requested language with line breaks, bullet points, and high-retention flow]

CALL TO ACTION:
[Clear, low-friction action directive in the requested language matching the requested CTA]

HASHTAGS:
[15-20 handpicked, highly relevant niche and broad hashtags formatted with #]`;
  } else if (contentType === 'youtube' || contentType === 'youtube script' || params.contentType === 'YouTube Script' || params.contentType === 'YouTube') {
    userPrompt = `Create a complete YOUTUBE CONTENT SUITE strictly tailored to this exact video topic and context:

${userContextBlock}
Tone: ${params.tone || 'Educational & Engaging'}${langDirective}

Provide:
1. 5 HIGH-CTR TITLES (in the requested language, specifically naming the core subject, under 65 chars)
2. VIDEO DESCRIPTION (Hook opening, timestamps outline [0:00 Intro, 0:45 Key Concept, etc.], links, social channels)
3. TARGET KEYWORDS (List of 8-10 primary and secondary search keywords specific to this topic)
4. VIDEO TAGS (Comma-separated list of 15+ YouTube tags ready to paste into YouTube Studio)
5. PINNED COMMENT CTA (Engaging question and call to action to boost video ranking in the requested language)`;
  } else if (contentType === 'seo' || contentType === 'seo content' || params.contentType === 'SEO Content' || contentType === 'blog') {
    userPrompt = `Generate a high-ranking, human-written SEO ARTICLE & CONTENT OUTLINE strictly tailored to this exact topic and context:

${userContextBlock}
Desired Length: ${params.contentLength || 'Long (Comprehensive)'}${langDirective}

Generate the full comprehensive structured content in the requested language:
- SEO Meta Title (50-60 characters)
- SEO Meta Description (150-160 characters)
- H1: Compelling Main Headline
- Introduction: Pain point, hook, and what the reader will gain
- H2 & H3 Sub-headings: Well-structured, in-depth body content with actionable advice and examples
- Key Takeaways (Bullet points)
- FAQ Section: 3-4 schema-friendly Q&As addressing common user queries
- Conclusion & CTA`;
  } else if (contentType === 'ideas' || contentType === 'content ideas' || params.contentType === 'Content Ideas') {
    userPrompt = `Generate 20 HIGH-CONVERTING CONTENT IDEAS strictly tailored to this exact niche and context:

${userContextBlock}
Platform: ${params.platform || 'Instagram / LinkedIn / YouTube'}${langDirective}

For each of the 20 ideas, format as:
[Number]. Title: "..."
• Hook: "..."
• Angle: [Behind the Scenes / Problem-Solution / Case Study / Contrarian / Tutorial]
• Recommended Format: [Reel / Carousel / Long-form / Text Post / YouTube]

Cover a wide spectrum of educational, viral, relatable, and promotional concepts in the requested language.`;
  } else {
    userPrompt = `Generate a high-performing ${params.contentType || 'Social Media Post'} strictly tailored to this exact topic and context:

${userContextBlock}
Platform: ${params.platform || 'Instagram'}
Tone: ${params.tone || 'Conversational'}
Length: ${params.contentLength || 'Medium'}${langDirective}

Follow a high-retention framework in the requested language:
1. Hook (Immediate attention grabber)
2. Problem / Context (Why this matters now)
3. Value / Solution (Actionable insights, examples, or framework)
4. Takeaway & CTA`;
  }

  userPrompt += `\n\nFINAL STRICT INSTRUCTION: Ensure the output is strictly in ${params.language || 'English'}. If Tamil was chosen, write exclusively in Tamil script (தமிழ்). If Thanglish was chosen, write in conversational Thanglish.`;

  try {
    const response = await executeGeminiWithRetry(async (modelName) => {
      return await ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.75,
        },
      });
    }, 'gemini-3.1-flash-lite');

    const generatedText = response.text || 'No content generated. Please try again.';
    
    // Extract metadata
    const wordCount = generatedText.split(/\s+/).filter(Boolean).length;
    const charCount = generatedText.length;
    
    // Check if estimated duration is mentioned
    let estDuration = '45 Seconds';
    const durationMatch = generatedText.match(/ESTIMATED_DURATION:\s*([^\n\r]+)/i);
    if (durationMatch) {
      estDuration = durationMatch[1].trim();
    } else {
      // average 130 words per minute
      const seconds = Math.max(15, Math.round((wordCount / 130) * 60));
      estDuration = `${seconds} Seconds`;
    }

    // Extract hashtags if present
    const tagsMatch = generatedText.match(/#[a-zA-Z0-9_]+/g);
    const tags = tagsMatch ? Array.from(new Set(tagsMatch)).slice(0, 15) : [];

    // Formulate a clean display title
    let title = params.topic.trim();
    if (title.length > 60) {
      title = title.substring(0, 57) + '...';
    }
    if (params.contentType) {
      title = `${title} (${params.contentType})`;
    }

    return {
      content: generatedText.replace(/ESTIMATED_DURATION:\s*[^\n\r]+/i, '').trim(),
      title,
      meta: {
        estimated_duration: estDuration,
        word_count: wordCount,
        char_count: charCount,
        tags
      }
    };
  } catch (error: any) {
    console.error('Gemini generateContent error:', error);
    throw new Error(error?.message || 'Failed to generate AI content');
  }
}

export async function transformAIContent(params: AIActionParams): Promise<{
  content: string;
  meta: {
    word_count: number;
    char_count: number;
    estimated_duration: string;
  };
}> {
  const ai = getAiClient();

  let actionInstruction = '';
  switch (params.action) {
    case 'improve':
      actionInstruction = 'Polish and enhance the writing quality, flow, clarity, and punchiness while preserving core meaning.';
      break;
    case 'viral':
      actionInstruction = 'Make this significantly more viral, high-energy, scroll-stopping, and curiosity-driven. Intensify the hook and pacing.';
      break;
    case 'shorten':
      actionInstruction = 'Condense and trim all fluff. Make it 40% shorter, punchier, and faster to read or speak.';
      break;
    case 'expand':
      actionInstruction = 'Expand this content with deeper explanations, concrete real-world examples, actionable steps, and richer detail.';
      break;
    case 'emotional':
      actionInstruction = 'Rewrite with deep emotional resonance, empathy, vulnerability, and relatable human storytelling.';
      break;
    case 'professional':
      actionInstruction = 'Refine tone to be authoritative, polished, corporate-ready, and executive-level professional.';
      break;
    case 'conversational':
      actionInstruction = 'Make this sound like a friendly, natural chat with a peer over coffee. Casual, approachable, and authentic.';
      break;
    case 'translate':
      if (params.targetLanguage === 'thanglish') {
        actionInstruction = 'Translate and adapt this content into natural, colloquial THANGLISH (spoken Tamil using English/Latin alphabet, e.g. "Ungaloda business growth-ku indha tips follow pannunga"). Do NOT do literal translation.';
      } else if (params.targetLanguage === 'tamil') {
        actionInstruction = 'Translate and adapt this content into natural, modern, native TAMIL script (தமிழ்).';
      } else {
        actionInstruction = 'Translate and polish this content into fluent, modern English.';
      }
      break;
    case 'cta':
      actionInstruction = 'Create a significantly stronger, higher-converting call to action tailored to boost comments, saves, shares, or inquiries.';
      break;
  }

  const prompt = `You are ContentFlow AI. Transform the following content according to this instruction:
INSTRUCTION: ${actionInstruction}

ORIGINAL CONTENT:
"""
${params.content}
"""

OUTPUT: Return only the transformed high-quality content ready for publishing. Do not add conversational preamble.`;

  try {
    const response = await executeGeminiWithRetry(async (modelName) => {
      return await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          temperature: 0.7,
        },
      });
    }, 'gemini-3.1-flash-lite');

    const transformed = (response.text || params.content).trim();
    const wordCount = transformed.split(/\s+/).filter(Boolean).length;
    const charCount = transformed.length;
    const seconds = Math.max(15, Math.round((wordCount / 130) * 60));

    return {
      content: transformed,
      meta: {
        word_count: wordCount,
        char_count: charCount,
        estimated_duration: `${seconds} Seconds`
      }
    };
  } catch (error: any) {
    console.error('Gemini transform error:', error);
    throw new Error(error?.message || 'Failed to transform content');
  }
}

export interface ChatWithContextParams {
  messages: { role: 'user' | 'model'; content: string }[];
  contextProfile: {
    name?: string;
    type?: string;
    targetAudience?: string;
    language?: 'english' | 'tamil' | 'thanglish' | string;
    tone?: string;
    niche?: string;
    brandOrProductName?: string;
    businessDescription?: string;
    keyPoints?: string;
    pricingOrOffer?: string;
    uniqueSellingPoint?: string;
    wordsToAvoid?: string;
    customInstructions?: string;
  };
  contentType?: string;
}

export async function generateChatWithContext(params: ChatWithContextParams) {
  const ai = getAiClient();
  const cp = params.contextProfile || {};
  const lang = (cp.language || 'english').toLowerCase();

  let langInstruction = '';
  if (lang === 'tamil') {
    langInstruction = `Language: PURE NATURAL SPOKEN TAMIL (தமிழ்). Use conversational, engaging, modern Tamil suitable for video scripts, viral reels, and social media. Never sound archaic or translation-like.`;
  } else if (lang === 'thanglish' || lang === 'tanglish') {
    langInstruction = `Language: THANGLISH (Colloquial spoken Tamil written using English Latin alphabet). E.g., "Scroll panradha niruthunga! Neenga indha business start panna poringalana indha 3 secret tips ungalukku dhaan! Marakkama save panni vechukkonga." Make it punchy, authentic, and culturally relatable.`;
  } else {
    langInstruction = `Language: ENGLISH. Punchy, modern, high-converting, human creator style with strong emotional and logical hooks.`;
  }

  const systemInstruction = `You are ContentFlow ChatGPT Studio, a production-grade conversational AI copywriter, viral marketing director, and social media strategist.
You act like ChatGPT with deep context memory and conversational awareness.

================ ACTIVE THREAD CONTEXT PROFILE ================
CONTEXT NAME: ${cp.name || 'Untitled Context'}
CONTEXT TYPE: ${cp.type || 'General Creator'}
${cp.brandOrProductName ? `BRAND / PRODUCT NAME: ${cp.brandOrProductName}` : ''}
${cp.businessDescription ? `BUSINESS / TOPIC DESCRIPTION: ${cp.businessDescription}` : ''}
${cp.targetAudience ? `TARGET AUDIENCE: ${cp.targetAudience}` : ''}
${cp.niche ? `NICHE / INDUSTRY: ${cp.niche}` : ''}
${cp.pricingOrOffer ? `PRICING / PROMOTION / OFFER: ${cp.pricingOrOffer}` : ''}
${cp.uniqueSellingPoint ? `UNIQUE VALUE PROPOSITION (USP): ${cp.uniqueSellingPoint}` : ''}
${cp.wordsToAvoid ? `WORDS / TOPICS TO AVOID: ${cp.wordsToAvoid}` : ''}
${cp.customInstructions ? `CUSTOM SYSTEM INSTRUCTIONS: ${cp.customInstructions}` : ''}
TONE: ${cp.tone || 'Conversational & Engaging'}
${langInstruction}
===============================================================

OPERATING RULES:
1. FULL CONTEXT MEMORY: Remember all previous messages in this conversation. When the user asks to iterate, rewrite, extract hooks, generate reel scripts, or change tone, maintain complete continuity with the context profile and previous generation.
2. PRODUCTION QUALITY OUTPUT:
   - Provide clean, beautifully structured outputs with bold headers, line breaks, timecodes (for scripts), and actionable takeaways.
   - Zero robotic AI clichés like "In today's fast-paced world" or "Without further ado".
   - If the user asks for hooks, provide multiple punchy psychological angles (Curiosity, Contrarian, Mistake, Question, Emotional).
   - If the user asks for scripts, provide HOOK (0-3s), BODY, and CTA with pacing guidance.
   - If the user asks in Tamil or Thanglish, reply naturally in that exact dialect.
3. Be helpful, concise, creative, and ready to refine on follow-up prompts.`;

  // Build multi-turn contents array for Gemini
  const recentMessages = (params.messages || []).slice(-12);
  const contents = recentMessages.map(m => ({
    role: m.role === 'model' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  try {
    const response = await executeGeminiWithRetry(async (modelName) => {
      return await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction,
          temperature: 0.75,
        },
      });
    }, 'gemini-3.1-flash-lite');

    const reply = (response.text || '').trim();
    const wordCount = reply.split(/\s+/).filter(Boolean).length;
    const charCount = reply.length;
    const estimatedSeconds = Math.max(15, Math.round((wordCount / 130) * 60));

    return {
      content: reply,
      meta: {
        word_count: wordCount,
        char_count: charCount,
        estimated_duration: `${estimatedSeconds} Seconds`
      }
    };
  } catch (error: any) {
    console.error('Gemini chat context error:', error);
    throw new Error(error?.message || 'Failed to generate response in context');
  }
}
