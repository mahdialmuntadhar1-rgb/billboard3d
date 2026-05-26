import type { JWTPayload } from '../types';

export class JWTUtils {
  private static secret: string;

  static setSecret(secret: string) {
    this.secret = secret;
  }

  static async sign(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
    if (!this.secret) {
      throw new Error('JWT secret not set');
    }

    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = {
      ...payload,
      iat: now,
      exp: now + (7 * 24 * 60 * 60) // 7 days
    };

    const body = btoa(JSON.stringify(jwtPayload))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const sigInput = `${header}.${body}`;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(sigInput));
    const encodedSig = btoa(String.fromCharCode(...new Uint8Array(sig)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    return `${sigInput}.${encodedSig}`;
  }

  static async verify(token: string): Promise<JWTPayload | null> {
    if (!this.secret) {
      throw new Error('JWT secret not set');
    }

    try {
      const [header, body, sig] = token.split('.');
      if (!header || !body || !sig) {
        return null;
      }

      const sigInput = `${header}.${body}`;

      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(this.secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );

      const sigBytes = Uint8Array.from(
        atob(sig.replace(/-/g, '+').replace(/_/g, '/')),
        (c) => c.charCodeAt(0)
      );

      const valid = await crypto.subtle.verify(
        'HMAC',
        key,
        sigBytes.buffer as ArrayBuffer,
        new TextEncoder().encode(sigInput)
      );

      if (!valid) {
        return null;
      }

      const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')));
      
      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  static extractFromHeader(authHeader: string): string | null {
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.slice(7);
  }
}
