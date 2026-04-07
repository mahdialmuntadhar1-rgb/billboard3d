/**
 * FAQ Engine - Handles auto-reply detection and matching
 */

import { FAQAnswer } from './supabase';

export interface FAQMatch {
  faq: FAQAnswer;
  confidence: number;
  matchedKeywords: string[];
}

/**
 * Normalize text for matching
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .trim();
}

/**
 * Calculate word overlap between two texts
 */
function calculateWordOverlap(input: string, keywords: string[]): number {
  const inputWords = normalizeText(input).split(/\s+/);
  const keywordSet = new Set(keywords.map(k => normalizeText(k)));
  
  let matches = 0;
  inputWords.forEach(word => {
    if (keywordSet.has(word) || 
        Array.from(keywordSet).some(kw => kw.includes(word) || word.includes(kw))) {
      matches++;
    }
  });
  
  return matches / Math.max(inputWords.length, 1);
}

/**
 * Find best matching FAQ answer for incoming message
 */
export function findBestFAQMatch(
  incomingMessage: string,
  faqAnswers: FAQAnswer[],
  minConfidence: number = 0.3
): FAQMatch | null {
  let bestMatch: FAQMatch | null = null;
  
  for (const faq of faqAnswers) {
    if (!faq.is_active) continue;
    
    const confidence = calculateWordOverlap(incomingMessage, faq.question_keywords);
    const threshold = faq.confidence_threshold || minConfidence;
    
    if (confidence >= threshold) {
      if (!bestMatch || confidence > bestMatch.confidence) {
        const matchedKeywords = faq.question_keywords.filter(kw => 
          normalizeText(incomingMessage).includes(normalizeText(kw))
        );
        
        bestMatch = {
          faq,
          confidence,
          matchedKeywords,
        };
      }
    }
  }
  
  return bestMatch;
}

/**
 * Quick check if message matches any FAQ (for routing)
 */
export function hasFAQMatch(
  incomingMessage: string,
  faqAnswers: FAQAnswer[],
  minConfidence: number = 0.5
): boolean {
  return findBestFAQMatch(incomingMessage, faqAnswers, minConfidence) !== null;
}

/**
 * Predefined FAQ presets for common questions
 */
export const FAQ_PRESETS: Array<{
  question_keywords: string[];
  answer: string;
  auto_send: boolean;
}> = [
  {
    question_keywords: ['what is this', 'who are you', 'what do you do', 'about', 'what is'],
    answer: 'We help connect businesses with customers through our platform. We\'re reaching out to share information about growing your business presence online.',
    auto_send: false,
  },
  {
    question_keywords: ['how does it work', 'how to join', 'how can i', 'how do i'],
    answer: 'Getting started is simple! We can add your business to our directory so more customers can find you. Would you like to learn more about the process?',
    auto_send: false,
  },
  {
    question_keywords: ['free', 'cost', 'price', 'how much', 'charge', 'fee'],
    answer: 'Basic listing is completely free! We also have premium options if you want more visibility. Would you like to know about our packages?',
    auto_send: false,
  },
  {
    question_keywords: ['not interested', 'stop', 'unsubscribe', 'remove', 'delete'],
    answer: 'No problem at all! We\'ve removed you from our outreach list. Have a great day!',
    auto_send: true,
  },
  {
    question_keywords: ['yes', 'interested', 'tell me more', 'learn more', 'details'],
    answer: 'Great! I\'ll connect you with our team who can walk you through the next steps. Expect a call within 24 hours!',
    auto_send: true,
  },
  {
    question_keywords: ['where', 'location', 'address', 'find you'],
    answer: 'We\'re an online platform serving businesses across Iraq. You can reach us anytime through this chat or call our support line.',
    auto_send: false,
  },
  {
    question_keywords: ['scam', 'spam', 'fake', 'legit', 'trust'],
    answer: 'We understand your concern. We\'re a legitimate business directory helping connect customers with trusted businesses. No payment required to verify.',
    auto_send: false,
  },
];

/**
 * Generate FAQ answers from presets
 */
export function generateFAQFromPresets(): Array<Omit<FAQAnswer, 'id' | 'created_at' | 'updated_at'>> {
  return FAQ_PRESETS.map((preset, index) => ({
    question_keywords: preset.question_keywords,
    answer: preset.answer,
    is_active: true,
    auto_send: preset.auto_send,
    confidence_threshold: 0.5,
    usage_count: 0,
    metadata: { preset_index: index },
  }));
}
