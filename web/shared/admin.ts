// Moderation: roles, reports, the photo queue.
export type Role = "user" | "moderator" | "admin";
export const isStaff = (role?: string | null) => role === "moderator" || role === "admin";

export const REPORT_REASONS = {
  spam: "Spam",
  scam: "Scam or fraud",
  harassment: "Harassment",
  not_own_photo: "Not their own photo",
  inappropriate: "Inappropriate content",
  other: "Something else",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
export type ReportTarget = "user" | "copy" | "photo" | "message";

/** Ready-made reasons for rejecting a photo; shown to the owner. */
export const PHOTO_REJECT_REASONS = [
  "Not your own photo",
  "Filter or AI detected",
  "Not this camera",
  "Too blurry or dark",
  "Not a photo of the copy",
] as const;

export type PendingPhoto = {
  id: string;
  thumbUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  createdAt: string;
  itemId: string;
  model: string;
  modelPath: string;
  owner: { username: string; id: string };
};

export type ReportRow = {
  id: string;
  targetType: ReportTarget;
  targetId: string;
  targetUser: { id: string; username: string | null; banned: boolean } | null;
  reporter: string | null;
  reason: ReportReason;
  details: string | null;
  status: "open" | "resolved" | "dismissed";
  resolution: string | null;
  createdAt: string;
  /** Where to look: profile or copy URL. */
  link: string | null;
};

export type AdminUser = {
  id: string;
  username: string | null;
  email: string;
  role: Role;
  banned: boolean;
  banReason: string | null;
  isPrivate: boolean;
  createdAt: string;
  copies: number;
  reports: number;
};
