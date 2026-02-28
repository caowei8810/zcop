import { Injectable, UnauthorizedException, BadRequestException, Logger, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '../entities/user.entity';
import { UserService } from '../services/user.service';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly maxLoginAttempts: number;
  private readonly lockoutDuration: number; // in milliseconds

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.maxLoginAttempts = this.configService.get<number>('MAX_LOGIN_ATTEMPTS') || 5;
    this.lockoutDuration = (this.configService.get<number>('LOCKOUT_DURATION_MINUTES') || 15) * 60 * 1000;
  }

  async validateUser(username: string, password: string): Promise<User> {
    const startTime = Date.now();
    this.logger.log(`Attempting to validate user: ${username}`);
    
    // Check if user is locked out
    const lockoutKey = `lockout:${username}`;
    const lockoutUntil = await this.getLockoutUntil(lockoutKey);
    
    if (lockoutUntil && lockoutUntil > Date.now()) {
      this.logger.warn(`Login blocked: User ${username} is locked out until ${new Date(lockoutUntil).toISOString()}`);
      throw new ForbiddenException('账户因多次失败尝试已被锁定，请稍后再试');
    }

    const user = await this.userService.findByUsername(username);
    if (!user) {
      // Increment failed attempts even for non-existent users to prevent username enumeration
      await this.incrementFailedAttempts(username);
      this.logger.warn(`Failed login attempt: User ${username} not found`);
      throw new UnauthorizedException('用户名或密码错误');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.incrementFailedAttempts(username);
      this.logger.warn(`Failed login attempt: Invalid password for user ${username}`);
      throw new UnauthorizedException('用户名或密码错误');
    }

    // Reset failed attempts on successful login
    await this.resetFailedAttempts(username);

    this.logger.log(`Successful login validation for user: ${username}, took ${Date.now() - startTime}ms`);

    // Exclude password from returned user object
    const { password: _, ...result } = user;
    return result as User;
  }

  async login(user: User) {
    const payload = { 
      username: user.username, 
      sub: user.id, 
      roles: user.roles?.map(role => role.name),
      iat: Math.floor(Date.now() / 1000), // issued at time
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // expires in 1 hour
    };
    
    this.logger.log(`Generating JWT token for user: ${user.username}`);

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles?.map(role => ({ 
          id: role.id, 
          name: role.name, 
          displayName: role.displayName 
        })),
      },
    };
  }

  async register(userData: { username: string; email: string; password: string; firstName?: string; lastName?: string }) {
    const startTime = Date.now();
    this.logger.log(`Registering new user: ${userData.username}`);

    // Check if user already exists
    const existingUser = await this.userService.findByUsername(userData.username);
    if (existingUser) {
      this.logger.warn(`Registration failed: Username ${userData.username} already exists`);
      throw new BadRequestException('用户名已存在');
    }

    const existingEmail = await this.userService.findByEmail(userData.email);
    if (existingEmail) {
      this.logger.warn(`Registration failed: Email ${userData.email} already exists`);
      throw new BadRequestException('邮箱已被使用');
    }

    // Validate password strength
    this.validatePasswordStrength(userData.password);

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 12); // Increased salt rounds for better security

    // Create user
    const user = await this.userService.create({
      ...userData,
      password: hashedPassword,
    });

    this.logger.log(`Successfully registered user: ${userData.username}, took ${Date.now() - startTime}ms`);

    // Exclude password from returned user object
    const { password: _, ...result } = user;
    return result as User;
  }

  async refresh(user: User) {
    const payload = { 
      username: user.username, 
      sub: user.id, 
      roles: user.roles?.map(role => role.name),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // expires in 1 hour
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  private validatePasswordStrength(password: string): void {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength) {
      throw new BadRequestException('密码长度至少8位');
    }
    if (!hasUpperCase) {
      throw new BadRequestException('密码必须包含大写字母');
    }
    if (!hasLowerCase) {
      throw new BadRequestException('密码必须包含小写字母');
    }
    if (!hasNumbers) {
      throw new BadRequestException('密码必须包含数字');
    }
    if (!hasSpecialChar) {
      throw new BadRequestException('密码必须包含特殊字符');
    }
  }

  private async incrementFailedAttempts(username: string): Promise<void> {
    const attemptsKey = `failed_attempts:${username}`;
    const currentAttempts = (await this.getFailedAttempts(attemptsKey)) || 0;
    const newAttempts = currentAttempts + 1;

    if (newAttempts >= this.maxLoginAttempts) {
      // Lock the user account
      const lockoutKey = `lockout:${username}`;
      await this.setLockoutUntil(lockoutKey, Date.now() + this.lockoutDuration);
      this.logger.warn(`User ${username} has been locked out due to ${newAttempts} failed attempts`);
    } else {
      await this.setFailedAttempts(attemptsKey, newAttempts);
    }
  }

  private async resetFailedAttempts(username: string): Promise<void> {
    const attemptsKey = `failed_attempts:${username}`;
    const lockoutKey = `lockout:${username}`;
    
    // Reset both failed attempts and lockout status
    await this.setFailedAttempts(attemptsKey, 0);
    await this.clearLockoutUntil(lockoutKey);
  }

  private async getFailedAttempts(key: string): Promise<number> {
    // In a real implementation, this would interact with a cache or database
    // For now, we'll simulate with a simple in-memory approach
    const attempts = await this.getFromCache(key);
    return attempts || 0;
  }

  private async setFailedAttempts(key: string, value: number): Promise<void> {
    // In a real implementation, this would interact with a cache or database
    await this.setToCache(key, value, this.lockoutDuration);
  }

  private async getLockoutUntil(key: string): Promise<number | null> {
    const lockoutUntil = await this.getFromCache(key);
    return lockoutUntil || null;
  }

  private async setLockoutUntil(key: string, value: number): Promise<void> {
    await this.setToCache(key, value, this.lockoutDuration);
  }

  private async clearLockoutUntil(key: string): Promise<void> {
    await this.deleteFromCache(key);
  }

  private async getFromCache(key: string): Promise<any> {
    // Simulated cache access - in a real app this would connect to Redis or similar
    // For now, we'll use a simple global store
    if (typeof global.authCache === 'undefined') {
      global.authCache = new Map();
    }
    return global.authCache.get(key);
  }

  private async setToCache(key: string, value: any, ttl: number): Promise<void> {
    // Simulated cache with TTL - in a real app this would connect to Redis or similar
    if (typeof global.authCache === 'undefined') {
      global.authCache = new Map();
    }
    global.authCache.set(key, value);
    
    // Set timeout to remove after TTL
    setTimeout(() => {
      global.authCache.delete(key);
    }, ttl);
  }

  private async deleteFromCache(key: string): Promise<void> {
    if (typeof global.authCache !== 'undefined') {
      global.authCache.delete(key);
    }
  }
}