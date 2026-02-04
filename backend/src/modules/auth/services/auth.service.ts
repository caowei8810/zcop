import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from './entities/user.entity';
import { UserService } from './services/user.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<User> {
    const startTime = Date.now();
    this.logger.log(`Attempting to validate user: ${username}`);
    
    const user = await this.userService.findByUsername(username);
    if (!user) {
      this.logger.warn(`Failed login attempt: User ${username} not found`);
      throw new UnauthorizedException('用户名或密码错误');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`Failed login attempt: Invalid password for user ${username}`);
      throw new UnauthorizedException('用户名或密码错误');
    }

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

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 10);

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
}