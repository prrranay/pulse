import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // App
  PORT: Joi.number().default(4000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // Database
  DATABASE_URL: Joi.string().required(),

  // Redis
  REDIS_URL: Joi.string().default('redis://localhost:6379'),

  // JWT
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRATION: Joi.string().default('7d'),

  // AI
  GEMINI_API_KEY: Joi.string().optional(),
  GEMINI_MODEL: Joi.string().default('gemini-1.5-flash'),

  // CORS
  FRONTEND_URL: Joi.string().default('http://localhost:3000'),

  // Google OAuth
  GOOGLE_CLIENT_ID: Joi.string().default('mock-client-id'),
  GOOGLE_CLIENT_SECRET: Joi.string().default('mock-client-secret'),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: Joi.string().default('mock-cloud-name'),
  CLOUDINARY_API_KEY: Joi.string().default('mock-api-key'),
  CLOUDINARY_API_SECRET: Joi.string().default('mock-api-secret'),
});
