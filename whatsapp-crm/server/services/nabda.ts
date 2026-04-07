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
    console.log(`[nabda/send] Preparing to send message:`, {
      originalPhone: phone,
      normalizedPhone: normalizedPhone,
      messageLength: text.length,
      messagePreview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
    });
    
    const requestBody = {
      to: normalizedPhone,
      body: text,
      type: 'text',
    };
    
    console.log(`[nabda/send] Making API call to: ${NABDA_API_URL}/messages/send`);
    console.log(`[nabda/send] Request body:`, requestBody);
    
    const startTime = Date.now();
    
    const response = await axios.post(
      `${NABDA_API_URL}/messages/send`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${NABDA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    
    const responseTime = Date.now() - startTime;
    console.log(`[nabda/send] API response received in ${responseTime}ms:`, {
      status: response.status,
      statusText: response.statusText,
      data: response.data
    });
    
    if (response.data && response.data.message_id) {
      console.log(`[nabda/send] Message sent successfully, ID: ${response.data.message_id}`);
      return {
        success: true,
        messageId: response.data.message_id,
      };
    }
    
    // Handle alternative response format
    if (response.data?.id) {
      console.log(`[nabda/send] Message sent successfully (alternative format), ID: ${response.data.id}`);
      return {
        success: true,
        messageId: response.data.id,
      };
    }
    
    console.log(`[nabda/send] Unexpected response format:`, response.data);
    return {
      success: true,
      messageId: response.data?.id || 'unknown',
    };
    
  } catch (error: any) {
    const errorDetails = {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      code: error.code
    };
    
    console.error(`[nabda/send] Nabda API error:`, errorDetails);
    
    const errorMessage = error.response?.data?.message || error.message || 'Failed to send message';
    console.log(`[nabda/send] Returning error response:`, { success: false, error: errorMessage });
    
    return {
      success: false,
      error: errorMessage,
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
 * Validate phone number format - matches business service validation
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  
  // Remove common formatting characters
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '').trim();
  
  // Skip obviously invalid numbers
  if (cleanPhone.length < 10) return false;
  if (cleanPhone === '1234567890' || cleanPhone === '0000000000') return false;
  
  // Iraqi phone patterns - more lenient
  const iraqiPatterns = [
    /^\+9647\d{8,9}$/,  // +9647xxxxxxxx
    /^07\d{9}$/,        // 07xxxxxxxxx
    /^\+96478\d{7,8}$/, // +96478xxxxxxx
    /^\+96479\d{7,8}$/, // +96479xxxxxxx
    /^\+96475\d{7,8}$/, // +96475xxxxxxx
    /^078\d{8}$/,       // 078xxxxxxxx
    /^079\d{8}$/,       // 079xxxxxxxx
    /^075\d{8}$/        // 075xxxxxxxx
  ];
  
  // General international pattern
  const generalPattern = /^\+\d{10,15}$/;
  
  // Check if it matches any valid pattern
  const isValid = iraqiPatterns.some(pattern => pattern.test(cleanPhone)) || 
                  generalPattern.test(cleanPhone);
  
  // Log validation attempts for debugging
  if (!isValid && cleanPhone.length >= 10) {
    console.log(`[nabda] Phone validation failed: ${phone} -> ${cleanPhone}`);
  }
  
  return isValid;
}
