import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class EncryptionService {
  async hashPassword(password: string): Promise<string> {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    return await bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  async generateSalt(rounds: number = 12): Promise<string> {
    return await bcrypt.genSalt(rounds);
  }

  // Simple encryption utility (for non-sensitive data)
  encrypt(text: string, key: string): string {
    // In production, use a proper encryption library like crypto
    // This is a simplified version for demonstration
    return Buffer.from(text).toString('base64');
  }

  decrypt(encryptedText: string, key: string): string {
    // In production, use a proper decryption library
    return Buffer.from(encryptedText, 'base64').toString();
  }

  async generateSecureToken(length: number = 32): Promise<string> {
    // Generate a cryptographically secure random token
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    
    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }
    
    return result;
  }

  async hashData(data: string | object): Promise<string> {
    const crypto = await import('crypto');
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }
}