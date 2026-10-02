-- v2.02: character names are unique within an owner's universe, not globally.
-- Existing rows are preserved; authenticated ownership policies are unchanged.
alter table public.vw_characters
  drop constraint vw_characters_universe_name_key,
  add constraint vw_characters_owner_universe_name_key unique (owner_id, universe, name);
