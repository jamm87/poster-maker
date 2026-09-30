import { env } from "./env";
import type { FulfillmentStatus, ShippingAddress } from "./db/schema";

/**
 * Cliente mínimo de la API de pedidos de Gelato (v4).
 * Docs: https://dashboard.gelato.com/docs/orders/v4/create/
 * Sin GELATO_API_KEY funciona en modo simulado (no llama a Gelato, guarda la petición).
 */
const ORDER_API = "https://order.gelatoapis.com/v4/orders";

export interface GelatoItemInput {
  itemReferenceId: string;
  productUid: string;
  fileUrl: string;
  quantity: number;
}

export interface GelatoOrderInput {
  orderReferenceId: string;
  customerReferenceId: string;
  email: string;
  address: ShippingAddress;
  items: GelatoItemInput[];
}

export function buildGelatoOrder(input: GelatoOrderInput, orderType: "draft" | "order") {
  const [firstName, ...rest] = input.address.name.trim().split(/\s+/);
  return {
    orderType,
    orderReferenceId: input.orderReferenceId,
    customerReferenceId: input.customerReferenceId,
    currency: "EUR",
    items: input.items.map((i) => ({
      itemReferenceId: i.itemReferenceId,
      productUid: i.productUid,
      files: [{ type: "default", url: i.fileUrl }],
      quantity: i.quantity,
    })),
    shippingAddress: {
      firstName: firstName || input.address.name,
      lastName: rest.join(" ") || "-",
      addressLine1: input.address.line1,
      addressLine2: input.address.line2 ?? undefined,
      city: input.address.city,
      postCode: input.address.postalCode,
      state: input.address.state ?? undefined,
      country: input.address.country,
      email: input.email,
      phone: input.address.phone ?? undefined,
    },
  };
}

export async function createGelatoOrder(input: GelatoOrderInput) {
  const e = env();
  const body = buildGelatoOrder(input, e.GELATO_ORDER_TYPE);
  if (!e.GELATO_API_KEY) {
    return { mock: true, request: body, response: { id: `mock-${input.orderReferenceId}`, fulfillmentStatus: "draft" } };
  }
  const res = await fetch(ORDER_API, {
    method: "POST",
    headers: { "X-API-KEY": e.GELATO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const response = (await res.json().catch(() => ({}))) as { id?: string; message?: string; fulfillmentStatus?: string };
  if (!res.ok) throw new GelatoError(`Gelato ${res.status}: ${response.message ?? JSON.stringify(response)}`, body, response);
  return { mock: false, request: body, response };
}

export class GelatoError extends Error {
  constructor(
    message: string,
    public request: unknown,
    public response: unknown,
  ) {
    super(message);
  }
}

/** fulfillmentStatus de Gelato → estado interno. */
export function mapGelatoStatus(status: string | undefined): FulfillmentStatus | null {
  switch (status) {
    case "created":
    case "passed":
    case "draft":
    case "pending_approval":
    case "on_hold":
    case "not_connected":
      return "submitted";
    case "in_production":
    case "printed":
      return "in_production";
    case "shipped":
      return "shipped";
    case "delivered":
      return "delivered";
    case "canceled":
      return "canceled";
    case "failed":
      return "failed";
    default:
      return null;
  }
}
