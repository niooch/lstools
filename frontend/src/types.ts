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
    content: string;
    route: number | null;
    route_label?: string | null;
    created_at: string;
    user: { id: number; username: string; nickname_color: string };
};

