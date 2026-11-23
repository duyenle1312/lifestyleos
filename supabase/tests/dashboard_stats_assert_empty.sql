-- dashboard.usage_stats() on a database with no users or data (stub schema + migrations only).
\set ON_ERROR_STOP on

do $$
declare s jsonb; k text;
begin
  s := dashboard.usage_stats();
  if (s->'totals'->>'users')::int <> 0 then raise exception 'FAIL: empty users'; end if;
  if s->'totals'->'retentionD30' <> 'null'::jsonb then raise exception 'FAIL: empty retention not null: %', s->'totals'->'retentionD30'; end if;
  if s->'lastActivity'->'at' <> 'null'::jsonb or s->'lastActivity'->'kind' <> 'null'::jsonb then
    raise exception 'FAIL: empty lastActivity: %', s->'lastActivity';
  end if;
  if s->'totals'->'otherCurrencies' <> '[]'::jsonb then raise exception 'FAIL: empty otherCurrencies'; end if;
  for k in select jsonb_object_keys(s->'daily') loop
    if jsonb_array_length(s->'daily'->k) <> 730 then raise exception 'FAIL: daily % length', k; end if;
    if exists (select 1 from jsonb_array_elements(s->'daily'->k) e where e::numeric <> 0) then
      raise exception 'FAIL: daily % not all zeros', k;
    end if;
  end loop;
  if (select count(*) from jsonb_object_keys(s->'daily')) <> 9 then raise exception 'FAIL: daily key count'; end if;
  raise notice 'dashboard empty asserts passed';
end $$;
