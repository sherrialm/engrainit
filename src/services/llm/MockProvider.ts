/**
 * Mock LLM Provider
 *
 * Deterministic implementation of LLMProvider that returns
 * 4 NLP-aligned affirmation options without calling any
 * external API. Used during development and testing.
 *
 * All templates follow NLP constraints:
 *  - Present tense
 *  - Positive framing (no "not" / "never")
 *  - Identity-based phrasing ("I am / I choose / I practice / I become")
 *  - 8–22 words each
 *  - Believability-first scaffolding for low scores
 */

import {
    LLMProvider,
    RefineAffirmationInput,
    AffirmationCategory,
    AffirmationTone,
    GenerateLoopInput,
    GenerateLoopOutput,
    GenerateMemoryAidsInput,
    GenerateMemoryAidsOutput,
    GenerateBriefingInput,
} from './LLMProvider';

// ── Believability band ────────────────────────────────────────

type BelievabilityBand = 'low' | 'mid' | 'high';

function getBand(believability: number): BelievabilityBand {
    if (believability <= 40) return 'low';
    if (believability <= 70) return 'mid';
    return 'high';
}

// ── Template bank ─────────────────────────────────────────────
// Organised as  category → tone → believability band → string[]
// Each array has exactly 4 entries.

type TemplateBank = Record<
    AffirmationCategory,
    Record<AffirmationTone, Record<BelievabilityBand, string[]>>
>;

const TEMPLATES: TemplateBank = {
    Faith: {
        Gentle: {
            low: [
                'I am learning to trust the path that is unfolding before me each day',
                'I am opening my heart to peace and allowing faith to grow within me',
                'I choose to rest in the knowledge that I am guided and supported always',
                'I am beginning to believe that grace surrounds me in every moment',
            ],
            mid: [
                'I walk in faith and trust the purpose woven into my daily life',
                'I am grounded in hope and carry peace with me wherever I go',
                'I choose to see blessings around me and gratitude fills my heart each day',
                'I practice stillness and allow my faith to strengthen with each sunrise',
            ],
            high: [
                'I am deeply rooted in faith and move through life with divine confidence',
                'I carry unwavering trust in my purpose and walk boldly in my calling',
                'I am a vessel of peace and my faith lights the way for others',
                'I embody grace and my spirit radiates the love I have received abundantly',
            ],
        },
        Mentor: {
            low: [
                'I am exploring what faith means to me and taking small steps forward',
                'I choose to stay curious about my spiritual growth and remain open daily',
                'I am building a foundation of belief one honest thought at a time',
                'I practice patience with myself as I discover deeper layers of trust',
            ],
            mid: [
                'I honour my spiritual journey and grow stronger in faith every single day',
                'I am committed to deepening my trust and showing up with an open heart',
                'I choose clarity over confusion and let faith guide my important decisions',
                'I practice discipline in my spiritual life and it strengthens my inner resolve',
            ],
            high: [
                'I lead with faith and inspire others through my consistent daily devotion',
                'I am a disciplined believer who turns conviction into purposeful compassionate action',
                'I stand firm in my beliefs and move mountains with confident faithful action',
                'I embody spiritual leadership and my example encourages those who walk beside me',
            ],
        },
        Bold: {
            low: [
                'I am choosing to step toward faith even when the road feels uncertain',
                'I release doubt and welcome courage as I begin this journey of belief',
                'I am brave enough to ask questions and let my faith evolve naturally',
                'I choose growth over fear and allow my spirit to expand each day',
            ],
            mid: [
                'I declare my faith boldly and let it fuel every action I take',
                'I am fearless in my devotion and rise above every challenge with grace',
                'I choose to speak life over my circumstances and stand firm in belief',
                'I practice courage daily and my faith transforms obstacles into stepping stones forward',
            ],
            high: [
                'I am an unstoppable force of faith and purpose in everything I pursue',
                'I command my day with spiritual authority and walk in complete divine alignment',
                'I rise with power and let my unshakeable faith define every bold step',
                'I am a warrior of light and my conviction moves the world around me',
            ],
        },
        Calm: {
            low: [
                'I am gently discovering a sense of peace that grows within me daily',
                'I allow myself to breathe deeply and trust the process of spiritual growth',
                'I am finding comfort in stillness and letting calm guide my seeking heart',
                'I choose serenity over anxiety and take each moment as it comes peacefully',
            ],
            mid: [
                'I dwell in peace and let my calm spirit reflect the faith I carry',
                'I am centred and still and my quiet confidence speaks louder than words',
                'I choose tranquillity in every situation and my faith anchors me through storms',
                'I practice surrendering worry and embrace the calm assurance of being held safely',
            ],
            high: [
                'I am an ocean of calm and my deep faith sustains me effortlessly',
                'I radiate peace in every room and my stillness inspires those around me',
                'I embody serene confidence and my unwavering faith is my greatest quiet strength',
                'I am completely at peace and my spirit rests in total divine assurance',
            ],
        },
    },

    Study: {
        Gentle: {
            low: [
                'I am opening my mind to new knowledge and allowing myself to learn gently',
                'I choose to approach my studies with curiosity and patience every single day',
                'I am building study habits that feel sustainable and supportive of my growth',
                'I welcome clarity into my learning and trust that understanding will come naturally',
            ],
            mid: [
                'I recall information with increasing ease and enjoy the process of deep learning',
                'I am a focused learner who absorbs knowledge and applies it with growing confidence',
                'I choose consistency in my studies and celebrate every small step of progress',
                'I practice active recall daily and my understanding deepens with each study session',
            ],
            high: [
                'I am a dedicated scholar who retains and applies knowledge with effortless clarity',
                'I master new material quickly and my disciplined study habits produce outstanding results',
                'I embody intellectual curiosity and my consistent effort makes learning feel deeply rewarding',
                'I am confident in my ability to learn anything and recall it with precision',
            ],
        },
        Mentor: {
            low: [
                'I am developing study strategies that work for my unique style of learning',
                'I choose to seek guidance and build a strong academic foundation step by step',
                'I am learning to focus deeply and my concentration improves with regular practice',
                'I practice showing up for my studies even when motivation feels hard to find',
            ],
            mid: [
                'I approach every study session with intention and leave with measurable new understanding',
                'I am disciplined in my learning and I review material consistently and strategically each week',
                'I choose to prioritise my education and it shapes the future I am building',
                'I practice effective study techniques and my recall becomes sharper with each passing day',
            ],
            high: [
                'I am a master learner who extracts and retains key insights with remarkable efficiency',
                'I lead my academic pursuits with discipline and my results reflect my consistent effort',
                'I teach what I learn and this deepens my own understanding and recall powerfully',
                'I embody academic excellence and inspire others through my commitment to lifelong learning habits',
            ],
        },
        Bold: {
            low: [
                'I am ready to challenge myself and push through study barriers with determination',
                'I choose to tackle difficult subjects head on and grow stronger with each attempt',
                'I am brave in my pursuit of knowledge and refuse to let difficulty stop me',
                'I embrace the struggle of learning because I know breakthrough is on the other side',
            ],
            mid: [
                'I attack my study goals with energy and my effort produces consistent measurable results',
                'I am relentless in my pursuit of mastery and I show up prepared every day',
                'I choose excellence over mediocrity and my bold study habits set me apart clearly',
                'I practice pushing past comfort zones and my academic growth accelerates with each challenge',
            ],
            high: [
                'I am an academic powerhouse who conquers every subject with focus and fierce determination',
                'I dominate my study sessions and retain information with speed and lasting accuracy daily',
                'I rise to every intellectual challenge and my bold preparation guarantees outstanding achievements always',
                'I am unstoppable in my learning and my results speak to my relentless disciplined effort',
            ],
        },
        Calm: {
            low: [
                'I am creating a calm study environment where my mind feels safe to absorb',
                'I choose to learn at my own pace and trust that progress is happening',
                'I am releasing study anxiety and replacing it with gentle focused curiosity each day',
                'I practice breathing deeply before I study and my mind becomes clear and receptive',
            ],
            mid: [
                'I study with calm focus and my relaxed mind absorbs information with natural ease',
                'I am at peace with my learning journey and trust my steady consistent progress',
                'I choose to approach exams and reviews with quiet confidence and thorough preparation always',
                'I practice mindful studying and my serene focus leads to deep lasting comprehension daily',
            ],
            high: [
                'I am a calm and brilliant learner who recalls knowledge effortlessly under any pressure',
                'I radiate intellectual confidence and my peaceful study habits produce exceptional consistent results always',
                'I embody tranquil mastery and my composed mind excels in every academic challenge I face',
                'I am serenely confident in my knowledge and my calm focus is my greatest academic asset',
            ],
        },
    },

    Vision: {
        Gentle: {
            low: [
                'I am beginning to see a future that excites me and fills me with hope',
                'I choose to nurture my dreams gently and allow my vision to take shape',
                'I am giving myself permission to dream bigger and explore new possibilities each day',
                'I welcome clarity about my direction and trust that my path is becoming clearer',
            ],
            mid: [
                'I am committed to my vision and take meaningful steps toward it every single day',
                'I choose to align my daily actions with the future I am deliberately creating',
                'I am building momentum toward my goals and I can feel progress in my spirit',
                'I practice visualising my success and this fuels my motivation to follow through consistently',
            ],
            high: [
                'I am the architect of my future and every decision moves me closer to greatness',
                'I embody my vision fully and my unwavering commitment turns dreams into tangible reality',
                'I live with purpose and direction and my clear vision attracts the right opportunities',
                'I am a visionary leader who executes with precision and inspires others along the way',
            ],
        },
        Mentor: {
            low: [
                'I am learning to define what I truly want and taking the first brave steps',
                'I choose to seek wise counsel and shape a vision that aligns with my values',
                'I am developing the discipline to plan my future with intention and careful thought',
                'I practice goal setting and my vision becomes more concrete with each honest reflection',
            ],
            mid: [
                'I approach my vision with strategic thinking and break big dreams into actionable plans',
                'I am disciplined in pursuing my goals and my consistent effort creates real forward momentum',
                'I choose accountability and surround myself with people who challenge me to reach higher',
                'I practice reviewing my progress weekly and recalibrate my actions to stay on course',
            ],
            high: [
                'I am a strategic executor who turns ambitious visions into measurable accomplished milestones daily',
                'I lead with clarity and purpose and my disciplined approach guarantees remarkable consistent progress',
                'I mentor others while pursuing my own vision because shared growth multiplies lasting impact',
                'I embody visionary leadership and my track record of follow through speaks for itself clearly',
            ],
        },
        Bold: {
            low: [
                'I am daring to dream beyond my current circumstances and believe change is possible',
                'I choose to take bold first steps toward a life that truly reflects my desires',
                'I am releasing old limitations and making space for a bigger bolder future ahead',
                'I practice courage in my planning and allow myself to pursue goals that excite me',
            ],
            mid: [
                'I declare my vision with confidence and take decisive action toward it every single day',
                'I am fearless in chasing my dreams and obstacles only fuel my drive forward',
                'I choose to bet on myself and my bold commitment creates extraordinary forward momentum daily',
                'I practice audacious goal setting and my relentless pursuit turns vision into lived reality',
            ],
            high: [
                'I am a force of nature who manifests bold visions with unstoppable energy and focus',
                'I command my destiny and my courageous actions create the extraordinary life I deserve fully',
                'I rise above every limitation and my bold vision reshapes the world around me dramatically',
                'I am the definition of follow through and my fierce commitment delivers remarkable results always',
            ],
        },
        Calm: {
            low: [
                'I am quietly envisioning a future that brings me deep satisfaction and inner peace',
                'I choose to hold my dreams gently and trust the timing of my unique journey',
                'I am finding calm clarity about my direction and letting my vision unfold naturally',
                'I practice patience with my progress and trust that every small step truly matters',
            ],
            mid: [
                'I move toward my vision with calm determination and steady unwavering daily commitment',
                'I am peacefully aligned with my purpose and my quiet confidence guides every decision',
                'I choose to trust the process and my serene focus keeps me on track consistently',
                'I practice mindful goal pursuit and my balanced approach creates sustainable meaningful progress always',
            ],
            high: [
                'I am serenely powerful and my calm vision manifests with grace and perfect timing',
                'I radiate quiet authority and my composed pursuit of excellence attracts remarkable achievements daily',
                'I embody peaceful ambition and my tranquil determination creates lasting impact wherever I go',
                'I am calmly unstoppable and my vision unfolds exactly as I have designed it beautifully',
            ],
        },
    },

    Habits: {
        Gentle: {
            low: [
                'I am exploring small daily habits that support the person I want to become',
                'I choose to be kind to myself as I build new routines one step at',
                'I am planting seeds of positive habits and trusting they will grow over time',
                'I welcome gentle consistency into my life and celebrate each small win along the way',
            ],
            mid: [
                'I am a person who shows up for my daily habits with gentle steady consistency',
                'I choose to honour my routines because they shape the identity I am building daily',
                'I practice micro actions every day and they compound into meaningful lasting positive change',
                'I am building an identity rooted in healthy habits that support my best self naturally',
            ],
            high: [
                'I am defined by my daily habits and they reflect the excellence I embody fully',
                'I effortlessly maintain powerful routines that elevate my health mind and spirit every day',
                'I embody discipline with grace and my consistent habits create an extraordinary quality of life',
                'I am the person who always follows through and my habits prove my deep commitment',
            ],
        },
        Mentor: {
            low: [
                'I am learning which daily habits serve me best and adjusting my approach with care',
                'I choose to start with one small habit and build momentum from that single anchor',
                'I am developing self awareness about my routines and making intentional improvements each week',
                'I practice habit stacking and connect new actions to routines I already do consistently',
            ],
            mid: [
                'I am disciplined in my daily routines and my habits reflect my deepest core values',
                'I choose accountability for my habits and track my progress with honest regular reflection',
                'I practice the identity of the person I want to be through my daily actions',
                'I am strategic about my habits and prioritise the ones with the highest positive impact',
            ],
            high: [
                'I am a master of daily discipline and my habits are the engine of my success',
                'I lead by example and my impeccable routines inspire others to elevate their own lives',
                'I embody habit mastery and my systems run smoothly producing remarkable consistent results every day',
                'I am the architect of my daily life and every habit is deliberately chosen for growth',
            ],
        },
        Bold: {
            low: [
                'I am ready to break old patterns and create bold new habits starting right now',
                'I choose to challenge myself with one powerful daily action that changes my trajectory',
                'I am brave enough to try new routines and learn what works best for me',
                'I practice stepping outside my comfort zone and building habits that demand my best effort',
            ],
            mid: [
                'I attack my daily habits with energy and my intensity creates rapid positive transformation',
                'I am relentless about my routines and I refuse to let excuses derail my progress',
                'I choose to raise my standards and my bold daily habits reflect that elevated commitment',
                'I practice extreme ownership of my day and every habit is a declaration of intent',
            ],
            high: [
                'I am a powerhouse of daily discipline and my habits crush mediocrity at every turn',
                'I dominate my routines with fierce focus and my results are proof of total commitment',
                'I rise with purpose and my bold micro actions compound into extraordinary life changing results',
                'I am unstoppable in my daily practice and my habits define a life of excellence',
            ],
        },
        Calm: {
            low: [
                'I am gently introducing calm productive habits into my daily life at my own pace',
                'I choose to build routines that feel soothing and sustainable for my mind and body',
                'I am finding peace in simple daily actions that support my overall wellbeing each day',
                'I practice self compassion as I develop habits and trust that consistency will come naturally',
            ],
            mid: [
                'I flow through my daily habits with calm focus and they nourish my spirit deeply',
                'I am peacefully consistent and my gentle routines create powerful lasting positive change over time',
                'I choose tranquil discipline and my calm approach to habits produces remarkable sustained results daily',
                'I practice mindful habit building and each routine becomes a source of inner peace for me',
            ],
            high: [
                'I am serenely disciplined and my calm daily habits create an extraordinary balanced fulfilled life',
                'I radiate peaceful productivity and my effortless routines inspire deep admiration from those around me',
                'I embody calm mastery of my daily life and every habit flows with intentional graceful ease',
                'I am the picture of tranquil consistency and my habits sustain lasting excellence in all areas',
            ],
        },
    },
};

// ── Faith-style overrides ─────────────────────────────────────
// When faithStyle is true and category is Faith, swap in
// templates that include "With God's help…" phrasing.

const FAITH_STYLE_TEMPLATES: Record<AffirmationTone, Record<BelievabilityBand, string[]>> = {
    Gentle: {
        low: [
            'With God\'s help I am learning to trust the path He has set before me',
            'I am opening my heart to His peace and allowing faith to grow within me',
            'I choose to rest in knowing that God guides and supports me every day',
            'I am beginning to believe that His grace surrounds me in every quiet moment',
        ],
        mid: [
            'With God\'s help I walk in faith and trust the purpose He has for me',
            'I am grounded in His hope and carry His peace with me wherever I go',
            'I choose to see His blessings around me and gratitude fills my heart daily',
            'With God\'s help I practice stillness and my faith strengthens with each new sunrise',
        ],
        high: [
            'With God\'s help I am deeply rooted in faith and move with divine confidence',
            'I carry unwavering trust in His purpose and walk boldly in my sacred calling',
            'I am a vessel of His peace and my faith lights the way for others',
            'With God\'s help I embody grace and radiate the love He has given me',
        ],
    },
    Mentor: {
        low: [
            'With God\'s help I am exploring what faith means and taking steps forward daily',
            'I choose to stay curious about my spiritual growth with His guidance beside me',
            'With God\'s help I build a foundation of belief one honest thought at a time',
            'I practice patience with myself as God reveals deeper layers of trust to me',
        ],
        mid: [
            'With God\'s help I honour my spiritual journey and grow stronger in faith daily',
            'I am committed to deepening my trust in Him and showing up with openness',
            'With God\'s help I choose clarity over confusion and let faith guide my decisions',
            'I practice discipline in my spiritual life and God strengthens my inner resolve daily',
        ],
        high: [
            'With God\'s help I lead with faith and inspire others through my daily devotion',
            'I am a disciplined believer who turns conviction into purposeful action through His power',
            'With God\'s help I stand firm in my beliefs and move mountains with confidence',
            'I embody spiritual leadership and God uses my example to encourage those around me',
        ],
    },
    Bold: {
        low: [
            'With God\'s help I choose to step toward faith even when the road feels uncertain',
            'I release doubt and welcome courage as God walks with me on this journey',
            'With God\'s help I am brave enough to ask questions and let faith evolve',
            'I choose growth over fear and with God\'s help my spirit expands each day',
        ],
        mid: [
            'With God\'s help I declare my faith boldly and let it fuel every action',
            'I am fearless in my devotion and with God\'s help I rise above challenges',
            'With God\'s help I speak life over my circumstances and stand firm in belief',
            'I practice courage daily and God transforms my obstacles into stepping stones forward always',
        ],
        high: [
            'With God\'s help I am an unstoppable force of faith and divine purpose daily',
            'I command my day with spiritual authority through the power God has given me',
            'With God\'s help I rise with power and let unshakeable faith define every step',
            'I am a warrior of light and God\'s conviction moves the world through me',
        ],
    },
    Calm: {
        low: [
            'With God\'s help I am gently discovering a peace that grows within me daily',
            'I allow myself to breathe deeply and trust God\'s process of spiritual growth',
            'With God\'s help I find comfort in stillness and let calm guide my heart',
            'I choose serenity over anxiety and with God\'s help I take each moment peacefully',
        ],
        mid: [
            'With God\'s help I dwell in peace and my calm spirit reflects deep faith',
            'I am centred and still and God\'s quiet confidence speaks louder than my words',
            'With God\'s help I choose tranquillity and my faith anchors me through every storm',
            'I practice surrendering worry to God and embrace the calm assurance of being held',
        ],
        high: [
            'With God\'s help I am an ocean of calm sustained by deep abiding faith',
            'I radiate His peace in every room and my stillness inspires those around me',
            'With God\'s help I embody serene confidence and unwavering faith is my greatest strength',
            'I am completely at peace and my spirit rests in God\'s total loving assurance',
        ],
    },
};

// ── Mock Provider ─────────────────────────────────────────────

export class MockProvider implements LLMProvider {
    async refineAffirmations(input: RefineAffirmationInput): Promise<string[]> {
        const band = getBand(input.believability);

        // Use faith-style templates when the flag is on and category is Faith
        if (input.category === 'Faith' && input.faithStyle) {
            return FAITH_STYLE_TEMPLATES[input.tone][band];
        }

        return TEMPLATES[input.category][input.tone][band];
    }

    async generateLoop(_input: GenerateLoopInput): Promise<GenerateLoopOutput> {
        // Deterministic mock responses — optimised for repetition (20-50 words)
        const loopVariants: GenerateLoopOutput[] = [
            {
                name: 'Morning Focus',
                text: 'I am focused and steady.\nMy mind is clear, my energy is calm.\nI finish the first task before noon.\nI move with purpose.',
                voiceId: 'focused-coach',
                intervalSeconds: 240,
            },
            {
                name: 'Calm Reset',
                text: 'I release tension from my body.\nI breathe deeply and allow peace in.\nI am safe in this moment.\nI choose stillness and clarity.',
                voiceId: 'calm-mentor',
                intervalSeconds: 180,
            },
            {
                name: 'Confidence Builder',
                text: 'I am capable and prepared.\nEvery challenge sharpens me.\nI speak with conviction.\nI act with boldness.',
                voiceId: 'focused-coach',
                intervalSeconds: 240,
            },
            {
                name: 'Steady Discipline',
                text: 'I show up every day.\nDiscipline is my foundation.\nI create momentum through action.\nI am building the life I want.',
                voiceId: 'david',
                intervalSeconds: 240,
            },
        ];

        // Simple rotation based on prompt length
        const idx = _input.prompt.length % loopVariants.length;
        return loopVariants[idx];
    }

    async generateMemoryAids(_input: GenerateMemoryAidsInput): Promise<GenerateMemoryAidsOutput> {
        return {
            mnemonic: 'Create a vivid mental image connecting each key concept in a story: Picture yourself walking through a familiar place, placing each piece of information at a specific landmark along the way.',
            chunks: [
                {
                    label: 'Core Concept',
                    text: 'Start with the foundational idea. Repeat this until it feels natural and automatic.',
                    intervalSeconds: 180,
                },
                {
                    label: 'Key Details',
                    text: 'Connect the supporting details to the core concept. Use associations to link them together.',
                    intervalSeconds: 300,
                },
                {
                    label: 'Application',
                    text: 'Practice applying the knowledge. Say it in your own words and connect it to something you already know.',
                    intervalSeconds: 600,
                },
            ],
            schedule: 'Review after 1 hour, then after 1 day, then after 3 days, then after 7 days, then after 14 days.',
        };
    }

    async generateBriefing(_input: GenerateBriefingInput): Promise<string> {
        return 'Good morning. Today is a day of steady progress. Your focus areas are clear, and your habits are building momentum. Remember: consistency compounds. Start with your most important task before noon, and let your daily loops reinforce your mindset throughout the day. You are showing up, and that is what matters most. Stay steady, stay focused, and trust the process you have built.';
    }
}

