import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  VOICE_CHARACTERS,
  type DeliveryModeId,
  type DialectId,
  type EmotionId,
  type PitchLevel,
  type SpeedLevel,
  type VoiceCharacter,
  type VoiceGender,
  type VoiceSettings,
} from '../src/shared/voices.ts';

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface PromptAnalysisResult {
  spokenText: string;
  characterId: string;
  gender: VoiceGender;
  estimatedAge: string;
  language: 'ar' | 'en';
  dialect: DialectId;
  emotion: EmotionId;
  emotionIntensity: number;
  deliveryMode: DeliveryModeId;
  speed: SpeedLevel;
  pitch: PitchLevel;
  pauses: 'none' | 'short' | 'medium' | 'dramatic_long';
  styleDescription: string;
  summaryAr: string;
  summaryEn: string;
}

const VALID_CHARACTER_IDS = VOICE_CHARACTERS.map((v) => v.id);

export async function analyzeVoicePrompt(
  userPrompt: string
): Promise<PromptAnalysisResult> {
  const ai = getClient();

  const characterCatalog = VOICE_CHARACTERS.map(
    (v) =>
      `- "${v.id}": ${v.nameEn} (${v.nameAr}), gender=${v.gender}, age=${v.ageGroupEn}, desc=${v.descriptionEn}`
  ).join('\n');

  const systemInstruction = `You are a master Voice Casting & Audio Directing AI for VoicePrompt AI.
Analyze the user's Arabic or English prompt describing the desired voice, character, emotion, dialect, and speech.

Available characterIds:
${characterCatalog}

Rules:
1. Extract the exact spokenText that the character should say. If the prompt has quoted dialogue or text after ":" or "تقول:" or "يقول:", extract ONLY the dialogue to be spoken. If the prompt only describes a character/scenario without explicit spoken lines (e.g., "أريد صوت فتاة مصرية تتحدث بخوف"), invent a natural 1-2 sentence spoken line matching the requested language, dialect, and scenario.
2. Choose the single best characterId from the available list.
3. Determine gender (female, male, child), language (ar or en), dialect (msa for Modern Standard Arabic, egyptian for Egyptian Arabic, gulf, levantine, english_us, english_uk), emotion (neutral, joy, sadness, anger, fear, laughter, crying, horror, excitement), emotionIntensity (10-100), deliveryMode (normal, whisper, shout, dramatic, storytelling, news, comedy), speed (very_slow, slow, normal, fast, very_fast), pitch (very_low, low, medium, high, very_high), and pauses (none, short, medium, dramatic_long).
4. Write styleDescription in English as rich voice-acting direction (timbre, age, emotion, dialect/accent, pacing, breath/whisper/shout nuances).
5. Write summaryAr (concise Arabic summary of the casting & acting choices) and summaryEn (concise English summary).`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: userPrompt,
    config: {
      systemInstruction,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          spokenText: { type: Type.STRING },
          characterId: { type: Type.STRING },
          gender: { type: Type.STRING },
          estimatedAge: { type: Type.STRING },
          language: { type: Type.STRING },
          dialect: { type: Type.STRING },
          emotion: { type: Type.STRING },
          emotionIntensity: { type: Type.INTEGER },
          deliveryMode: { type: Type.STRING },
          speed: { type: Type.STRING },
          pitch: { type: Type.STRING },
          pauses: { type: Type.STRING },
          styleDescription: { type: Type.STRING },
          summaryAr: { type: Type.STRING },
          summaryEn: { type: Type.STRING },
        },
        required: [
          'spokenText',
          'characterId',
          'gender',
          'estimatedAge',
          'language',
          'dialect',
          'emotion',
          'emotionIntensity',
          'deliveryMode',
          'speed',
          'pitch',
          'pauses',
          'styleDescription',
          'summaryAr',
          'summaryEn',
        ],
      },
    },
  });

  const rawText = (response.text ?? '').trim();
  if (!rawText) {
    throw new Error('AI prompt analyzer returned an empty response.');
  }

  const parsed = JSON.parse(rawText) as Partial<PromptAnalysisResult>;

  const safeCharId = VALID_CHARACTER_IDS.includes(parsed.characterId ?? '')
    ? (parsed.characterId as string)
    : 'young_woman';

  const safeGender: VoiceGender =
    parsed.gender === 'male' || parsed.gender === 'female' || parsed.gender === 'child'
      ? parsed.gender
      : 'female';

  const safeLang: 'ar' | 'en' = parsed.language === 'en' ? 'en' : 'ar';

  const validDialects: DialectId[] = [
    'msa',
    'egyptian',
    'gulf',
    'levantine',
    'english_us',
    'english_uk',
  ];
  const safeDialect: DialectId = validDialects.includes(parsed.dialect as DialectId)
    ? (parsed.dialect as DialectId)
    : safeLang === 'en'
    ? 'english_us'
    : 'msa';

  const validEmotions: EmotionId[] = [
    'neutral',
    'joy',
    'sadness',
    'anger',
    'fear',
    'laughter',
    'crying',
    'horror',
    'excitement',
  ];
  const safeEmotion: EmotionId = validEmotions.includes(parsed.emotion as EmotionId)
    ? (parsed.emotion as EmotionId)
    : 'neutral';

  const validDeliveries: DeliveryModeId[] = [
    'normal',
    'whisper',
    'shout',
    'dramatic',
    'storytelling',
    'news',
    'comedy',
  ];
  const safeDelivery: DeliveryModeId = validDeliveries.includes(
    parsed.deliveryMode as DeliveryModeId
  )
    ? (parsed.deliveryMode as DeliveryModeId)
    : 'normal';

  const validSpeeds: SpeedLevel[] = ['very_slow', 'slow', 'normal', 'fast', 'very_fast'];
  const safeSpeed: SpeedLevel = validSpeeds.includes(parsed.speed as SpeedLevel)
    ? (parsed.speed as SpeedLevel)
    : 'normal';

  const validPitches: PitchLevel[] = ['very_low', 'low', 'medium', 'high', 'very_high'];
  const safePitch: PitchLevel = validPitches.includes(parsed.pitch as PitchLevel)
    ? (parsed.pitch as PitchLevel)
    : 'medium';

  const validPauses = ['none', 'short', 'medium', 'dramatic_long'] as const;
  const safePauses = validPauses.includes(parsed.pauses as (typeof validPauses)[number])
    ? (parsed.pauses as (typeof validPauses)[number])
    : 'short';

  const intensity = Math.min(100, Math.max(10, Number(parsed.emotionIntensity || 65)));

  return {
    spokenText: (parsed.spokenText || userPrompt).trim(),
    characterId: safeCharId,
    gender: safeGender,
    estimatedAge: parsed.estimatedAge || 'Adult',
    language: safeLang,
    dialect: safeDialect,
    emotion: safeEmotion,
    emotionIntensity: intensity,
    deliveryMode: safeDelivery,
    speed: safeSpeed,
    pitch: safePitch,
    pauses: safePauses,
    styleDescription: parsed.styleDescription || 'Natural expressive studio speech',
    summaryAr: parsed.summaryAr || 'تم تحليل الوصف وضبط الشخصية والمشاعر المناسبة.',
    summaryEn: parsed.summaryEn || 'Prompt analyzed and voice settings configured.',
  };
}

function buildSpeechStyleDirection(
  character: VoiceCharacter,
  settings: VoiceSettings
): string {
  const dialectMap: Record<DialectId, string> = {
    msa: 'Speak in eloquent, crisp Modern Standard Arabic (العربية الفصحى)',
    egyptian: 'Speak in authentic natural Egyptian Arabic dialect (اللهجة المصرية العامية)',
    gulf: 'Speak in natural Gulf Arabic dialect (اللهجة الخليجية)',
    levantine: 'Speak in natural Levantine Arabic dialect (اللهجة الشامية)',
    english_us: 'Speak in natural American English',
    english_uk: 'Speak in articulate British English',
  };

  const emotionMap: Record<EmotionId, string> = {
    neutral: 'calm, balanced natural emotion',
    joy: 'warm, joyful, smiling vocal warmth',
    sadness: 'sorrowful, heavy-hearted, melancholic tone',
    anger: 'intense, firm, frustrated anger',
    fear: 'trembling, frightened, anxious fear',
    laughter: 'cheerful, amused with light natural laughter',
    crying: 'tearful, choked-up, sobbing vulnerability',
    horror: 'terrified, eerie, spine-chilling dread',
    excitement: 'thrilled, electrified, high-enthusiasm energy',
  };

  const deliveryMap: Record<DeliveryModeId, string> = {
    normal: 'natural conversational delivery',
    whisper: 'hushed, intimate, quiet breathy whisper',
    shout: 'loud, urgent, projecting shout',
    dramatic: 'theatrical, cinematic, emotionally charged performance',
    storytelling: 'captivating narrative storytelling cadence',
    news: 'crisp, authoritative broadcast news anchor diction',
    comedy: 'playful, witty comedic timing',
  };

  const speedMap: Record<SpeedLevel, string> = {
    very_slow: 'very slow deliberate pace',
    slow: 'slow unhurried pace',
    normal: 'natural steady pace',
    fast: 'brisk energetic pace',
    very_fast: 'rapid urgent pace',
  };

  const pitchMap: Record<PitchLevel, string> = {
    very_low: 'very deep low vocal pitch',
    low: 'warm low vocal pitch',
    medium: 'balanced natural pitch',
    high: 'bright higher vocal pitch',
    very_high: 'high-pitched youthful/childlike timbre',
  };

  const pauseMap = {
    none: 'continuous flow with minimal pauses',
    short: 'brief natural pauses between phrases',
    medium: 'deliberate reflective pauses between sentences',
    dramatic_long: 'long suspenseful dramatic pauses between phrases',
  };

  const genderHint =
    settings.voiceGender === 'child'
      ? 'childlike vocal resonance'
      : settings.voiceGender === 'female'
      ? 'female vocal timbre'
      : 'male vocal timbre';

  const parts = [
    character.baseStylePrompt,
    genderHint,
    dialectMap[settings.dialect] || dialectMap.msa,
    `Emotion (${settings.emotionIntensity}% intensity): ${emotionMap[settings.emotion]}`,
    `Delivery: ${deliveryMap[settings.deliveryMode]}`,
    `Pacing: ${speedMap[settings.speed]}, ${pauseMap[settings.pauses]}`,
    `Pitch: ${pitchMap[settings.pitch]}`,
  ];

  if (settings.customStyleNotes && settings.customStyleNotes.trim()) {
    parts.push(`Acting notes: ${settings.customStyleNotes.trim()}`);
  }

  return parts.join('. ');
}

function enrichSpokenTextWithVocalCues(text: string, settings: VoiceSettings): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  // Avoid doubling existing tags if already present
  if (trimmed.includes('<breath>') || trimmed.includes('<gasp>') || trimmed.includes('<laugh>')) {
    return trimmed;
  }

  if (settings.emotion === 'fear' || settings.emotion === 'horror') {
    return `<gasp> ${trimmed}`;
  }
  if (settings.emotion === 'crying' || settings.emotion === 'sadness') {
    return `<breath> ${trimmed}`;
  }
  if (settings.emotion === 'laughter') {
    return `<laugh> ${trimmed}`;
  }
  return trimmed;
}

export function calculateWavDurationSeconds(wavBuffer: Buffer): number {
  if (wavBuffer.length <= 44) return 0;
  // Standard RIFF WAV header: byteRate at offset 28 (UInt32LE), sampleRate at 24
  try {
    const riff = wavBuffer.subarray(0, 4).toString('ascii');
    if (riff === 'RIFF') {
      const byteRate = wavBuffer.readUInt32LE(28);
      if (byteRate > 0) {
        return Number(((wavBuffer.length - 44) / byteRate).toFixed(2));
      }
    }
  } catch {
    // fallback below
  }
  // Gemini 3.8 TTS default: 24kHz, mono, 16-bit = 48000 bytes/sec
  return Number(((wavBuffer.length - 44) / 48000).toFixed(2));
}

export interface GeneratedSpeechResult {
  audioBase64: string;
  mimeType: 'audio/wav';
  durationSeconds: number;
  characterUsed: string;
}

function ensureWavBuffer(rawBuffer: Buffer, mimeType?: string): Buffer {
  if (rawBuffer.length >= 12 && rawBuffer.subarray(0, 4).toString('ascii') === 'RIFF') {
    return rawBuffer;
  }

  // Raw PCM (e.g. audio/L16;codec=pcm;rate=24000) -> wrap in 44-byte RIFF WAV header
  let sampleRate = 24000;
  if (mimeType) {
    const rateMatch = mimeType.match(/rate=(\d+)/i);
    if (rateMatch) {
      const parsed = Number(rateMatch[1]);
      if (parsed >= 8000 && parsed <= 96000) sampleRate = parsed;
    }
  }

  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = rawBuffer.length;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, rawBuffer]);
}

function formatGeminiError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('"code":429')) {
    return new Error(
      'تم استهلاك الحد اليومي المجاني لموديل الصوت حاليًا (429). يرجى المحاولة لاحقًا أو ترقية مفتاح Gemini API في الإعدادات.'
    );
  }
  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED')) {
    return new Error('مفتاح Gemini API غير صالح أو يفتقر للصلاحيات في إعدادات الخادم.');
  }
  return err instanceof Error ? err : new Error(raw);
}

async function callTtsModel(
  ai: GoogleGenAI,
  model: 'gemini-3.8-flash-tts' | 'gemini-3.8-flash-lite-tts',
  preparedText: string,
  styleDirection: string,
  voiceName: string
) {
  return ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: preparedText,
            speechMetadata: {
              style: styleDirection,
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName,
          },
        },
      },
    },
  });
}

export async function generateExpressiveSpeech(params: {
  spokenText: string;
  characterId: string;
  settings: VoiceSettings;
  preferLite?: boolean;
}): Promise<GeneratedSpeechResult> {
  const ai = getClient();
  const character =
    VOICE_CHARACTERS.find((v) => v.id === params.characterId) || VOICE_CHARACTERS[0];

  const styleDirection = buildSpeechStyleDirection(character, params.settings);
  const preparedText = params.preferLite
    ? params.spokenText.trim()
    : enrichSpokenTextWithVocalCues(params.spokenText, params.settings);

  const primaryModel = params.preferLite
    ? 'gemini-3.8-flash-lite-tts'
    : 'gemini-3.8-flash-tts';

  let response;
  try {
    response = await callTtsModel(
      ai,
      primaryModel,
      preparedText,
      styleDirection,
      character.prebuiltVoice
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isQuota = msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429');
    if (isQuota && primaryModel === 'gemini-3.8-flash-tts') {
      try {
        response = await callTtsModel(
          ai,
          'gemini-3.8-flash-lite-tts',
          params.spokenText.trim(),
          styleDirection,
          character.prebuiltVoice
        );
      } catch (fallbackErr) {
        throw formatGeminiError(fallbackErr);
      }
    } else {
      throw formatGeminiError(err);
    }
  }

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const audioPart = parts.find((p) => p.inlineData?.data);
  const base64Audio = audioPart?.inlineData?.data;
  const returnedMime = audioPart?.inlineData?.mimeType;

  if (!base64Audio) {
    throw new Error('Speech synthesis did not return audio data from the AI provider.');
  }

  const rawBuffer = Buffer.from(base64Audio, 'base64');
  const wavBuffer = ensureWavBuffer(rawBuffer, returnedMime);
  const durationSeconds = calculateWavDurationSeconds(wavBuffer);

  return {
    audioBase64: wavBuffer.toString('base64'),
    mimeType: 'audio/wav',
    durationSeconds,
    characterUsed: character.id,
  };
}
