export type VehicleType = { id: number; name: string; slug: string; category?: string; attribute?: string };
export type Localisation = { id: number; name: string; latitude: string; longitude: string };
export type RouteStop = { order: number; id: number; name: string; latitude: string; longitude: string };

export type Route = {
    id: number;
    origin: number; destination: number;
    time_start: string; time_end: string;
    vehicle_type: number;
    crew: "single" | "double";
    currency: "PLN" | "EUR";
    price: string | null;
    length_km: string | null;
    price_per_km?: string | null;
    stops: RouteStop[];
    status: "active" | "sold" | "cancelled";
    created_at: string;
};

export type ChatMessage = {
    id: number;
    content?: string | null;
    image?: string | null;
    route?: number | null;
    route_label?: string | null;
    created_at: string;
    deleted_at?: string | null;
    user: { id: number; username: string; nickname_color: string; display_name?: string };
};

export type UserProfilePublic = {
  id: number;
  username: string;
  display_name?: string;
  nickname_color: string;
  bio?: string;
  route_stats: { active: number; sold: number; cancelled: number; total: number };
};

export type UserProfileMe = {
  id: number;
  username: string;
  email: string;
  display_name?: string;
  bio?: string;
  phone_number?: string;
  nickname_color: string;
};

export type VerificationDoc = {
  id: number;
  kind: "id" | "company" | "license" | "other" | string;
  file: string; // URL
  status: "pending" | "approved" | "rejected" | string;
  admin_note?: string;
  created_at: string;
  reviewed_at?: string | null;
};

export type AuthedUser = {
  id: number;
  username: string;
  display_name?: string;
  nickname_color?: string;
  is_email_verified: boolean; // <- used for showing Verify link
};
