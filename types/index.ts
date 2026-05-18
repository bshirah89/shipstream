// ─── Auth ────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: {
    id: number;
    email: string;
  };
}

// Payload embedded in the JWT — keep small, no sensitive fields
export interface JWTPayload {
  userId: number;
  email: string;
  iat?: number;
  exp?: number;
}

// ─── Ship Events ─────────────────────────────────────────────────────────────

export type ShipEventType =
  | "guest_checkin"
  | "excursion_booking"
  | "drink_purchase"
  | "ad_impression";

export interface GuestCheckinPayload {
  guestId: string;
  name: string;
  cabin: string;
  deck: number;
}

export interface ExcursionBookingPayload {
  guestId: string;
  excursion: string;
  port: string;
  amount: number;
}

export interface DrinkPurchasePayload {
  guestId: string;
  item: string;
  venue: string;
  amount: number;
}

export interface AdImpressionPayload {
  adId: string;
  campaign: string;
  placement: string;
  guestId: string;
}

export type ShipEventPayload =
  | GuestCheckinPayload
  | ExcursionBookingPayload
  | DrinkPurchasePayload
  | AdImpressionPayload;

// Discriminated union — TypeScript narrows payload type based on `type` field
export type ShipEvent =
  | { type: "guest_checkin"; payload: GuestCheckinPayload; id: number; createdAt: string }
  | { type: "excursion_booking"; payload: ExcursionBookingPayload; id: number; createdAt: string }
  | { type: "drink_purchase"; payload: DrinkPurchasePayload; id: number; createdAt: string }
  | { type: "ad_impression"; payload: AdImpressionPayload; id: number; createdAt: string };

// ─── SSE Wire Format ─────────────────────────────────────────────────────────

// EventSource delivers string data — we JSON.parse into this shape on the client
export interface SSEMessage {
  event: ShipEventType;
  data: ShipEvent;
}

// ─── AI Analysis ─────────────────────────────────────────────────────────────

export interface AnalyzeRequest {
  events: ShipEvent[];
}

export interface AnalyzeResponse {
  summary: string;
}
