import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @InjectQueue('email-queue') private readonly emailQueue: Queue,
  ) {}

  async register(dto: RegisterDto): Promise<Omit<User, 'password'>> {
    const { email, username, password, displayName } = dto;

    // Check if email already exists
    const existingEmail = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      throw new ConflictException('Email address is already registered');
    }

    // Check if username already exists
    const existingUsername = await this.prisma.user.findUnique({
      where: { username },
    });
    if (existingUsername) {
      throw new ConflictException('Username is already taken');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        displayName: displayName || username,
      },
    });

    // Enqueue welcome email asynchronously
    await this.emailQueue
      .add(
        'sendWelcomeEmail',
        { email: user.email, username: user.username },
        { attempts: 2, backoff: 3000 },
      )
      .catch((err: unknown) => {
        console.error('Failed to enqueue welcome email job:', err);
      });

    const result = { ...user } as Record<string, any>;
    delete result.password;
    return result as Omit<User, 'password'>;
  }

  async login(
    dto: LoginDto,
  ): Promise<{ user: Omit<User, 'password'>; accessToken: string }> {
    const { usernameOrEmail, password } = dto;

    // Find user by email or username
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: usernameOrEmail }, { username: usernameOrEmail }],
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    const result = { ...user } as Record<string, any>;
    delete result.password;
    return {
      user: result as Omit<User, 'password'>,
      accessToken,
    };
  }
}
export type { User };
