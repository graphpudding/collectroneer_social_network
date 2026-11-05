/** Identifier type for public.rarity_scales */
export type RarityScalesCategory = string & { __brand: 'public.rarity_scales' };

/** Represents the table public.rarity_scales */
export default interface RarityScales {
  category: RarityScalesCategory;

  levels: unknown;

  method_version: number;

  updated_at: Date;

  updated_by: string | null;
}

/** Represents the initializer for the table public.rarity_scales */
export interface RarityScalesInitializer {
  category: RarityScalesCategory;

  levels: unknown;

  /** Default value: 1 */
  method_version?: number;

  /** Default value: now() */
  updated_at?: Date;

  updated_by?: string | null;
}

/** Represents the mutator for the table public.rarity_scales */
export interface RarityScalesMutator {
  category?: RarityScalesCategory;

  levels?: unknown;

  method_version?: number;

  updated_at?: Date;

  updated_by?: string | null;
}