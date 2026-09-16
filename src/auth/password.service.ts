import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

@Injectable()
export class PasswordService {
  hash(plainText: string): Promise<string> {
    return bcrypt.hash(plainText, SALT_ROUNDS);
  }

  compare(plainText: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainText, hash);
  }
}
