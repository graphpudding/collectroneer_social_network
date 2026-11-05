import type { CatalogEntriesId } from './CatalogEntries.js';

/** Identifier type for public.catalog_relations */
export type CatalogRelationsRelation = string & { __brand: 'public.catalog_relations' };

/** Represents the table public.catalog_relations */
export default interface CatalogRelations {
  from_id: CatalogEntriesId;

  relation: CatalogRelationsRelation;

  to_id: CatalogEntriesId;

  source: string | null;
}

/** Represents the initializer for the table public.catalog_relations */
export interface CatalogRelationsInitializer {
  from_id: CatalogEntriesId;

  relation: CatalogRelationsRelation;

  to_id: CatalogEntriesId;

  source?: string | null;
}

/** Represents the mutator for the table public.catalog_relations */
export interface CatalogRelationsMutator {
  from_id?: CatalogEntriesId;

  relation?: CatalogRelationsRelation;

  to_id?: CatalogEntriesId;

  source?: string | null;
}