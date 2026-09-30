import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { PosterSpec } from "@/lib/spec";

const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = ts("created_at").notNull().defaultNow();

/** Diseños guardados (un PosterSpec inmutable, deduplicado por hash). */
export const designs = pgTable("designs", {
  id: uuid("id").primaryKey().defaultRandom(),
  specHash: text("spec_hash").notNull().unique(),
  spec: jsonb("spec").$type<PosterSpec>().notNull(),
  createdAt,
});

/** Precio y producto de Gelato para cada formato × acabado. Precios en céntimos, IVA incluido. */
export const variants = pgTable(
  "variants",
  {
    formatId: text("format_id").notNull(),
    finishId: text("finish_id").notNull(),
    priceCents: integer("price_cents").notNull(),
    gelatoProductUid: text("gelato_product_uid"),
    active: boolean("active").notNull().default(true),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.formatId, t.finishId] })],
);

export const carts = pgTable("carts", {
  id: uuid("id").primaryKey().defaultRandom(),
  locale: text("locale").notNull().default("es"),
  createdAt,
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const cartItems = pgTable("cart_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  cartId: uuid("cart_id")
    .notNull()
    .references(() => carts.id, { onDelete: "cascade" }),
  designId: uuid("design_id")
    .notNull()
    .references(() => designs.id),
  finishId: text("finish_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  createdAt,
});

export type OrderStatus = "paid" | "in_production" | "fulfilled" | "shipped" | "needs_attention" | "refunded";

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number").notNull().unique(),
    stripeSessionId: text("stripe_session_id").notNull().unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    status: text("status").$type<OrderStatus>().notNull().default("paid"),
    email: text("email").notNull(),
    customerName: text("customer_name"),
    locale: text("locale").notNull().default("es"),
    currency: text("currency").notNull().default("eur"),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    shippingAddress: jsonb("shipping_address").$type<ShippingAddress | null>(),
    billingCountry: text("billing_country"),
    /** Consentimiento de entrega inmediata del contenido digital (art. 103.m TRLGDCU). */
    digitalWaiverAt: ts("digital_waiver_at"),
    accessToken: text("access_token").notNull().unique(),
    confirmationEmailAt: ts("confirmation_email_at"),
    downloadsEmailAt: ts("downloads_email_at"),
    notes: text("notes"),
    createdAt,
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("orders_created_idx").on(t.createdAt)],
);

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string | null;
  postalCode: string;
  city: string;
  state?: string | null;
  country: string;
  phone?: string | null;
}

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  designId: uuid("design_id")
    .notNull()
    .references(() => designs.id),
  formatId: text("format_id").notNull(),
  finishId: text("finish_id").notNull(),
  physical: boolean("physical").notNull(),
  quantity: integer("quantity").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  title: text("title").notNull(),
  renderJobId: uuid("render_job_id"),
  createdAt,
});

export type JobKind = "preview" | "proof" | "print";
export type JobStatus = "queued" | "running" | "done" | "failed";
export interface JobOutput {
  key: string;
  contentType: string;
  width: number;
  height: number;
  bytes: number;
  role: "preview" | "proof" | "print_png" | "print_pdf";
}

/** Cola de render consumida por services/renderer (worker.py). No cambiar columnas sin actualizar el worker. */
export const renderJobs = pgTable(
  "render_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").$type<JobKind>().notNull(),
    finish: text("finish").notNull().default("digital"),
    spec: jsonb("spec").$type<PosterSpec>().notNull(),
    specHash: text("spec_hash").notNull(),
    status: text("status").$type<JobStatus>().notNull().default("queued"),
    priority: integer("priority").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    runAfter: ts("run_after").notNull().defaultNow(),
    lockedBy: text("locked_by"),
    output: jsonb("output").$type<JobOutput[]>(),
    error: text("error"),
    durationMs: integer("duration_ms"),
    orderItemId: uuid("order_item_id"),
    createdAt,
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("render_jobs_queue_idx").on(t.status, t.priority, t.createdAt),
    index("render_jobs_hash_idx").on(t.specHash, t.kind),
  ],
);

export type FulfillmentStatus = "pending" | "submitted" | "in_production" | "shipped" | "delivered" | "failed" | "canceled";

/** Un pedido a Gelato por pedido de la tienda (agrupa los productos físicos). */
export const fulfillments = pgTable("fulfillments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .unique()
    .references(() => orders.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("gelato"),
  providerOrderId: text("provider_order_id"),
  status: text("status").$type<FulfillmentStatus>().notNull().default("pending"),
  draft: boolean("draft").notNull().default(true),
  trackingUrl: text("tracking_url"),
  trackingCode: text("tracking_code"),
  lastError: text("last_error"),
  request: jsonb("request"),
  response: jsonb("response"),
  shippedEmailAt: ts("shipped_email_at"),
  createdAt,
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** Enlaces de descarga de productos digitales. */
export const downloads = pgTable("downloads", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderItemId: uuid("order_item_id")
    .notNull()
    .unique()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  maxDownloads: integer("max_downloads").notNull().default(20),
  downloadCount: integer("download_count").notNull().default(0),
  createdAt,
});

export const catalogCities = pgTable(
  "catalog_cities",
  {
    slug: text("slug").primaryKey(),
    nameEs: text("name_es").notNull(),
    nameEn: text("name_en").notNull(),
    countryEs: text("country_es").notNull(),
    countryEn: text("country_en").notNull(),
    lat: text("lat").notNull(),
    lon: text("lon").notNull(),
    widthMeters: integer("width_meters").notNull(),
    themeId: text("theme_id").notNull(),
    descriptionEs: text("description_es"),
    descriptionEn: text("description_en"),
    featured: boolean("featured").notNull().default(false),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    previewJobId: uuid("preview_job_id"),
    createdAt,
  },
  (t) => [uniqueIndex("catalog_cities_order_idx").on(t.sortOrder, t.slug)],
);

/** Registro de emails enviados (en desarrollo sin Resend, el email sólo se guarda aquí). */
export const emailLog = pgTable("email_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id"),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  kind: text("kind").notNull(),
  providerId: text("provider_id"),
  error: text("error"),
  createdAt,
});

/** Eventos de webhooks ya procesados (idempotencia). */
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  createdAt,
});
