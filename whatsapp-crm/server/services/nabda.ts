import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const NABDA_API_KEY = process.env.NABDA_API_KEY;
const NABDA_API_URL = process.env.NABDA_API_URL || 'https://api.nabda.app/v1';

if (!NABDA_API_KEY) {
  throw new Error('Missing NABDA_API_KEY environment variable');
}

/**
 * Normalize Iraqi phone numbers
 * Converts various formats to international format (+964)
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Handle Iraqi numbers
  if (cleaned.startsWith('964')) {
    return '+' + cleaned;
  }
  
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
    return '+964' + cleaned;
  }
  
  if (cleaned.startsWith('7') && cleaned.length === 10) {
    return '+964' + cleaned;
  }
  
  // Already has + or is international
  if (phone.startsWith('+')) {
    return phone;
  }
  
  return '+' + cleaned;
}

interface NabdaSendResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send WhatsApp message via Nabda API
 * Backend-only function - never expose API key to frontend
 */
export async function sendMessage(phone: string, text: string): Promise<NabdaSendResponse> {
  try {
    const normalizedPhone = normalizePhoneNumber(phone);
    
    const response = await axios.post(
      `${NABDA_API_URL}/messages/send`,
      {
        to: normalizedPhone,
        body: text,
        type: 'text',
      },
      {
        headers: {
          'Authorization': `Bearer ${NABDA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    
    if (response.data && response.data.message_id) {
      return {
        success: true,
        messageId: response.data.message_id,
      };
    }
    
    return {
      success: true,
      messageId: response.data?.id,
    };
  } catch (error: any) {
    console.error('Nabda API error:', error.response?.data || error.message);
    
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to send message',
    };
  }
}

/**
 * Check message status
 */
export async function getMessageStatus(messageId: string): Promise<{
  status: string;
  delivered?: boolean;
  read?: boolean;
  timestamp?: string;
}> {
  try {
    const response = await axios.get(
      `${NABDA_API_URL}/messages/${messageId}/status`,
      {
        headers: {
          'Authorization': `Bearer ${NABDA_API_KEY}`,
        },
      }
    );
    
    return {
      status: response.data.status,
      delivered: response.data.delivered,
      read: response.data.read,
      timestamp: response.data.timestamp,
    };
  } catch (error: any) {
    console.error('Failed to check message status:', error.message);
    throw error;
  }
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // Basic validation: +964 followed by 10 digits
  return /^\+964\d{10}$/.test(normalized);
}
