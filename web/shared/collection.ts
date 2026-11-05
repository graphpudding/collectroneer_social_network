// Copies and wishlist entries (db/migrations/*_collection.sql).
import type { CatalogCard } from "./catalog";

/** A catalog card with its category, enough to link to the model page. */
export type ModelCard = CatalogCard & { category: string };

export const COPY_STATUSES = ["owned", "for_trade", "for_sale", "sold"] as const;
export type CopyStatus = (typeof COPY_STATUSES)[number];
export type ItemStatus = CopyStatus | "wanted";

export const STATUS_LABELS: Record<ItemStatus, string> = {
  owned: "Owned",
  for_trade: "For trade",
  for_sale: "For sale",
  sold: "Sold",
  wanted: "Wanted",
};

export const CONDITIONS = ["mint", "near_mint", "excellent", "good", "fair", "for_parts"] as const;
export type Condition = (typeof CONDITIONS)[number];
export const CONDITION_LABELS: Record<Condition, string> = {
  mint: "Mint",
  near_mint: "Near mint",
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  for_parts: "For parts",
};

/** "Followers" arrives with follows; until then a copy is public or only for its owner. */
export const VISIBILITIES = ["public", "private"] as const;
export type Visibility = "public" | "followers" | "private";
export const VISIBILITY_LABELS: Record<Visibility, string> = { public: "Everyone", followers: "Followers", private: "Only me" };

export const LIMITS = { edition: 120, serial: 40, acquired: 120, note: 2000 } as const;

export type CopyFields = {
  status: CopyStatus;
  edition: string | null;
  serialNumber: string | null;
  hideSerial: boolean;
  condition: Condition | null;
  acquired: string | null;
  note: string | null;
  visibility: Visibility;
};

export const MAX_PHOTOS = 12;

export type PhotoStatus = "pending" | "approved" | "rejected";
export type CopyPhoto = {
  id: string;
  status: PhotoStatus;
  rejectReason: string | null;
  thumbUrl: string;
  fullUrl: string;
  width: number;
  height: number;
};

export type CollectionItem = CopyFields & {
  id: string;
  catalogId: string;
  model: ModelCard;
  /** In order; the first is the cover. The owner sees all, others only approved ones. */
  photos: CopyPhoto[];
  createdAt: string;
  updatedAt: string;
};

export type WishlistItem = { id: string; catalogId: string; model: ModelCard; createdAt: string };

/** What the signed-in user has of one model (model page buttons). */
export type MyModelState = { copies: { id: string; status: CopyStatus }[]; wanted: boolean };

/** Serial shown publicly: hidden on request. */
export const publicSerial = (c: Pick<CopyFields, "serialNumber" | "hideSerial">) =>
  c.hideSerial ? null : c.serialNumber;

type SerialRange = { from?: string | number; to?: string | number; year?: string | number; variant?: string };

/** Whether a serial number falls into a range the catalog knows (attributes.serial_ranges). */
export function serialFit(attributes: Record<string, unknown>, serial: string | null) {
  const ranges = Array.isArray(attributes.serial_ranges) ? (attributes.serial_ranges as SerialRange[]) : [];
  const n = Number((serial ?? "").replace(/[\s.]/g, ""));
  if (!ranges.length || !serial || !Number.isFinite(n)) return null;
  const hit = ranges.find((r) => Number(r.from) <= n && n <= Number(r.to));
  return hit ? { fits: true, range: hit } : { fits: false, range: null };
}

/** A copy as other people see it: hidden serials are already removed by the server. */
export type PublicCopy = Omit<CollectionItem, "hideSerial" | "visibility" | "updatedAt"> & {
  owner: import("./account").PublicUser;
};

/** Owners of a model (and its variants) on the model page. */
export type ModelOwners = {
  owners: number;
  wanted: number;
  copies: PublicCopy[];
};
