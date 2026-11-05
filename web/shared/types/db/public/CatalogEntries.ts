/** Identifier type for public.catalog_entries */
export type CatalogEntriesId = string & { __brand: 'public.catalog_entries' };

/** Represents the table public.catalog_entries */
export default interface CatalogEntries {
  id: CatalogEntriesId;

  status: string;

  merged_into: CatalogEntriesId | null;

  category: string;

  name: string;

  maker: string;

  labels: unknown;

  aliases: string[];

  year_start: number | null;

  year_end: number | null;

  country: string | null;

  production_count: unknown | null;

  attributes: unknown;

  image_url: string | null;

  image_license: string | null;

  image_author: string | null;

  external_ids: unknown;

  source_urls: string[];

  field_sources: unknown;

  data_license: string;

  attribution: string[];

  match_confidence: string | null;

  notes: string | null;

  search_text: string;

  search_compact: string;

  created_at: Date;

  updated_at: Date;
}

/** Represents the initializer for the table public.catalog_entries */
export interface CatalogEntriesInitializer {
  id: CatalogEntriesId;

  /** Default value: 'active'::text */
  status?: string;

  merged_into?: CatalogEntriesId | null;

  category: string;

  name: string;

  maker: string;

  /** Default value: '{}'::jsonb */
  labels?: unknown;

  /** Default value: '{}'::text[] */
  aliases?: string[];

  year_start?: number | null;

  year_end?: number | null;

  country?: string | null;

  production_count?: unknown | null;

  /** Default value: '{}'::jsonb */
  attributes?: unknown;

  image_url?: string | null;

  image_license?: string | null;

  image_author?: string | null;

  /** Default value: '{}'::jsonb */
  external_ids?: unknown;

  /** Default value: '{}'::text[] */
  source_urls?: string[];

  /** Default value: '{}'::jsonb */
  field_sources?: unknown;

  data_license: string;

  /** Default value: '{}'::text[] */
  attribution?: string[];

  match_confidence?: string | null;

  notes?: string | null;

  /** Default value: ''::text */
  search_text?: string;

  /** Default value: ''::text */
  search_compact?: string;

  /** Default value: now() */
  created_at?: Date;

  /** Default value: now() */
  updated_at?: Date;
}

/** Represents the mutator for the table public.catalog_entries */
export interface CatalogEntriesMutator {
  id?: CatalogEntriesId;

  status?: string;

  merged_into?: CatalogEntriesId | null;

  category?: string;

  name?: string;

  maker?: string;

  labels?: unknown;

  aliases?: string[];

  year_start?: number | null;

  year_end?: number | null;

  country?: string | null;

  production_count?: unknown | null;

  attributes?: unknown;

  image_url?: string | null;

  image_license?: string | null;

  image_author?: string | null;

  external_ids?: unknown;

  source_urls?: string[];

  field_sources?: unknown;

  data_license?: string;

  attribution?: string[];

  match_confidence?: string | null;

  notes?: string | null;

  search_text?: string;

  search_compact?: string;

  created_at?: Date;

  updated_at?: Date;
}