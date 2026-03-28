export type BuildingType = "block" | "house" | "tenement" | "new_development";
export type OfferType = "agency" | "private" | "developer";
export type HeatingType = "gas" | "electric" | "district" | "coal" | "heat_pump" | "other";
export type ParkingType = "none" | "surface" | "underground" | "garage";

export interface Fee {
  fee_type: string;
  amount_pln: number;
}

export interface NearbyDistances {
  grocery_m?: number | null;
  park_m?: number | null;
  public_transport_m?: number | null;
  [key: string]: number | null | undefined;
}

// Mirrors the listings_normalized table schema.
// null = unknown/not available from this source.
export interface NormalizedListing {
  // identity
  source: string;
  external_id: string;
  url: string | null;
  title: string | null;
  description: string | null;
  is_active: boolean;

  // location
  city: string | null;
  district: string | null;
  neighbourhood: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;

  // physical
  area_m2: number | null;
  rooms: number | null;
  floor: number | null;
  total_floors: number | null;
  building_type: BuildingType | null;

  // offer
  offer_type: OfferType | null;
  has_provision: boolean | null;
  provision_total_pln: number | null;

  // pricing
  rent_pln: number | null;
  deposit_pln: number | null;
  fees: Fee[] | null;
  total_monthly_pln: number | null;

  // availability
  available_from: string | null; // ISO date string

  // features (null = unknown)
  has_balcony: boolean | null;
  has_terrace: boolean | null;
  has_elevator: boolean | null;
  has_storage_room: boolean | null;
  is_furnished: boolean | null;
  has_internet: boolean | null;
  has_tv: boolean | null;
  heating_type: HeatingType | null;
  parking_type: ParkingType | null;

  // equipment (null = unknown, [] = confirmed none)
  kitchen_equipment: string[] | null;
  bathroom_features: string[] | null;
  living_room_features: string[] | null;
  extra_features: string[] | null;

  // nearby
  nearby: NearbyDistances | null;
}
