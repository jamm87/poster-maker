import { z } from "zod";

/** Variables de entorno del servidor. Ver .env.example. */
const schema = z.object({
  NODE_ENV: z.string().default("development"),
  DATABASE_URL: z.string().default("postgres://poster:poster@localhost:5432/poster"),
  PUBLIC_BASE_URL: z.string().default("http://localhost:3000"),
  BRAND_NAME: z.string().default("Trazado"),
  CONTACT_EMAIL: z.string().default("hola@example.com"),
  APP_SECRET: z.string().min(16).default("dev-secret-change-me-please"),
  INTERNAL_API_SECRET: z.string().default("dev-internal-secret"),
  ADMIN_PASSWORD: z.string().default("admin"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Trazado <pedidos@example.com>"),
  GELATO_API_KEY: z.string().optional(),
  GELATO_WEBHOOK_SECRET: z.string().default("dev-gelato-secret"),
  /** "draft": los pedidos a Gelato se crean como borrador (no se imprimen). "order": pedidos reales. */
  GELATO_ORDER_TYPE: z.enum(["draft", "order"]).default("draft"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("../../data/files"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  GEOCODER_URL: z.string().default("https://photon.komoot.io/api/"),
  SHIPPING_ES_CENTS: z.coerce.number().default(490),
  SHIPPING_EU_CENTS: z.coerce.number().default(990),
  DOWNLOAD_DAYS: z.coerce.number().default(30),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;
export function env(): Env {
  if (!cached) {
    const parsed = schema.parse(process.env);
    if (parsed.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
      for (const key of ["APP_SECRET", "INTERNAL_API_SECRET", "ADMIN_PASSWORD"] as const) {
        if (parsed[key] === schema.shape[key].parse(undefined)) {
          throw new Error(`${key} debe configurarse en producción`);
        }
      }
    }
    cached = parsed;
  }
  return cached;
}
