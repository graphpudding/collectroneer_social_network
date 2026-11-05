\restrict dbmate

-- Dumped from database version 18.6 (Debian 18.6-1.pgdg13+2)
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: catalog_compact(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalog_compact(t text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    RETURN regexp_replace(lower(t), '[^[:alnum:]]+'::text, ''::text, 'g'::text);


--
-- Name: catalog_entries_before_write(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalog_entries_before_write() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  names text := concat_ws(' ',
    new.maker || ' ' || new.name,
    array_to_string(new.aliases, ' '),
    (select string_agg(value, ' ') from jsonb_each_text(new.labels)));
begin
  new.search_text := lower(names);
  -- Each name compacted separately so "nikonf2" matches but words of different names don't fuse.
  new.search_compact := (
    select string_agg(distinct catalog_compact(n), ' ')
    from unnest(array[new.maker || new.name] || new.aliases
                || array(select value from jsonb_each_text(new.labels))) as n);
  new.updated_at := now();
  return new;
end $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id text NOT NULL,
    account_id text NOT NULL,
    provider_id text NOT NULL,
    user_id text NOT NULL,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at timestamp with time zone,
    refresh_token_expires_at timestamp with time zone,
    scope text,
    password text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: catalog_edits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_edits (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id text,
    kind text NOT NULL,
    catalog_id text,
    category text NOT NULL,
    changes jsonb NOT NULL,
    source text NOT NULL,
    note text,
    status text DEFAULT 'proposed'::text NOT NULL,
    review_note text,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    result_catalog_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catalog_edits_check CHECK (((kind = 'new_model'::text) = (catalog_id IS NULL))),
    CONSTRAINT catalog_edits_kind_check CHECK ((kind = ANY (ARRAY['edit'::text, 'new_model'::text, 'merge'::text]))),
    CONSTRAINT catalog_edits_note_check CHECK ((length(note) <= 1000)),
    CONSTRAINT catalog_edits_review_note_check CHECK ((length(review_note) <= 500)),
    CONSTRAINT catalog_edits_source_check CHECK (((length(source) >= 3) AND (length(source) <= 500))),
    CONSTRAINT catalog_edits_status_check CHECK ((status = ANY (ARRAY['proposed'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: catalog_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_entries (
    id text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    merged_into text,
    category text NOT NULL,
    name text NOT NULL,
    maker text NOT NULL,
    labels jsonb DEFAULT '{}'::jsonb NOT NULL,
    aliases text[] DEFAULT '{}'::text[] NOT NULL,
    year_start integer,
    year_end integer,
    country text,
    production_count jsonb,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    image_url text,
    image_license text,
    image_author text,
    external_ids jsonb DEFAULT '{}'::jsonb NOT NULL,
    source_urls text[] DEFAULT '{}'::text[] NOT NULL,
    field_sources jsonb DEFAULT '{}'::jsonb NOT NULL,
    data_license text NOT NULL,
    attribution text[] DEFAULT '{}'::text[] NOT NULL,
    match_confidence text,
    notes text,
    search_text text DEFAULT ''::text NOT NULL,
    search_compact text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catalog_entries_check CHECK ((id ~~ (category || ':%'::text))),
    CONSTRAINT catalog_entries_check1 CHECK (((status = 'merged'::text) = (merged_into IS NOT NULL))),
    CONSTRAINT catalog_entries_check2 CHECK (((image_url IS NULL) OR (image_license IS NOT NULL))),
    CONSTRAINT catalog_entries_status_check CHECK ((status = ANY (ARRAY['active'::text, 'merged'::text, 'retired'::text])))
);


--
-- Name: catalog_relations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_relations (
    from_id text NOT NULL,
    relation text NOT NULL,
    to_id text NOT NULL,
    source text,
    CONSTRAINT catalog_relations_check CHECK ((from_id <> to_id)),
    CONSTRAINT catalog_relations_relation_check CHECK ((relation = 'variant_of'::text))
);


--
-- Name: collection_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_items (
    id uuid DEFAULT uuidv7() NOT NULL,
    owner_id text NOT NULL,
    catalog_id text NOT NULL,
    status text NOT NULL,
    edition text,
    serial_number text,
    hide_serial boolean DEFAULT false NOT NULL,
    condition text,
    acquired text,
    note text,
    visibility text DEFAULT 'public'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT collection_items_acquired_check CHECK ((length(acquired) <= 120)),
    CONSTRAINT collection_items_check CHECK (((status <> 'wanted'::text) OR ((serial_number IS NULL) AND (condition IS NULL) AND (acquired IS NULL)))),
    CONSTRAINT collection_items_condition_check CHECK ((condition = ANY (ARRAY['mint'::text, 'near_mint'::text, 'excellent'::text, 'good'::text, 'fair'::text, 'for_parts'::text]))),
    CONSTRAINT collection_items_edition_check CHECK ((length(edition) <= 120)),
    CONSTRAINT collection_items_note_check CHECK ((length(note) <= 2000)),
    CONSTRAINT collection_items_serial_number_check CHECK ((length(serial_number) <= 40)),
    CONSTRAINT collection_items_status_check CHECK ((status = ANY (ARRAY['owned'::text, 'for_trade'::text, 'for_sale'::text, 'sold'::text, 'wanted'::text]))),
    CONSTRAINT collection_items_visibility_check CHECK ((visibility = ANY (ARRAY['public'::text, 'followers'::text, 'private'::text])))
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_a text NOT NULL,
    user_b text NOT NULL,
    item_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_message_at timestamp with time zone DEFAULT now() NOT NULL,
    a_last_read_at timestamp with time zone DEFAULT '-infinity'::timestamp with time zone NOT NULL,
    b_last_read_at timestamp with time zone DEFAULT '-infinity'::timestamp with time zone NOT NULL,
    a_archived boolean DEFAULT false NOT NULL,
    b_archived boolean DEFAULT false NOT NULL,
    CONSTRAINT conversations_check CHECK ((user_a < user_b))
);


--
-- Name: copy_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.copy_photos (
    id uuid DEFAULT uuidv7() NOT NULL,
    item_id uuid NOT NULL,
    owner_id text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    key_full text NOT NULL,
    key_thumb text NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    reject_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by text,
    CONSTRAINT copy_photos_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT uuidv7() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id text NOT NULL,
    body text,
    attachment_key text,
    attachment_thumb text,
    attachment_width integer,
    attachment_height integer,
    item_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    edited_at timestamp with time zone,
    deleted_at timestamp with time zone,
    CONSTRAINT messages_body_check CHECK ((length(body) <= 4000)),
    CONSTRAINT messages_check CHECK (((deleted_at IS NOT NULL) OR (body IS NOT NULL) OR (attachment_key IS NOT NULL) OR (item_id IS NOT NULL)))
);


--
-- Name: moderation_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.moderation_log (
    id bigint NOT NULL,
    actor_id text,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: moderation_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.moderation_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.moderation_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rarity_scales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rarity_scales (
    category text NOT NULL,
    levels jsonb NOT NULL,
    method_version integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    CONSTRAINT rarity_scales_levels_check CHECK (((jsonb_typeof(levels) = 'array'::text) AND (jsonb_array_length(levels) >= 2)))
);


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id uuid DEFAULT uuidv7() NOT NULL,
    reporter_id text,
    target_type text NOT NULL,
    target_id text NOT NULL,
    target_user_id text,
    reason text NOT NULL,
    details text,
    status text DEFAULT 'open'::text NOT NULL,
    resolution text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by text,
    CONSTRAINT reports_details_check CHECK ((length(details) <= 1000)),
    CONSTRAINT reports_reason_check CHECK ((reason = ANY (ARRAY['spam'::text, 'scam'::text, 'harassment'::text, 'not_own_photo'::text, 'inappropriate'::text, 'other'::text]))),
    CONSTRAINT reports_resolution_check CHECK ((length(resolution) <= 500)),
    CONSTRAINT reports_status_check CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text, 'dismissed'::text]))),
    CONSTRAINT reports_target_type_check CHECK ((target_type = ANY (ARRAY['user'::text, 'copy'::text, 'photo'::text, 'message'::text])))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    token text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    ip_address text,
    user_agent text,
    user_id text NOT NULL,
    impersonated_by text
);


--
-- Name: user_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_blocks (
    blocker_id text NOT NULL,
    blocked_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_blocks_check CHECK ((blocker_id <> blocked_id))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    image text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    username text,
    display_username text,
    role text DEFAULT 'user'::text NOT NULL,
    banned boolean DEFAULT false NOT NULL,
    ban_reason text,
    ban_expires timestamp with time zone,
    bio text,
    city text,
    is_private boolean DEFAULT false NOT NULL,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['user'::text, 'moderator'::text, 'admin'::text])))
);


--
-- Name: verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verifications (
    id text NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: catalog_edits catalog_edits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_edits
    ADD CONSTRAINT catalog_edits_pkey PRIMARY KEY (id);


--
-- Name: catalog_entries catalog_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_entries
    ADD CONSTRAINT catalog_entries_pkey PRIMARY KEY (id);


--
-- Name: catalog_relations catalog_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_relations
    ADD CONSTRAINT catalog_relations_pkey PRIMARY KEY (from_id, relation, to_id);


--
-- Name: collection_items collection_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_items
    ADD CONSTRAINT collection_items_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_user_a_user_b_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_a_user_b_key UNIQUE (user_a, user_b);


--
-- Name: copy_photos copy_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copy_photos
    ADD CONSTRAINT copy_photos_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: moderation_log moderation_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_log
    ADD CONSTRAINT moderation_log_pkey PRIMARY KEY (id);


--
-- Name: rarity_scales rarity_scales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rarity_scales
    ADD CONSTRAINT rarity_scales_pkey PRIMARY KEY (category);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_key UNIQUE (token);


--
-- Name: user_blocks user_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_pkey PRIMARY KEY (blocker_id, blocked_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: verifications verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_pkey PRIMARY KEY (id);


--
-- Name: accounts_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX accounts_user_id_idx ON public.accounts USING btree (user_id);


--
-- Name: catalog_edits_catalog_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX catalog_edits_catalog_idx ON public.catalog_edits USING btree (catalog_id);


--
-- Name: catalog_edits_proposed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX catalog_edits_proposed_idx ON public.catalog_edits USING btree (created_at) WHERE (status = 'proposed'::text);


--
-- Name: catalog_edits_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX catalog_edits_user_idx ON public.catalog_edits USING btree (user_id, created_at DESC);


--
-- Name: catalog_entries_attributes_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX catalog_entries_attributes_idx ON public.catalog_entries USING gin (attributes jsonb_path_ops);


--
-- Name: catalog_entries_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX catalog_entries_category_idx ON public.catalog_entries USING btree (category, status);


--
-- Name: catalog_entries_search_compact_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX catalog_entries_search_compact_idx ON public.catalog_entries USING gin (search_compact public.gin_trgm_ops);


--
-- Name: catalog_entries_search_text_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX catalog_entries_search_text_idx ON public.catalog_entries USING gin (search_text public.gin_trgm_ops);


--
-- Name: catalog_relations_to_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX catalog_relations_to_idx ON public.catalog_relations USING btree (to_id, relation);


--
-- Name: collection_items_catalog_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collection_items_catalog_idx ON public.collection_items USING btree (catalog_id) WHERE (status <> 'wanted'::text);


--
-- Name: collection_items_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collection_items_owner_idx ON public.collection_items USING btree (owner_id, created_at DESC);


--
-- Name: collection_items_wanted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collection_items_wanted_idx ON public.collection_items USING btree (catalog_id) WHERE (status = 'wanted'::text);


--
-- Name: collection_items_wanted_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX collection_items_wanted_uniq ON public.collection_items USING btree (owner_id, catalog_id) WHERE (status = 'wanted'::text);


--
-- Name: conversations_a_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_a_idx ON public.conversations USING btree (user_a, last_message_at DESC);


--
-- Name: conversations_b_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_b_idx ON public.conversations USING btree (user_b, last_message_at DESC);


--
-- Name: copy_photos_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX copy_photos_item_idx ON public.copy_photos USING btree (item_id, "position");


--
-- Name: copy_photos_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX copy_photos_pending_idx ON public.copy_photos USING btree (created_at) WHERE (status = 'pending'::text);


--
-- Name: messages_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_conversation_idx ON public.messages USING btree (conversation_id, created_at DESC);


--
-- Name: messages_sender_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_sender_recent_idx ON public.messages USING btree (sender_id, created_at DESC);


--
-- Name: reports_once_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX reports_once_idx ON public.reports USING btree (reporter_id, target_type, target_id) WHERE (status = 'open'::text);


--
-- Name: reports_open_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reports_open_idx ON public.reports USING btree (created_at) WHERE (status = 'open'::text);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_user_id_idx ON public.sessions USING btree (user_id);


--
-- Name: user_blocks_blocked_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_blocks_blocked_idx ON public.user_blocks USING btree (blocked_id);


--
-- Name: verifications_identifier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verifications_identifier_idx ON public.verifications USING btree (identifier);


--
-- Name: catalog_entries catalog_entries_before_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER catalog_entries_before_write BEFORE INSERT OR UPDATE ON public.catalog_entries FOR EACH ROW EXECUTE FUNCTION public.catalog_entries_before_write();


--
-- Name: accounts accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: catalog_edits catalog_edits_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_edits
    ADD CONSTRAINT catalog_edits_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES public.catalog_entries(id);


--
-- Name: catalog_edits catalog_edits_result_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_edits
    ADD CONSTRAINT catalog_edits_result_catalog_id_fkey FOREIGN KEY (result_catalog_id) REFERENCES public.catalog_entries(id);


--
-- Name: catalog_edits catalog_edits_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_edits
    ADD CONSTRAINT catalog_edits_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: catalog_edits catalog_edits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_edits
    ADD CONSTRAINT catalog_edits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: catalog_entries catalog_entries_merged_into_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_entries
    ADD CONSTRAINT catalog_entries_merged_into_fkey FOREIGN KEY (merged_into) REFERENCES public.catalog_entries(id);


--
-- Name: catalog_relations catalog_relations_from_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_relations
    ADD CONSTRAINT catalog_relations_from_id_fkey FOREIGN KEY (from_id) REFERENCES public.catalog_entries(id) ON DELETE CASCADE;


--
-- Name: catalog_relations catalog_relations_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_relations
    ADD CONSTRAINT catalog_relations_to_id_fkey FOREIGN KEY (to_id) REFERENCES public.catalog_entries(id) ON DELETE CASCADE;


--
-- Name: collection_items collection_items_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_items
    ADD CONSTRAINT collection_items_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES public.catalog_entries(id);


--
-- Name: collection_items collection_items_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_items
    ADD CONSTRAINT collection_items_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.collection_items(id) ON DELETE SET NULL;


--
-- Name: conversations conversations_user_a_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_a_fkey FOREIGN KEY (user_a) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_user_b_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_b_fkey FOREIGN KEY (user_b) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: copy_photos copy_photos_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copy_photos
    ADD CONSTRAINT copy_photos_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.collection_items(id) ON DELETE CASCADE;


--
-- Name: copy_photos copy_photos_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copy_photos
    ADD CONSTRAINT copy_photos_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: copy_photos copy_photos_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copy_photos
    ADD CONSTRAINT copy_photos_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.collection_items(id) ON DELETE SET NULL;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: moderation_log moderation_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_log
    ADD CONSTRAINT moderation_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: reports reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: reports reports_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: reports reports_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_blocks user_blocks_blocked_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_blocks user_blocks_blocker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict dbmate


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('20261031120000'),
    ('20261031150000'),
    ('20261031170000'),
    ('20261031180000'),
    ('20261031190000'),
    ('20261031200000'),
    ('20261031210000'),
    ('20261031220000');
