export type VoiceGender = 'female' | 'male' | 'child';

export type PrebuiltVoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export type DialectId =
  | 'msa'
  | 'egyptian'
  | 'gulf'
  | 'levantine'
  | 'english_us'
  | 'english_uk';

export type EmotionId =
  | 'neutral'
  | 'joy'
  | 'sadness'
  | 'anger'
  | 'fear'
  | 'laughter'
  | 'crying'
  | 'horror'
  | 'excitement';

export type DeliveryModeId =
  | 'normal'
  | 'whisper'
  | 'shout'
  | 'dramatic'
  | 'storytelling'
  | 'news'
  | 'comedy';

export type SpeedLevel = 'very_slow' | 'slow' | 'normal' | 'fast' | 'very_fast';
export type PitchLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
export type PauseLevel = 'none' | 'short' | 'medium' | 'dramatic_long';

export interface VoiceCharacter {
  id: string;
  nameAr: string;
  nameEn: string;
  categoryAr: string;
  categoryEn: string;
  descriptionAr: string;
  descriptionEn: string;
  gender: VoiceGender;
  ageGroupAr: string;
  ageGroupEn: string;
  prebuiltVoice: PrebuiltVoiceName;
  baseStylePrompt: string;
  defaultPitch: PitchLevel;
  defaultDelivery: DeliveryModeId;
  sampleTextAr: string;
  sampleTextEn: string;
}

export interface VoiceSettings {
  language: 'ar' | 'en';
  dialect: DialectId;
  voiceGender: VoiceGender;
  speed: SpeedLevel;
  pitch: PitchLevel;
  emotion: EmotionId;
  emotionIntensity: number; // 10 to 100
  deliveryMode: DeliveryModeId;
  pauses: PauseLevel;
  customStyleNotes?: string;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  language: 'ar',
  dialect: 'msa',
  voiceGender: 'female',
  speed: 'normal',
  pitch: 'medium',
  emotion: 'neutral',
  emotionIntensity: 65,
  deliveryMode: 'normal',
  pauses: 'short',
  customStyleNotes: '',
};

export const VOICE_CHARACTERS: VoiceCharacter[] = [
  {
    id: 'young_girl',
    nameAr: 'صوت بنت شابة',
    nameEn: 'Young Teen Girl',
    categoryAr: 'شخصيات شابة',
    categoryEn: 'Youth',
    descriptionAr: 'نبرة حيوية معبّرة تناسب المحتوى الإبداعي، القصص الحديثة، والحوارات العاطفية.',
    descriptionEn: 'Expressive youthful female voice suited for modern dialogue, stories, and social content.',
    gender: 'female',
    ageGroupAr: '15–20 سنة',
    ageGroupEn: '15–20 yrs',
    prebuiltVoice: 'Zephyr',
    baseStylePrompt: 'A natural, expressive teenage girl voice with bright vocal clarity and youthful cadence',
    defaultPitch: 'high',
    defaultDelivery: 'normal',
    sampleTextAr: 'مرحبًا! هذه نبرتي الحقيقية، ويمكنني التعبير عن الفرح أو الدهشة أو الخوف بواقعية تامة.',
    sampleTextEn: 'Hi there! This is my natural voice, ready to express joy, curiosity, or dramatic emotion.',
  },
  {
    id: 'young_boy',
    nameAr: 'صوت ولد صغير',
    nameEn: 'Young Boy',
    categoryAr: 'أطفال وناشئة',
    categoryEn: 'Kids & Youth',
    descriptionAr: 'صوت صبي مفعم بالنشاط والفضول، مثالي لمشاهد المغامرات والألعاب والرسوم المتحركة.',
    descriptionEn: 'Energetic pre-teen boy voice ideal for adventures, gaming, and animated dialogue.',
    gender: 'child',
    ageGroupAr: '9–13 سنة',
    ageGroupEn: '9–13 yrs',
    prebuiltVoice: 'Puck',
    baseStylePrompt: 'A lively young boy around 10 years old, bright youthful timbre, curious and spirited delivery',
    defaultPitch: 'high',
    defaultDelivery: 'normal',
    sampleTextAr: 'يا إلهي! هل رأيت ما حدث للتو؟ هذه المغامرة ستكون مذهلة حقًا!',
    sampleTextEn: 'Whoa, did you just see that? This adventure is going to be awesome!',
  },
  {
    id: 'young_man',
    nameAr: 'صوت رجل شاب',
    nameEn: 'Young Man',
    categoryAr: 'شخصيات بالغة',
    categoryEn: 'Adults',
    descriptionAr: 'صوت رجولي شاب متوازن وواضح للإعلانات، الفيديوهات الوثائقية، والحوارات الدرامية.',
    descriptionEn: 'Balanced, confident young adult male voice for commercials, narration, and drama.',
    gender: 'male',
    ageGroupAr: '22–34 سنة',
    ageGroupEn: '22–34 yrs',
    prebuiltVoice: 'Puck',
    baseStylePrompt: 'A clear, warm young adult male voice in his late twenties with natural resonant articulation',
    defaultPitch: 'medium',
    defaultDelivery: 'normal',
    sampleTextAr: 'أهلاً بك في استوديو الأصوات الذكي، حيث تتحول كلماتك إلى أداء صوتي نابض بالحياة.',
    sampleTextEn: 'Welcome to the AI voice studio, where your written prompt becomes lifelike speech.',
  },
  {
    id: 'elderly_man',
    nameAr: 'صوت رجل كبير في السن',
    nameEn: 'Elderly Man',
    categoryAr: 'كبار السن والحكمة',
    categoryEn: 'Seniors',
    descriptionAr: 'نبرة عميقة وقورة ذات خبرة ودفء تاريخي تلائم الحكايات التراثية والشخصيات الحكيمة.',
    descriptionEn: 'Deep, weathered, wise elderly grandfatherly voice with measured pacing and warmth.',
    gender: 'male',
    ageGroupAr: '65+ سنة',
    ageGroupEn: '65+ yrs',
    prebuiltVoice: 'Charon',
    baseStylePrompt: 'An elderly man in his seventies with a deep, slightly raspy, warm and wise grandfatherly voice, unhurried cadence',
    defaultPitch: 'very_low',
    defaultDelivery: 'storytelling',
    sampleTextAr: 'اسمع يا بني، لقد علمتني السنون أن الصبر مفتاح كل باب مغلق في هذه الدنيا.',
    sampleTextEn: 'Listen closely, my child. The years have taught me that patience opens every locked door.',
  },
  {
    id: 'young_woman',
    nameAr: 'صوت امرأة شابة',
    nameEn: 'Young Woman',
    categoryAr: 'شخصيات بالغة',
    categoryEn: 'Adults',
    descriptionAr: 'صوت نسائي ناضج وواثق يناسب التقديم الاحترافي، التسويق، والكتب الصوتية.',
    descriptionEn: 'Poised, articulate young adult woman voice great for audiobooks, branding, and narration.',
    gender: 'female',
    ageGroupAr: '24–35 سنة',
    ageGroupEn: '24–35 yrs',
    prebuiltVoice: 'Kore',
    baseStylePrompt: 'A poised, expressive young adult woman voice with rich tone and natural studio clarity',
    defaultPitch: 'medium',
    defaultDelivery: 'normal',
    sampleTextAr: 'كل فكرة تبدأ بجملة مكتوبة، ومع الأداء الصوتي الصحيح تصل مباشرة إلى قلب المستمع.',
    sampleTextEn: 'Every idea begins as a written line, and with the right vocal performance it truly connects.',
  },
  {
    id: 'elderly_woman',
    nameAr: 'صوت امرأة كبيرة في السن',
    nameEn: 'Elderly Woman',
    categoryAr: 'كبار السن والحكمة',
    categoryEn: 'Seniors',
    descriptionAr: 'صوت جدة دافئ وحنون بإيقاع هادئ ومليء بالمشاعر والذكريات.',
    descriptionEn: 'Warm, gentle grandmotherly voice filled with tenderness, nostalgia, and calm wisdom.',
    gender: 'female',
    ageGroupAr: '65+ سنة',
    ageGroupEn: '65+ yrs',
    prebuiltVoice: 'Kore',
    baseStylePrompt: 'An elderly grandmother in her seventies, gentle slightly quavering warm voice, tender and nostalgic tone',
    defaultPitch: 'low',
    defaultDelivery: 'storytelling',
    sampleTextAr: 'تعال واجلس بجانبي يا حبيبي، سأحكي لك حكاية قديمة من أيام زمان.',
    sampleTextEn: 'Come sit beside me, dear, and let me tell you an old story from long ago.',
  },
  {
    id: 'little_girl',
    nameAr: 'صوت طفلة صغيرة',
    nameEn: 'Little Girl',
    categoryAr: 'أطفال وناشئة',
    categoryEn: 'Kids & Youth',
    descriptionAr: 'صوت طفولي بريء ورقيق يناسب قصص الأطفال، المشاهد المؤثرة، والحوارات العفوية.',
    descriptionEn: 'Innocent, high-pitched little girl voice with delicate childlike breath and emotion.',
    gender: 'child',
    ageGroupAr: '5–8 سنوات',
    ageGroupEn: '5–8 yrs',
    prebuiltVoice: 'Zephyr',
    baseStylePrompt: 'A very young little girl around 6 years old, high-pitched innocent childlike voice with soft delicate articulation',
    defaultPitch: 'very_high',
    defaultDelivery: 'normal',
    sampleTextAr: 'ماما! هل تسمعين هذا الصوت؟ أنا خائفة قليلاً ولا أريد البقاء وحدي هنا.',
    sampleTextEn: 'Mommy! Did you hear that noise? I am a little scared to stay here alone.',
  },
  {
    id: 'little_boy',
    nameAr: 'صوت طفل صغير',
    nameEn: 'Little Boy',
    categoryAr: 'أطفال وناشئة',
    categoryEn: 'Kids & Youth',
    descriptionAr: 'صوت طفل صغير عفوي وبريء مناسب للحكايات التعليمية وأفلام الأنيميشن.',
    descriptionEn: 'Playful, innocent little boy voice suited for children stories and animation.',
    gender: 'child',
    ageGroupAr: '4–7 سنوات',
    ageGroupEn: '4–7 yrs',
    prebuiltVoice: 'Puck',
    baseStylePrompt: 'A sweet 5-year-old little boy voice, high innocent child timbre, playful and sincere tone',
    defaultPitch: 'very_high',
    defaultDelivery: 'normal',
    sampleTextAr: 'انظر إلى السماء! الطائرة الورقية تطير عاليًا جدًا فوق الأشجار!',
    sampleTextEn: 'Look up at the sky! My paper kite is flying so high above the trees!',
  },
  {
    id: 'news_anchor',
    nameAr: 'صوت مذيع محترف',
    nameEn: 'Professional News Anchor',
    categoryAr: 'إعلام وإلقاء',
    categoryEn: 'Broadcast',
    descriptionAr: 'نبرة إذاعية رصينة وموثوقة للنشرات الإخبارية، التقارير الرسمية، والوثائقيات.',
    descriptionEn: 'Authoritative, crisp broadcast journalist voice built for news, bulletins, and documentaries.',
    gender: 'male',
    ageGroupAr: '30–45 سنة',
    ageGroupEn: '30–45 yrs',
    prebuiltVoice: 'Fenrir',
    baseStylePrompt: 'A seasoned broadcast news anchor with crisp authoritative diction, steady cadence, and studio resonance',
    defaultPitch: 'low',
    defaultDelivery: 'news',
    sampleTextAr: 'نشرة الأخبار المسائية: أعلنت اليوم تطورات كبرى في تقنيات التوليد الصوتي بالذكاء الاصطناعي.',
    sampleTextEn: 'Evening broadcast: Major breakthroughs in neural voice synthesis were announced earlier today.',
  },
  {
    id: 'storyteller',
    nameAr: 'صوت راوي قصص',
    nameEn: 'Master Storyteller',
    categoryAr: 'إعلام وإلقاء',
    categoryEn: 'Narration',
    descriptionAr: 'أداء سينمائي آسر يجذب المستمع في الروايات والبودكاست والقصص التاريخية.',
    descriptionEn: 'Captivating cinematic narrator voice ideal for audiobooks, podcasts, and epic tales.',
    gender: 'male',
    ageGroupAr: '35–50 سنة',
    ageGroupEn: '35–50 yrs',
    prebuiltVoice: 'Charon',
    baseStylePrompt: 'A rich, captivating cinematic storyteller and audiobook narrator with dynamic pauses and atmospheric warmth',
    defaultPitch: 'low',
    defaultDelivery: 'storytelling',
    sampleTextAr: 'في ليلةٍ حالكة السواد، حين سكنت الرياح، انفتح باب القصر القديم ببطء شديد.',
    sampleTextEn: 'On a pitch-black night, as the wind fell silent, the ancient palace doors slowly creaked open.',
  },
  {
    id: 'cartoon',
    nameAr: 'صوت شخصية كرتونية',
    nameEn: 'Cartoon Character',
    categoryAr: 'أداء تمثيلي',
    categoryEn: 'Character Acting',
    descriptionAr: 'نبرة مرحة ومبالغ فيها بإيقاع مرن يناسب الرسوم المتحركة والألعاب.',
    descriptionEn: 'Animated, bouncy, exaggerated cartoon voice full of quirky energy for games and animation.',
    gender: 'male',
    ageGroupAr: 'شخصية خيالية',
    ageGroupEn: 'Animated',
    prebuiltVoice: 'Puck',
    baseStylePrompt: 'An exaggerated, bouncy animated cartoon character voice, rubbery playful inflection and high expressive energy',
    defaultPitch: 'very_high',
    defaultDelivery: 'comedy',
    sampleTextAr: 'آها! لقد وجدت الكنز السري أخيرًا، لكن انتظر... لماذا يتحرك الصندوق؟!',
    sampleTextEn: 'Aha! I finally found the secret treasure, but wait... why is the chest moving?!',
  },
  {
    id: 'horror',
    nameAr: 'صوت مرعب ومخيف',
    nameEn: 'Horror & Eerie Voice',
    categoryAr: 'أداء تمثيلي',
    categoryEn: 'Character Acting',
    descriptionAr: 'صوت عميق غامض ومرتجف مليء بالتوتر والهمس المظلم لمشاهد الرعب والغموض.',
    descriptionEn: 'Chilling, dark, eerie horror voice with ominous low resonance and tense suspenseful breath.',
    gender: 'male',
    ageGroupAr: 'غامض',
    ageGroupEn: 'Eerie',
    prebuiltVoice: 'Charon',
    baseStylePrompt: 'A chilling, ominous horror character voice, dark gravelly low resonance, eerie slow pacing with unsettling whispers',
    defaultPitch: 'very_low',
    defaultDelivery: 'dramatic',
    sampleTextAr: 'لا تلتفت خلفك الآن... فالأصوات التي تسمعها ليست قادمة من الخارج.',
    sampleTextEn: 'Do not look behind you now... the footsteps you hear are coming from inside the room.',
  },
  {
    id: 'calm_soft',
    nameAr: 'صوت هادئ وناعم',
    nameEn: 'Calm & Soft Voice',
    categoryAr: 'تأمل وراحة',
    categoryEn: 'Wellness',
    descriptionAr: 'نبرة ناعمة مريحة للأعصاب تناسب التأمل، النوم، والمحتوى الإرشادي الهادئ.',
    descriptionEn: 'Soothing, silky-soft calming voice designed for meditation, mindfulness, and gentle narration.',
    gender: 'female',
    ageGroupAr: '25–35 سنة',
    ageGroupEn: '25–35 yrs',
    prebuiltVoice: 'Zephyr',
    baseStylePrompt: 'A soothing, ultra-calm soft female voice with gentle breathy warmth and peaceful meditative rhythm',
    defaultPitch: 'medium',
    defaultDelivery: 'normal',
    sampleTextAr: 'خذ نفسًا عميقًا الآن، ودع كل التوتر يتلاشى مع هدوء هذه اللحظة.',
    sampleTextEn: 'Take a slow, deep breath now, and let every bit of tension melt into stillness.',
  },
  {
    id: 'energetic',
    nameAr: 'صوت حماسي',
    nameEn: 'Energetic & Hype Voice',
    categoryAr: 'إعلان وتحفيز',
    categoryEn: 'Commercial & Hype',
    descriptionAr: 'طاقة عالية وإيقاع سريع متقد الحماس للإعلانات الترويجية، الرياضة، والبروموهات.',
    descriptionEn: 'High-voltage, punchy enthusiastic voice built for trailers, sports promos, and motivational ads.',
    gender: 'male',
    ageGroupAr: '25–38 سنة',
    ageGroupEn: '25–38 yrs',
    prebuiltVoice: 'Fenrir',
    baseStylePrompt: 'An explosive, high-energy motivational announcer and hype voice, punchy dynamic delivery and strong projection',
    defaultPitch: 'medium',
    defaultDelivery: 'dramatic',
    sampleTextAr: 'استعدوا للانطلاق! هذه فرصتك لصناعة محتوى صوتي مذهل يتجاوز كل التوقعات!',
    sampleTextEn: 'Get ready to launch! This is your moment to create jaw-dropping audio beyond limits!',
  },
  {
    id: 'comedic',
    nameAr: 'صوت كوميدي',
    nameEn: 'Comedic & Playful Voice',
    categoryAr: 'أداء تمثيلي',
    categoryEn: 'Comedy',
    descriptionAr: 'أداء ساخر وخفيف الظل مع توقيت كوميدي وضحكات عفوية تناسب الاسكتشات والمحتوى الترفيهي.',
    descriptionEn: 'Witty, comedic voice with playful timing, expressive chuckles, and sarcastic charm.',
    gender: 'male',
    ageGroupAr: '22–38 سنة',
    ageGroupEn: '22–38 yrs',
    prebuiltVoice: 'Puck',
    baseStylePrompt: 'A witty, playful comedic voice with expressive comedic timing, upbeat inflection, and lighthearted chuckle',
    defaultPitch: 'medium',
    defaultDelivery: 'comedy',
    sampleTextAr: 'بصراحة، كنت أظن أن القهوة ستساعدني على التركيز، لكنني نسيت أين وضعت الكوب أصلاً!',
    sampleTextEn: 'Honestly, I thought coffee would help me focus, until I forgot where I put the mug!',
  },
];

export interface SubscriptionPlan {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  price: number;
  currency: string;
  durationDays: number;
  featuresAr: string[];
  featuresEn: string[];
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface SiteSettings {
  siteName: string;
  taglineAr: string;
  taglineEn: string;
  registrationEnabled: boolean;
  maxCharsPerGeneration: number;
  dailyGenerationLimit: number;
  currency: string;
}

export type SubscriptionStatus = 'pending' | 'active' | 'expired' | 'rejected' | 'suspended';

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  selectedPlanId: string;
  status: SubscriptionStatus;
  subscriptionStart: string | null;
  subscriptionEnd: string | null;
  generationCount: number;
  createdAt: string;
  updatedAt: string;
}
