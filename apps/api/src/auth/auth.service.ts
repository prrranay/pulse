import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectQueue('email-queue') private readonly emailQueue: Queue,
  ) {
    const googleClientId = this.configService.get<string>('google.clientId');
    this.googleClient = new OAuth2Client(googleClientId);
  }

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

    if (!user.password) {
      throw new UnauthorizedException('Please log in with Google');
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

  async googleLogin(
    dto: GoogleLoginDto,
  ): Promise<{ user: Omit<User, 'password'>; accessToken: string }> {
    const { idToken } = dto;
    let payload;

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.configService.get<string>('google.clientId'),
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }

    if (!payload || !payload.email || !payload.sub) {
      throw new UnauthorizedException('Invalid Google token payload');
    }

    const { email, sub: googleId, name, picture } = payload;

    // Account Linking Policy:
    // 1. Find by googleId
    let user = await this.prisma.user.findUnique({
      where: { googleId },
    });

    if (!user) {
      // 2. Find by email
      user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        // Link Google ID to existing account
        const updateData: Record<string, any> = { googleId };
        if (!user.displayName && name) updateData.displayName = name;
        if (!user.avatarUrl && picture) updateData.avatarUrl = picture;

        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      } else {
        // 3. Create new user
        // Generate unique username
        const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
        let username = baseUsername || 'google_user';
        let exists = await this.prisma.user.findUnique({ where: { username } });
        let suffix = 1;
        while (exists) {
          username = `${baseUsername}${suffix}`;
          exists = await this.prisma.user.findUnique({ where: { username } });
          suffix++;
        }

        user = await this.prisma.user.create({
          data: {
            email,
            username,
            displayName: name || username,
            avatarUrl: picture || null,
            googleId,
            password: null,
          },
        });
      }
    }

    const result = { ...user } as Record<string, any>;
    delete result.password;

    // Generate JWT
    const jwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(jwtPayload);

    return {
      user: result as Omit<User, 'password'>,
      accessToken,
    };
  }
}
export type { User };
