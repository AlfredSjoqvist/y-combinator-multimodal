/**
 * Storybox Generation Pipeline
 *
 * Flow: Photo → Gemini 3.1 Pro (scene analysis) → Gemini 3.1 Pro (storyboard) →
 *       NanoBanana 2 (6 panels, sequential with Gemini reviews) →
 *       Gemini 3.1 Pro (script polish) → Gemini TTS (dialogue audio) →
 *       Lyria 002 (music) → Done
 */

import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai'
import type { StoryResult, Genre, DialogueLine } from './types'

// ─── Config ───

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyAsRaBgtjkSunlKR84093hNvtg8_3AWQJA'
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.1-pro-preview'
const NANOBANANA_MODEL = import.meta.env.VITE_NANOBANANA_MODEL || 'gemini-3.1-flash-image-preview'
const LYRIA_MODEL = import.meta.env.VITE_LYRIA_MODEL || 'lyria-002'

// Gemini TTS voice mapping — expressive, distinct voices
const GEMINI_VOICES: Record<string, string> = {
  // Male voices
  'deep_male': 'Charon',
  'young_male': 'Puck',
  'authoritative_male': 'Orus',
  'energetic_male': 'Fenrir',
  'calm_male': 'Charon',
  // Female voices
  'warm_female': 'Aoede',
  'young_female': 'Kore',
  'mature_female': 'Leda',
  'confident_female': 'Aoede',
  'gentle_female': 'Kore',
  // Defaults
  'male': 'Puck',
  'female': 'Kore',
  'default': 'Puck',
}

// All available Gemini TTS voice names for unique assignment
const ALL_VOICES = ['Charon', 'Puck', 'Orus', 'Fenrir', 'Aoede', 'Kore', 'Leda']

// Track which voice is assigned to which speaker (ensures uniqueness)
const speakerVoiceMap = new Map<string, string>()

function assignUniqueVoice(speaker: string, voiceHint: string | null): string {
  // If already assigned, reuse
  if (speakerVoiceMap.has(speaker)) return speakerVoiceMap.get(speaker)!

  // Pick preferred voice from hint
  const preferred = pickGeminiVoice(voiceHint)
  const usedVoices = new Set(speakerVoiceMap.values())

  // If preferred is available, use it
  if (!usedVoices.has(preferred)) {
    speakerVoiceMap.set(speaker, preferred)
    console.log(`[TTS] Assigned voice ${preferred} to ${speaker} (from hint)`)
    return preferred
  }

  // Otherwise pick the first unused voice
  for (const v of ALL_VOICES) {
    if (!usedVoices.has(v)) {
      speakerVoiceMap.set(speaker, v)
      console.log(`[TTS] Assigned voice ${v} to ${speaker} (unique fallback, hint wanted ${preferred})`)
      return v
    }
  }

  // All voices used — fall back to preferred anyway
  speakerVoiceMap.set(speaker, preferred)
  return preferred
}

// ─── Types ───

export interface SceneAnalysis {
  characters: Array<{
    name: string
    hair: string
    skin_tone: string
    eye_color: string
    clothing: string
    build: string
    age_range: string
    distinguishing_features: string
    voice_hint: string
  }>
  setting: string
  mood: string
  objects: string[]
  story_seed: string
}

export interface StoryboardDialogue {
  speaker: string
  text: string
  voice_hint: string
}

export interface StoryboardPanel {
  panel_number: number
  scene_description: string
  dialogues: StoryboardDialogue[]
  narration: string | null
  emotional_beat: string
}

export interface PipelineProgress {
  stepId: string
  status: 'start' | 'done' | 'error'
  data?: unknown
}

// ─── Helpers ───

function getGemini(): GoogleGenerativeAI {
  if (!API_KEY) throw new Error('VITE_GEMINI_API_KEY not set')
  return new GoogleGenerativeAI(API_KEY)
}

function getGeminiModel(genAI: GoogleGenerativeAI): GenerativeModel {
  return genAI.getGenerativeModel({ model: GEMINI_MODEL })
}

function getNanoBananaModel(genAI: GoogleGenerativeAI): GenerativeModel {
  return genAI.getGenerativeModel({
    model: NANOBANANA_MODEL,
    generationConfig: {
      // @ts-expect-error - responseModalities may not be in types yet
      responseModalities: ['TEXT', 'IMAGE'],
    },
  })
}

/** Convert a data URL to the format the Gemini API expects */
function dataUrlToInlineData(dataUrl: string): { inlineData: { mimeType: string; data: string } } {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/)
  if (!match) throw new Error('Invalid data URL')
  return { inlineData: { mimeType: match[1], data: match[2] } }
}

/** Try to parse JSON from a model response, handling markdown code fences */
function parseJsonResponse<T>(text: string): T {
  // Strip markdown code fences if present
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }
  return JSON.parse(cleaned) as T
}

/** Pick a Gemini TTS voice name based on voice hint */
function pickGeminiVoice(voiceHint: string | null): string {
  if (!voiceHint) return GEMINI_VOICES['default']
  const hint = voiceHint.toLowerCase()

  // Try specific combinations first
  if ((hint.includes('deep') || hint.includes('baritone')) && (hint.includes('male') || hint.includes('man'))) return GEMINI_VOICES['deep_male']
  if ((hint.includes('young') || hint.includes('energetic')) && (hint.includes('male') || hint.includes('man') || hint.includes('boy'))) return GEMINI_VOICES['young_male']
  if ((hint.includes('authoritative') || hint.includes('commanding')) && hint.includes('male')) return GEMINI_VOICES['authoritative_male']
  if ((hint.includes('warm') || hint.includes('confident')) && (hint.includes('female') || hint.includes('woman'))) return GEMINI_VOICES['warm_female']
  if ((hint.includes('young') || hint.includes('gentle')) && (hint.includes('female') || hint.includes('woman') || hint.includes('girl'))) return GEMINI_VOICES['young_female']
  if ((hint.includes('mature') || hint.includes('alto')) && (hint.includes('female') || hint.includes('woman'))) return GEMINI_VOICES['mature_female']

  // Gender fallback
  if (hint.includes('female') || hint.includes('woman') || hint.includes('soprano') || hint.includes('alto')) return GEMINI_VOICES['female']
  if (hint.includes('male') || hint.includes('man') || hint.includes('tenor') || hint.includes('baritone')) return GEMINI_VOICES['male']

  return GEMINI_VOICES['default']
}

// ─── Pipeline Steps ───

export async function analyzeScene(
  imageDataUrl: string,
): Promise<SceneAnalysis> {
  console.log('[Pipeline] Starting scene analysis...')
  const genAI = getGemini()
  const model = getGeminiModel(genAI)

  const prompt = `You are an expert at identifying people and scenes in photographs. Analyze this photo with extreme precision.

Return a JSON object with:
- characters: array of character descriptions. For EACH person visible, provide ALL of the following with obsessive detail:
  - name: give them a real-sounding first name
  - hair: exact color (e.g. "dirty blonde with lighter tips"), style (e.g. "messy, swept-up, medium length"), and any distinctive qualities
  - skin_tone: precise description (e.g. "fair with warm undertones")
  - eye_color: specific shade
  - clothing: EXTREMELY detailed — describe every visible garment with exact colors, patterns, fit, layers. E.g. "olive-green linen button-up shirt worn open over a light beige crew-neck t-shirt"
  - build: body type and height impression
  - age_range: estimated age range
  - distinguishing_features: facial structure, jawline, eyebrow shape, nose shape, any scars/glasses/facial hair. Be specific enough that a photographer could identify this exact person in a crowd.
  - voice_hint: describe what voice would suit this person for voiceover — e.g. "young male, energetic, slightly raspy", "female, warm, confident alto", "male, deep, calm baritone". Be specific about age, gender, pitch, and personality.
- setting: detailed description of the environment (be specific — indoor/outdoor, furniture, lighting, decor)
- mood: emotional tone of the scene
- objects: array of notable objects visible
- story_seed: a one-sentence premise for an adventure that could start from this exact mundane moment

These descriptions will be used to generate photorealistic images of these same people in new situations. If you are vague, the people will look different. Be forensically precise.

Return ONLY valid JSON, no other text.`

  const result = await model.generateContent([
    prompt,
    dataUrlToInlineData(imageDataUrl),
  ])
  const text = result.response.text()
  console.log('[Pipeline] Scene analysis raw response:', text)
  return parseJsonResponse<SceneAnalysis>(text)
}

export async function writeStoryboard(
  sceneAnalysis: SceneAnalysis,
  genre: Genre,
  prompt: string,
): Promise<StoryboardPanel[]> {
  console.log('[Pipeline] Writing storyboard...')
  const genAI = getGemini()
  const model = getGeminiModel(genAI)

  const storyboardPrompt = `You are a master cinematic storyteller creating a 6-panel photorealistic storyboard. Your stories transform mundane moments into extraordinary adventures.

Scene analysis: ${JSON.stringify(sceneAnalysis)}
Genre: ${genre}
User's story direction: ${prompt}

IMPORTANT CONTEXT: The audience watching this storyboard has NO context. They will see 6 photos played as a slideshow with narration text. The story must be completely self-contained and immediately understandable.

CHARACTER DESCRIPTIONS (include VERBATIM in every scene_description):
${sceneAnalysis.characters.map(c => `${c.name}: ${c.hair} hair, ${c.skin_tone} skin, ${c.eye_color} eyes, wearing ${c.clothing}, ${c.build} build, ${c.age_range}, ${c.distinguishing_features}`).join('\n')}

CHARACTER VOICE HINTS:
${sceneAnalysis.characters.map(c => `${c.name}: ${c.voice_hint}`).join('\n')}

CRITICAL RULES:
- Panel 1 IS the original photograph. Write a scene_description that describes EXACTLY what is in the original photo — the people, the setting, the mundane moment. This panel will use the actual uploaded photo, not a generated image.
- Panels 2-6 are NEW photorealistic scenes that naturally flow from panel 1.
- Each panel must logically follow the previous one. No teleporting to random locations without explanation.
- ALL images must look like REAL PHOTOGRAPHS — not illustrations, not paintings, not comics. Photorealistic, natural lighting, real environments.
- The story should escalate gradually from the mundane starting point into something extraordinary.

For each panel, provide:
- panel_number (1-6)
- scene_description: A detailed prompt for generating a PHOTOREALISTIC PHOTOGRAPH. Include:
  * The FULL character description block above (copy-pasted exactly, not abbreviated)
  * Specific real-world setting details (location, lighting conditions, time of day)
  * Character poses, facial expressions, and body language
  * Camera angle and framing (e.g. "medium shot", "close-up", "wide angle")
  * Photographic qualities (natural light, shallow depth of field, etc.)
- dialogues: an ARRAY of dialogue lines for this panel. Each entry has:
  * speaker: character name
  * text: short spoken line (max 12 words)
  * voice_hint: copy the voice_hint from the character list above
  A panel can have 0, 1, 2, or more dialogue lines — as many characters as are speaking in that moment.
  Characters should have back-and-forth conversation where appropriate. Make dialogue feel natural and cinematic.
- narration: cinematic narrator text that helps the audience follow the story (max 20 words) — this is NOT spoken, only shown as text. Make it clear and contextual. EVERY panel MUST have narration — no nulls or empty strings. Panel 1 must introduce the characters and setting.
- emotional_beat: one word describing the mood

Story structure:
- Panel 1: The mundane moment — EXACTLY the original photo. Narration sets up who these people are.
- Panel 2: The inciting incident — something unexpected happens or is discovered. Must feel like a natural next moment.
- Panel 3: Rising action — the situation escalates. Characters are drawn deeper in.
- Panel 4: The darkest moment — stakes are highest, tension peaks.
- Panel 5: The turning point — characters take decisive action.
- Panel 6: Resolution — spectacular, emotionally satisfying payoff.

The narration must tell a COMPLETE STORY that makes sense to someone seeing it for the first time. Each narration line should move the plot forward clearly.

Return ONLY a JSON array of 6 panel objects, no other text.`

  const result = await model.generateContent(storyboardPrompt)
  const text = result.response.text()
  console.log('[Pipeline] Storyboard raw response:', text)
  return parseJsonResponse<StoryboardPanel[]>(text)
}

export async function generatePanel(
  panelDesc: string,
  characterDescBlock: string,
  artStyle: string,
  panelNumber: number,
  referenceImageDataUrl: string,
): Promise<string> {
  console.log(`[Pipeline] Generating panel ${panelNumber}...`)
  const genAI = getGemini()
  const model = getNanoBananaModel(genAI)

  const prompt = `Generate a PHOTOREALISTIC photograph. This is panel ${panelNumber} of a 6-panel cinematic story.

Photography style: ${artStyle}

SCENE (panel ${panelNumber} of 6): ${panelDesc}

CHARACTER REFERENCE — The people in this photo MUST look IDENTICAL to the people in the reference photo:
${characterDescBlock}

CRITICAL REQUIREMENTS:
- This must look like a REAL PHOTOGRAPH taken by a professional photographer — NOT an illustration, painting, or comic
- The people must look EXACTLY like the reference photo — same face, same hair, same clothing, same build
- Natural lighting, realistic textures, photographic depth of field
- The scene must feel like a real moment captured on camera
- Cinematic composition — the kind of striking photo that tells a story
- IMPORTANT: This scene must look VISUALLY DIFFERENT from the reference photo — different camera angle, different environment, different action, different lighting. The ONLY thing that stays the same are the characters' appearances.
- The setting and action described in the SCENE must be clearly visible. Do NOT just reproduce the reference photo.`

  const result = await model.generateContent([
    prompt,
    dataUrlToInlineData(referenceImageDataUrl),
  ])

  // Extract image from response
  const response = result.response
  const candidates = response.candidates
  if (candidates && candidates.length > 0) {
    const parts = candidates[0].content.parts
    for (const part of parts) {
      // @ts-expect-error - inlineData may not be in types
      if (part.inlineData) {
        // @ts-expect-error - inlineData access
        const { mimeType, data } = part.inlineData
        const imageUrl = `data:${mimeType};base64,${data}`
        console.log(`[Pipeline] Panel ${panelNumber} generated (${data.length} bytes)`)
        return imageUrl
      }
    }
  }

  // Retry once before falling back
  console.warn(`[Pipeline] Panel ${panelNumber}: No image in first attempt, retrying...`)
  try {
    const retry = await model.generateContent([
      prompt + '\n\nYou MUST output an image. Generate the photograph now.',
      dataUrlToInlineData(referenceImageDataUrl),
    ])
    const retryCandidates = retry.response.candidates
    if (retryCandidates && retryCandidates.length > 0) {
      for (const part of retryCandidates[0].content.parts) {
        // @ts-expect-error - inlineData may not be in types
        if (part.inlineData) {
          // @ts-expect-error - inlineData access
          const { mimeType, data } = part.inlineData
          console.log(`[Pipeline] Panel ${panelNumber} generated on retry (${data.length} bytes)`)
          return `data:${mimeType};base64,${data}`
        }
      }
    }
  } catch (retryErr) {
    console.error(`[Pipeline] Panel ${panelNumber} retry also failed:`, retryErr)
  }

  console.warn(`[Pipeline] Panel ${panelNumber}: No image after retry, using reference`)
  return referenceImageDataUrl
}

export async function reviewConsistency(
  panelImages: string[],
  storyboard: StoryboardPanel[],
  sceneAnalysis: SceneAnalysis,
): Promise<{ adjustedBriefs: string[]; notes: string }> {
  console.log('[Pipeline] Running consistency review...')
  const genAI = getGemini()
  const model = getGeminiModel(genAI)

  const characterBlock = sceneAnalysis.characters.map(c =>
    `${c.name}: ${c.hair} hair, ${c.skin_tone} skin, ${c.eye_color} eyes, wearing ${c.clothing}, ${c.build} build, ${c.age_range}, ${c.distinguishing_features}`
  ).join('\n')

  const prompt = `You are a photo director ensuring the same real people appear consistently across a 6-panel photorealistic story.

LOCKED CHARACTER DESCRIPTIONS (must appear verbatim in every panel):
${characterBlock}

Panels completed so far: ${panelImages.length}
Remaining panel descriptions that need adjustment:
${storyboard.slice(panelImages.length).map((p, i) => `Panel ${panelImages.length + i + 1}: ${p.scene_description}`).join('\n\n')}

Review the remaining panel descriptions. For each one, rewrite the scene_description to:
1. Include the FULL character description block above (copy-pasted exactly, not abbreviated)
2. Emphasize these must be PHOTOREALISTIC — like real photographs, not illustrations
3. Add explicit notes about maintaining the exact same face, hair, and clothing from the reference photo
4. Keep all the original scene/action/lighting details

Return a JSON object with:
- adjustedBriefs: array of strings, one rewritten scene description per remaining panel
- notes: a brief consistency note

Return ONLY valid JSON.`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  console.log('[Pipeline] Review response:', text)
  return parseJsonResponse<{ adjustedBriefs: string[]; notes: string }>(text)
}

export async function polishScripts(
  storyboard: StoryboardPanel[],
  sceneAnalysis: SceneAnalysis,
  genre: Genre,
): Promise<{ title: string; panels: Array<{ dialogues: Array<{ speaker: string; text: string; voice_hint: string }>; narration: string | null }> }> {
  console.log('[Pipeline] Polishing scripts...')
  const genAI = getGemini()
  const model = getGeminiModel(genAI)

  const prompt = `You are a script editor for a cinematic ${genre} photo story. Polish the dialogue and narration for maximum impact. Also create a compelling title.

The audience has NO prior context. They see 6 photos as a slideshow with narration overlaid. The narration must tell a complete, self-contained story.

Story panels: ${JSON.stringify(storyboard.map(p => ({ dialogues: p.dialogues, narration: p.narration, beat: p.emotional_beat })))}
Characters: ${JSON.stringify(sceneAnalysis.characters.map(c => ({ name: c.name, voice_hint: c.voice_hint })))}

Return a JSON object with:
- title: a catchy story title (max 6 words)
- panels: array of 6 objects, each with:
  - dialogues: array of { speaker: string, text: string, voice_hint: string } — keep speaker names and voice_hints consistent. Multiple characters can speak per panel.
  - narration: string|null

Make dialogue punchy, natural, and cinematic. Characters should react to each other — real conversation, not monologues. Make narration cinematic but clear — each line must move the plot forward so a stranger can follow the story. EVERY panel MUST have narration — never null or empty. Panel 1 narration must introduce who the characters are and where they are.

Return ONLY valid JSON.`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  console.log('[Pipeline] Polish response:', text)
  return parseJsonResponse<{ title: string; panels: Array<{ dialogues: Array<{ speaker: string; text: string; voice_hint: string }>; narration: string | null }> }>(text)
}

// ─── PCM to WAV conversion ───
// Gemini TTS returns raw PCM (audio/L16) which browsers can't play.
// We wrap it in a WAV header so HTML5 Audio can decode it.

function pcmBase64ToWavDataUrl(pcmBase64: string, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): string {
  // Decode base64 to raw bytes
  const binaryStr = atob(pcmBase64)
  const pcmBytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    pcmBytes[i] = binaryStr.charCodeAt(i)
  }

  const dataLength = pcmBytes.length
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)

  // Build WAV header (44 bytes)
  const buffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(buffer)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(view, 8, 'WAVE')

  // fmt chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  // data chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataLength, true)

  // Copy PCM data
  const wavBytes = new Uint8Array(buffer)
  wavBytes.set(pcmBytes, 44)

  // Convert to base64 data URL
  let binary = ''
  for (let i = 0; i < wavBytes.length; i++) {
    binary += String.fromCharCode(wavBytes[i])
  }
  return `data:audio/wav;base64,${btoa(binary)}`
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

// ─── Gemini TTS Dialogue Generation ───

export async function generateDialogueAudio(
  text: string,
  voiceHint: string | null,
  speaker: string,
): Promise<string | null> {
  const voiceName = assignUniqueVoice(speaker, voiceHint)
  console.log(`[Pipeline] Generating TTS for ${speaker} with voice ${voiceName}: "${text}"`)

  // Try multiple TTS-capable models
  const ttsModels = ['gemini-2.5-flash-preview-tts', 'gemini-2.0-flash']

  for (const modelName of ttsModels) {
    try {
      const requestBody = {
        contents: [{ parts: [{ text: `Say this line as ${speaker}, a character in a cinematic story. Deliver it with emotion and natural inflection:\n\n"${text}"` }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      }
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`
      console.log(`[TTS DEBUG] Request to ${modelName}:`, JSON.stringify(requestBody).slice(0, 300))

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errBody = await response.text()
        console.error(`[TTS DEBUG] ${modelName} HTTP ${response.status}: ${errBody.slice(0, 500)}`)
        continue
      }

      const data = await response.json()
      console.log(`[TTS DEBUG] ${modelName} response keys:`, Object.keys(data))
      console.log(`[TTS DEBUG] ${modelName} candidates:`, data.candidates?.length, 'parts:', data.candidates?.[0]?.content?.parts?.length)

      const candidates = data.candidates
      if (candidates?.[0]?.content?.parts) {
        for (const part of candidates[0].content.parts) {
          console.log(`[TTS DEBUG] Part keys:`, Object.keys(part))
          if (part.inlineData) {
            const mime = part.inlineData.mimeType as string
            const rawData = part.inlineData.data as string
            console.log(`[TTS DEBUG] Raw audio: mime=${mime}, bytes=${rawData.length}`)

            // PCM/L16 audio needs WAV header wrapping for browser playback
            let audioUrl: string
            if (mime.includes('L16') || mime.includes('pcm')) {
              // Extract sample rate from mime (e.g. "audio/L16;codec=pcm;rate=24000")
              const rateMatch = mime.match(/rate=(\d+)/)
              const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000
              audioUrl = pcmBase64ToWavDataUrl(rawData, sampleRate)
              console.log(`[TTS DEBUG] SUCCESS: ${speaker} via ${modelName} — converted PCM→WAV (rate=${sampleRate})`)
            } else {
              audioUrl = `data:${mime};base64,${rawData}`
              console.log(`[TTS DEBUG] SUCCESS: ${speaker} via ${modelName} — native ${mime}`)
            }
            return audioUrl
          }
          if (part.text) {
            console.log(`[TTS DEBUG] Got text instead of audio: "${part.text.slice(0, 100)}"`)
          }
        }
      } else {
        console.error(`[TTS DEBUG] ${modelName} no candidates/parts. Full response:`, JSON.stringify(data).slice(0, 500))
      }
    } catch (e) {
      console.error(`[TTS DEBUG] ${modelName} exception:`, e)
    }
  }

  console.error(`[TTS DEBUG] ALL TTS FAILED for "${speaker}": "${text.slice(0, 50)}"`)
  return null
}

/** Generate audio for all dialogue lines across all panels */
export async function generateAllDialogueAudio(
  panels: Array<{ dialogues: Array<{ speaker: string; text: string; voice_hint: string }> }>,
): Promise<Map<string, string>> {
  const audioMap = new Map<string, string>() // key: "panelIdx-dialogueIdx"

  // Generate audio for each dialogue line — sequential to avoid rate limits
  for (let pi = 0; pi < panels.length; pi++) {
    const panel = panels[pi]
    for (let di = 0; di < panel.dialogues.length; di++) {
      const d = panel.dialogues[di]
      const key = `${pi}-${di}`
      try {
        const audioUrl = await generateDialogueAudio(d.text, d.voice_hint, d.speaker)
        if (audioUrl) {
          audioMap.set(key, audioUrl)
        }
      } catch (e) {
        console.warn(`[Pipeline] Dialogue audio failed for ${key}:`, e)
      }
    }
  }

  console.log(`[Pipeline] Generated ${audioMap.size} dialogue audio clips`)
  return audioMap
}

// ─── Music Generation (Lyria) ───

export async function generateMusic(
  storyboard: StoryboardPanel[],
  title: string,
  genre: Genre,
): Promise<string | null> {
  console.log('[Pipeline] Generating music with Lyria...')

  const beatTimeline = storyboard.map((p, i) => {
    return `Section ${i + 1}: ${p.emotional_beat.toUpperCase()} — ${p.narration || p.scene_description.slice(0, 80)}`
  }).join('\n')

  const styleMap: Record<string, string> = {
    'sci-fi': 'electronic synth elements and atmospheric pads',
    noir: 'jazz noir piano and saxophone',
    comedy: 'playful woodwinds and pizzicato strings',
    romance: 'romantic strings and piano',
    ghibli: 'whimsical piano and gentle woodwinds',
  }
  const styleDesc = styleMap[genre] || 'epic fantasy orchestra with brass and strings'

  const musicPrompt = `Compose a cinematic orchestral score for a ${genre} story titled "${title}".

The story has these emotional sections:
${beatTimeline}

Create a cohesive musical piece that captures the overall emotional arc — starting gentle and building to a dramatic, emotionally satisfying climax.

Style: cinematic orchestral with ${styleDesc}.
Make it feel like a movie soundtrack — lush, emotional, with clear musical themes.`

  try {
    // Lyria via REST
    const requestBody = {
      contents: [{ parts: [{ text: musicPrompt }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
      },
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${LYRIA_MODEL}:generateContent?key=${API_KEY}`
    console.log(`[LYRIA DEBUG] Request URL: ${url.replace(API_KEY, 'KEY***')}`)
    console.log(`[LYRIA DEBUG] Model: ${LYRIA_MODEL}`)
    console.log(`[LYRIA DEBUG] Prompt: ${musicPrompt.slice(0, 200)}...`)

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(`[LYRIA DEBUG] HTTP ${response.status} error: ${errText.slice(0, 800)}`)
      return await generateMusicFallback(musicPrompt)
    }

    const data = await response.json()
    console.log('[LYRIA DEBUG] Response keys:', Object.keys(data))
    console.log('[LYRIA DEBUG] Candidates:', data.candidates?.length)
    if (data.candidates?.[0]) {
      console.log('[LYRIA DEBUG] Parts:', data.candidates[0].content?.parts?.length)
      data.candidates[0].content?.parts?.forEach((p: Record<string, unknown>, i: number) => {
        console.log(`[LYRIA DEBUG] Part ${i} keys:`, Object.keys(p))
      })
    }
    if (data.error) {
      console.error('[LYRIA DEBUG] API error object:', JSON.stringify(data.error))
    }

    const candidates = data.candidates
    if (candidates && candidates.length > 0) {
      const parts = candidates[0].content.parts
      for (const part of parts) {
        if (part.inlineData) {
          const { mimeType, data: audioData } = part.inlineData
          const audioUrl = `data:${mimeType};base64,${audioData}`
          console.log(`[LYRIA DEBUG] SUCCESS: Music generated — mime=${mimeType}, bytes=${audioData.length}`)
          return audioUrl
        }
      }
    }

    console.error('[LYRIA DEBUG] No audio in response. Full response:', JSON.stringify(data).slice(0, 800))
    return await generateMusicFallback(musicPrompt)
  } catch (e) {
    console.error('[LYRIA DEBUG] Exception:', e)
    return await generateMusicFallback(musicPrompt)
  }
}

async function generateMusicFallback(musicPrompt: string): Promise<string | null> {
  console.log('[LYRIA DEBUG] Trying Lyria SDK fallback...')
  try {
    const genAI = getGemini()
    const model = genAI.getGenerativeModel({
      model: LYRIA_MODEL,
      // @ts-expect-error - generationConfig for audio
      generationConfig: {
        responseModalities: ['AUDIO'],
      },
    })
    const result = await model.generateContent(musicPrompt)
    console.log('[LYRIA DEBUG] SDK response candidates:', result.response.candidates?.length)
    const audio = extractAudioFromResponse(result.response)
    if (audio) {
      console.log('[LYRIA DEBUG] SDK fallback SUCCESS')
      return audio
    }
    console.error('[LYRIA DEBUG] SDK response had no audio data')
  } catch (e) {
    console.error('[LYRIA DEBUG] Lyria SDK fallback exception:', e)
  }

  // Try Gemini TTS to generate background humming as music
  console.log('[LYRIA DEBUG] Trying Gemini TTS humming fallback...')
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Hum a gentle, cinematic melody. No words, just humming a beautiful orchestral theme. Hmmm hm hm hmmmm hm hm hmmm hmm hmm hmmm hm hmmmm...` }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Aoede' },
              },
            },
          },
        }),
      },
    )
    if (!response.ok) {
      const errBody = await response.text()
      console.error(`[LYRIA DEBUG] TTS humming failed: ${response.status} ${errBody.slice(0, 300)}`)
    } else {
      const data = await response.json()
      const candidates = data.candidates
      if (candidates?.[0]?.content?.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.inlineData) {
            const mime = part.inlineData.mimeType as string
            const rawData = part.inlineData.data as string
            // Convert PCM to WAV just like dialogue audio
            let audioUrl: string
            if (mime.includes('L16') || mime.includes('pcm')) {
              const rateMatch = mime.match(/rate=(\d+)/)
              const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000
              audioUrl = pcmBase64ToWavDataUrl(rawData, sampleRate)
              console.log(`[LYRIA DEBUG] Music via TTS humming — converted PCM→WAV (${rawData.length} bytes)`)
            } else {
              audioUrl = `data:${mime};base64,${rawData}`
              console.log(`[LYRIA DEBUG] Music via TTS humming — native ${mime} (${rawData.length} bytes)`)
            }
            return audioUrl
          }
        }
      }
    }
  } catch (e) {
    console.error('[LYRIA DEBUG] TTS humming exception:', e)
  }

  console.error('[LYRIA DEBUG] ALL music generation failed')
  return null
}

/** Extract audio data URL from a GenerateContentResponse */
function extractAudioFromResponse(response: { candidates?: Array<{ content: { parts: Array<Record<string, unknown>> } }> }): string | null {
  const candidates = response.candidates
  if (candidates && candidates.length > 0) {
    const parts = candidates[0].content.parts
    for (const part of parts) {
      if (part.inlineData && typeof part.inlineData === 'object') {
        const inline = part.inlineData as { mimeType: string; data: string }
        return `data:${inline.mimeType};base64,${inline.data}`
      }
    }
  }
  return null
}

// ─── Art style per genre ───

const GENRE_STYLES: Record<Genre, string> = {
  adventure: 'Cinematic photorealistic photography, dramatic natural lighting, vivid colors, wide dynamic range, shot on high-end DSLR, adventure documentary style',
  noir: 'Photorealistic black and white photography, high contrast, deep shadows, film noir lighting, moody atmospheric',
  comedy: 'Bright photorealistic photography, warm natural light, candid moments, vibrant colors, lifestyle photography style',
  'sci-fi': 'Photorealistic photography with dramatic lighting, cool blue tones, modern architecture, sharp cinematic look',
  romance: 'Photorealistic photography, soft golden hour lighting, warm tones, shallow depth of field, intimate framing',
  ghibli: 'Photorealistic photography with dreamy soft light, lush natural settings, warm pastoral atmosphere, magic hour',
}

// ─── Hardcoded Demo Storyboard ───

export const HARDCODED_STORYBOARD: StoryboardPanel[] = [
  {
    panel_number: 1,
    scene_description: 'A packed hackathon venue late at night. Rows of tables, but we focus on one corner where the three characters sit together surrounded by laptops, empty energy cans, tangled cables, and sticky notes plastered everywhere. A big scoreboard on the wall shows their team in 4th place. Character 1 is typing furiously. Character 2 is sketching something on a whiteboard behind them. Character 3 is slumped forward, head nearly on the keyboard, somehow still coding.',
    dialogues: [
      { speaker: 'Character 1', text: "We need something that actually wows the judges. What we have is... fine. Fine doesn't win.", voice_hint: 'young_male' },
      { speaker: 'Character 2', text: 'What if we add a live data feed? Real-time competitor intelligence, fully autonomous.', voice_hint: 'young_male' },
      { speaker: 'Character 3', text: "Already building it. Don't jinx it.", voice_hint: 'young_male' },
    ],
    narration: 'T-Minus 6 Hours — A hackathon venue, late at night. Three coders sit in the corner, fueled by caffeine and delusion.',
    emotional_beat: 'determined',
  },
  {
    panel_number: 2,
    scene_description: "Character 3 suddenly sits up straight. Their screen is filling with an error unlike anything they've seen — cascading symbols, unknown characters, the terminal scrolling faster than readable. The glow from the screen turns from white to deep violet and starts lighting up their face. Character 1 and Character 2 lean in to look. The energy in the room shifts — other hackathon participants in the background are completely oblivious, still typing away.",
    dialogues: [
      { speaker: 'Character 3', text: "Guys. This isn't a normal crash.", voice_hint: 'young_male' },
      { speaker: 'Character 1', text: 'What did you install?', voice_hint: 'young_male' },
      { speaker: 'Character 3', text: "I pulled a dependency from a repo that had... no stars, no forks, no author. Just a readme that said 'use carefully.'", voice_hint: 'young_male' },
      { speaker: 'Character 2', text: 'You did what.', voice_hint: 'deep_male' },
    ],
    narration: 'The Bug That Broke Reality — A mysterious error cascades across the screen, bathing everything in violet light.',
    emotional_beat: 'tense',
  },
  {
    panel_number: 3,
    scene_description: "The laptop screen shatters outward with light — not glass, but pure energy. A swirling portal tears open in the air above the table, roughly the size of a doorway, crackling and churning with color. It creates a powerful suction — papers, sticky notes, and a Red Bull can get pulled toward it. The three characters grip the table edge. Around the portal's rim, strange geometric symbols rotate slowly. Other hackathon attendees finally notice, pointing and scrambling back in panic.",
    dialogues: [
      { speaker: 'Character 1', text: 'We are not going in there.', voice_hint: 'young_male' },
      { speaker: 'Character 2', text: 'We are absolutely going in there.', voice_hint: 'young_male' },
      { speaker: 'Character 3', text: "I don't think we have a choice.", voice_hint: 'young_male' },
    ],
    narration: 'The Portal Opens — Pure energy shatters the screen. A swirling portal rips through reality above their table.',
    emotional_beat: 'wonder',
  },
  {
    panel_number: 4,
    scene_description: "They crash-land in a heap on hard, dark ground. The portal snaps shut behind them with a sound like a thunderclap. When they look up they are somewhere completely alien — a vast landscape under a bruised red sky, enormous black rock formations rising in every direction, distant fires burning on the horizon. Their laptop bags and gear came through with them. They stand up slowly, taking it in. In the far distance, carved into the largest mountain, is an enormous cave — and from it comes a deep, rhythmic sound. Breathing.",
    dialogues: [
      { speaker: 'Character 1', text: "Okay. We're all here. We're intact. That's step one.", voice_hint: 'young_male' },
      { speaker: 'Character 2', text: 'Is that... a cave? Something is breathing in that cave.', voice_hint: 'young_male' },
      { speaker: 'Character 3', text: "I'm going to need a minute.", voice_hint: 'young_male' },
    ],
    narration: 'Arrival — They crash-land under a bruised red sky. Something massive breathes inside the mountain ahead.',
    emotional_beat: 'curious',
  },
  {
    panel_number: 5,
    scene_description: "The dragon erupts from the mountain — enormous, ancient, filling the sky as it dives toward them with fire already building in its throat. The ground shakes. Character 2 charges toward it head-on, using a heavy metal rod, aiming for the soft underbelly as the beast swoops low. Character 1 is positioned to the side, hurling a barrage of rocks at the dragon's eyes to distract it. Character 3 is behind a boulder, typing at terrifying speed — the code they're writing is pulling environmental data, calculating the dragon's flight pattern, predicting its next breath attack, and routing it all to the others' phones as live alerts.",
    dialogues: [
      { speaker: 'Character 3', text: 'It breathes every 11 seconds. Next blast in 4. Move left.', voice_hint: 'young_male' },
      { speaker: 'Character 2', text: 'I love you. I genuinely love you.', voice_hint: 'young_male' },
      { speaker: 'Character 1', text: 'Can your model tell it to STOP LOOKING AT ME?!', voice_hint: 'young_male' },
    ],
    narration: 'Slay the Dragon — The beast erupts from the mountain. One fights, one distracts, one codes their survival in real-time.',
    emotional_beat: 'dramatic',
  },
  {
    panel_number: 6,
    scene_description: "The dragon is down — not dead, but grounded and exhausted, its massive wings pinned by collapsed rock formations. The three of them stand in front of it, catching their breath, singed and battered. The portal reopens behind them, back to the fluorescent-lit hackathon venue. Character 3 turns their laptop around — the error is gone. In its place: BUILD SUCCESSFUL — 11:47 PM. 13 minutes before the submission deadline.",
    dialogues: [
      { speaker: 'Character 1', text: 'We need to present this in 13 minutes.', voice_hint: 'young_male' },
      { speaker: 'Character 2', text: 'The demo is going to be incredible.', voice_hint: 'young_male' },
      { speaker: 'Character 3', text: "I'm writing this up as a feature, not a bug.", voice_hint: 'young_male' },
    ],
    narration: 'Build Successful — The dragon falls. The portal home reopens. BUILD SUCCESSFUL — 11:47 PM. 13 minutes to deadline.',
    emotional_beat: 'triumphant',
  },
]

// ─── Full Pipeline Orchestrator ───

export async function runPipeline(
  imageDataUrl: string,
  genre: Genre,
  prompt: string,
  onProgress: (progress: PipelineProgress) => void,
  useHardcodedStory = false,
): Promise<StoryResult> {
  const artStyle = GENRE_STYLES[genre] || GENRE_STYLES.adventure

  // Reset voice assignments for each new pipeline run
  speakerVoiceMap.clear()

  // Step 1: Initialize
  onProgress({ stepId: 'input', status: 'start' })
  await new Promise(r => setTimeout(r, 800))
  onProgress({ stepId: 'input', status: 'done' })

  // Step 2: Scene Analysis (Gemini)
  onProgress({ stepId: 'scan', status: 'start' })
  let sceneAnalysis: SceneAnalysis
  try {
    sceneAnalysis = await analyzeScene(imageDataUrl)
  } catch (e) {
    console.error('[Pipeline] Scene analysis failed:', e)
    onProgress({ stepId: 'scan', status: 'error', data: e })
    throw e
  }
  onProgress({ stepId: 'scan', status: 'done', data: sceneAnalysis })

  // Build character description block for NanoBanana prompts
  const characterBlock = sceneAnalysis.characters.map(c =>
    `${c.name}: ${c.hair} hair, ${c.skin_tone} skin, ${c.eye_color} eyes, wearing ${c.clothing}, ${c.build} build, ${c.age_range}, ${c.distinguishing_features}`
  ).join('\n')

  // Step 3: Storyboard (Gemini or hardcoded)
  onProgress({ stepId: 'storyboard', status: 'start' })
  let storyboard: StoryboardPanel[]
  if (useHardcodedStory) {
    console.log('[Pipeline] Using HARDCODED storyboard (G-mode)')
    // Replace generic "Character X" names with detected character names
    storyboard = HARDCODED_STORYBOARD.map(panel => {
      const mappedDialogues = panel.dialogues.map(d => {
        let speaker = d.speaker
        let voiceHint = d.voice_hint
        if (d.speaker === 'Character 1' && sceneAnalysis.characters[0]) {
          speaker = sceneAnalysis.characters[0].name
          voiceHint = sceneAnalysis.characters[0].voice_hint || d.voice_hint
        } else if (d.speaker === 'Character 2' && sceneAnalysis.characters[1]) {
          speaker = sceneAnalysis.characters[1].name
          voiceHint = sceneAnalysis.characters[1].voice_hint || d.voice_hint
        } else if (d.speaker === 'Character 3' && sceneAnalysis.characters[2]) {
          speaker = sceneAnalysis.characters[2].name
          voiceHint = sceneAnalysis.characters[2].voice_hint || d.voice_hint
        }
        return { ...d, speaker, voice_hint: voiceHint }
      })
      // Also replace "Character X" in scene descriptions
      let desc = panel.scene_description
      sceneAnalysis.characters.forEach((c, i) => {
        desc = desc.replace(new RegExp(`Character ${i + 1}`, 'g'), c.name)
      })
      return { ...panel, dialogues: mappedDialogues, scene_description: desc }
    })
    await new Promise(r => setTimeout(r, 500))
  } else {
    try {
      storyboard = await writeStoryboard(sceneAnalysis, genre, prompt)
    } catch (e) {
      console.error('[Pipeline] Storyboard failed:', e)
      onProgress({ stepId: 'storyboard', status: 'error', data: e })
      throw e
    }
  }
  onProgress({ stepId: 'storyboard', status: 'done', data: storyboard })

  // Steps 4-9: Panel generation with reviews
  const panelImages: string[] = []
  let currentBriefs = storyboard.map(p => p.scene_description)

  for (let i = 0; i < 6; i++) {
    const panelId = `p${i + 1}`

    onProgress({ stepId: panelId, status: 'start' })

    if (i === 0) {
      console.log('[Pipeline] Panel 1: using original photo')
      panelImages.push(imageDataUrl)
      await new Promise(r => setTimeout(r, 500))
    } else {
      try {
        const imageUrl = await generatePanel(
          currentBriefs[i],
          characterBlock,
          artStyle,
          i + 1,
          imageDataUrl,
        )
        panelImages.push(imageUrl)
      } catch (e) {
        console.error(`[Pipeline] Panel ${i + 1} failed:`, e)
        panelImages.push(imageDataUrl)
      }
    }
    onProgress({ stepId: panelId, status: 'done', data: panelImages[i] })

    // Consistency review after panel 1
    if (i === 0) {
      onProgress({ stepId: 'r1', status: 'start' })
      try {
        const review = await reviewConsistency(panelImages, storyboard, sceneAnalysis)
        if (review.adjustedBriefs && review.adjustedBriefs.length > 0) {
          for (let j = 0; j < review.adjustedBriefs.length && (j + i + 1) < 6; j++) {
            currentBriefs[j + i + 1] = review.adjustedBriefs[j]
          }
        }
      } catch (e) {
        console.warn('[Pipeline] Review 1 failed, continuing:', e)
      }
      onProgress({ stepId: 'r1', status: 'done' })
    }

    // Consistency review after panel 2
    if (i === 1) {
      onProgress({ stepId: 'r2', status: 'start' })
      try {
        const review = await reviewConsistency(panelImages, storyboard, sceneAnalysis)
        if (review.adjustedBriefs && review.adjustedBriefs.length > 0) {
          for (let j = 0; j < review.adjustedBriefs.length && (j + i + 1) < 6; j++) {
            currentBriefs[j + i + 1] = review.adjustedBriefs[j]
          }
        }
      } catch (e) {
        console.warn('[Pipeline] Review 2 failed, continuing:', e)
      }
      onProgress({ stepId: 'r2', status: 'done' })
    }
  }

  // Step 10: Script polish (Gemini) — skip if hardcoded (scripts are already final)
  onProgress({ stepId: 'polish', status: 'start' })
  let title = useHardcodedStory ? 'Syntax Error: Realm Unknown' : `The ${genre.charAt(0).toUpperCase() + genre.slice(1)} of a Lifetime`
  let polishedPanels = storyboard.map(p => ({
    dialogues: p.dialogues || [],
    narration: p.narration,
  }))
  if (!useHardcodedStory) {
    try {
      const polished = await polishScripts(storyboard, sceneAnalysis, genre)
      title = polished.title
      polishedPanels = polished.panels
    } catch (e) {
      console.warn('[Pipeline] Polish failed, using original scripts:', e)
    }
  } else {
    console.log('[Pipeline] Skipping polish — hardcoded scripts are final')
    await new Promise(r => setTimeout(r, 300))
  }
  // Ensure every panel has narration (fallback if model returned null) and cap length
  polishedPanels.forEach((p, i) => {
    if (!p.narration) {
      const fallback = i === 0
        ? 'It all began on an ordinary day...'
        : `And so the story continued...`
      console.warn(`[Pipeline] Panel ${i + 1} missing narration, using fallback`)
      p.narration = fallback
    }
    // Cap narration length — max ~25 words / 120 chars
    if (p.narration && p.narration.length > 120) {
      console.warn(`[Pipeline] Panel ${i + 1} narration too long (${p.narration.length}), truncating`)
      p.narration = p.narration.slice(0, 117) + '...'
    }
  })
  onProgress({ stepId: 'polish', status: 'done', data: { title, polishedPanels } })

  // Step 11: Generate dialogue audio (Gemini TTS)
  onProgress({ stepId: 'voices', status: 'start' })
  let audioMap = new Map<string, string>()
  try {
    audioMap = await generateAllDialogueAudio(polishedPanels)
  } catch (e) {
    console.warn('[Pipeline] Dialogue audio generation failed:', e)
  }
  onProgress({ stepId: 'voices', status: 'done', data: audioMap.size })

  // Step 12: Music — pick a random track from /music/
  onProgress({ stepId: 'music', status: 'start' })
  let audioUrl: string | null = null
  const MUSIC_TRACKS = [
    '/music/1.mp3', '/music/2.mp3', '/music/3.mp3',
    '/music/4.mp3', '/music/5.mp3', '/music/6.mp3',
    '/music/7.mp3', '/music/8.mp3', '/music/9.mp3',
    '/music/10.mp3',
  ]
  const randomTrack = MUSIC_TRACKS[Math.floor(Math.random() * MUSIC_TRACKS.length)]
  console.log(`[Pipeline] Picking random music track: ${randomTrack}`)
  try {
    // Just verify the track exists, then pass the URL directly (no data URL for large files)
    const bgmResp = await fetch(randomTrack, { method: 'HEAD' })
    if (bgmResp.ok) {
      audioUrl = randomTrack
      console.log(`[Pipeline] Music track available: ${randomTrack}`)
    } else {
      console.warn(`[Pipeline] ${randomTrack} not found: ${bgmResp.status}`)
      // Try all tracks until we find one that exists
      for (const track of MUSIC_TRACKS) {
        if (track === randomTrack) continue
        const resp = await fetch(track, { method: 'HEAD' })
        if (resp.ok) {
          audioUrl = track
          console.log(`[Pipeline] Fallback music track: ${track}`)
          break
        }
      }
    }
  } catch (e) {
    console.warn('[Pipeline] Failed to check music track:', e)
  }
  onProgress({ stepId: 'music', status: 'done', data: audioUrl })

  // Step 13: Final assembly
  onProgress({ stepId: 'cinema', status: 'start' })
  await new Promise(r => setTimeout(r, 800))

  const result: StoryResult = {
    title,
    genre: genre as Genre,
    panels: panelImages.map((imageUrl, i) => {
      const panelDialogues = polishedPanels[i]?.dialogues || storyboard[i]?.dialogues || []
      return {
        imageUrl,
        dialogues: panelDialogues.map((d, di) => {
          const character = sceneAnalysis.characters.find(c => c.name === d.speaker)
          return {
            speaker: d.speaker,
            text: d.text,
            voiceHint: d.voice_hint || character?.voice_hint || null,
            audioUrl: audioMap.get(`${i}-${di}`) || null,
          }
        }),
        narration: polishedPanels[i]?.narration || storyboard[i]?.narration || null,
        emotionalBeat: storyboard[i]?.emotional_beat || 'neutral',
      }
    }),
    audioUrl,
  }

  onProgress({ stepId: 'cinema', status: 'done', data: result })
  return result
}
