import { z } from 'zod';

// Explicit validation at the boundary between the process environment and the rest of the
// application — nothing else in the codebase reads process.env directly.
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),

  AUTH_PROVIDER: z.enum(['mock', 'entra']).default('mock'),
  AZURE_AD_TENANT_ID: z.string().optional(),
  AZURE_AD_CLIENT_ID: z.string().optional(),
  AZURE_AD_CLIENT_SECRET: z.string().optional(),
  AZURE_AD_REDIRECT_URI: z.string().optional(),

  DOCUMENT_STORAGE_PROVIDER: z.enum(['local', 'sharepoint']).default('local'),
  KANBAN_PROVIDER: z.enum(['database', 'microsoft-lists']).default('database'),
  GRAPH_CLIENT_ID: z.string().optional(),
  GRAPH_CLIENT_SECRET: z.string().optional(),
  GRAPH_TENANT_ID: z.string().optional(),
  SHAREPOINT_SITE_ID: z.string().optional(),
  SHAREPOINT_DRIVE_ID: z.string().optional(),
  MICROSOFT_LISTS_WORKPLAN_LIST_ID: z.string().optional(),
  MICROSOFT_LISTS_ACTIVITY_LIST_ID: z.string().optional(),

  AI_PROVIDER: z.enum(['mock', 'internal']).default('mock'),
  INTERNAL_AI_ENDPOINT: z.string().optional(),
  INTERNAL_AI_MODEL_NAME: z.string().optional(),
  INTERNAL_AI_API_KEY: z.string().optional(),

  NOTIFICATION_PROVIDER: z.enum(['mock', 'graph', 'whatsapp']).default('mock'),
  WHATSAPP_BUSINESS_API_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),

  DEFAULT_TIMEZONE: z.string().default('Pacific/Port_Moresby'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
        .join('\n')}`,
    );
  }
  cached = parsed.data;
  return cached;
}
