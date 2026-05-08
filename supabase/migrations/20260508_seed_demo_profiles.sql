-- Seed real-shaped profile data for the small set of pilot accounts so the
-- dashboard has a populated streak / accuracy / topic-distribution view from
-- day one. The migration is fully idempotent: stable problem_ids guard
-- against duplicate inserts on re-run. Once the user starts solving real
-- problems through the editor, /api/attempts/record continues to append
-- to the same problem_attempts table and the dashboard updates organically.

create or replace function public.seed_demo_profile(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_full_name text;
  v_bio text;
  v_degree text;
  v_interests text[];
begin
  select email into v_email from public.profiles where id = p_user_id;
  if v_email is null then
    return;
  end if;

  -- Stable per-account profile content (no Faker / random — predictable demo).
  if lower(v_email) = 'msalmansaleem08@gmail.com' then
    v_full_name := 'Salman Saleem';
    v_bio       := 'Building CodeSage — an AI mentor that teaches algorithmic thinking, not copy-paste answers.';
    v_degree    := 'BS Computer Science, FAST-NUCES';
    v_interests := array['Algorithms', 'Systems', 'AI Tooling'];
  elsif lower(v_email) = 'i220904@nu.edu.pk' then
    v_full_name := 'Salman (FAST i22-0904)';
    v_bio       := 'CS student at FAST-NUCES. Practising structured problem solving daily.';
    v_degree    := 'BS Computer Science, FAST-NUCES';
    v_interests := array['Data Structures', 'Competitive Programming', 'OOP'];
  elsif lower(v_email) = 'salmanss4790489@gmail.com' then
    v_full_name := 'Salman S.';
    v_bio       := 'Sharpening logic-first coding habits with CodeSage.';
    v_degree    := 'BS Computer Science';
    v_interests := array['Recursion', 'Strings', 'Graphs'];
  else
    return;
  end if;

  update public.profiles
    set full_name  = coalesce(nullif(full_name, ''), v_full_name),
        bio        = coalesce(nullif(bio, ''),       v_bio),
        degree     = coalesce(nullif(degree, ''),    v_degree),
        interests  = case when coalesce(array_length(interests, 1), 0) = 0
                          then v_interests
                          else interests
                     end
    where id = p_user_id;

  -- Historical problem attempts — distributed across the last 13 days so the
  -- dashboard has a visible streak and topic distribution. Seeds 12 records.
  -- Stable problem_ids (`demo-seed-XX`) make this idempotent on re-run.
  insert into public.problem_attempts
    (user_id, problem_id, topic, is_correct, attempts_count, hints_used, created_at)
  select p_user_id, t.problem_id, t.topic, t.is_correct, t.attempts_count, t.hints_used,
         (now() - make_interval(days => t.days_ago, hours => t.hour_offset))
  from (values
    ('demo-seed-01', 'Strings',         true,  1, 1,  12, 14),
    ('demo-seed-02', 'Arrays',          true,  2, 2,  11, 15),
    ('demo-seed-03', 'Loops',           false, 3, 0,  10, 13),
    ('demo-seed-04', 'Loops',           true,  2, 1,  10, 16),
    ('demo-seed-05', 'Recursion',       true,  3, 3,   8, 11),
    ('demo-seed-06', 'Strings',         true,  1, 0,   7, 14),
    ('demo-seed-07', 'Data Structures', true,  2, 2,   6, 17),
    ('demo-seed-08', 'OOP',             true,  1, 1,   5, 10),
    ('demo-seed-09', 'Arrays',          false, 2, 0,   3, 12),
    ('demo-seed-10', 'Arrays',          true,  3, 1,   2, 18),
    ('demo-seed-11', 'Recursion',       true,  2, 2,   1, 13),
    ('demo-seed-12', 'Strings',         true,  1, 0,   0, 19)
  ) as t(problem_id, topic, is_correct, attempts_count, hints_used, days_ago, hour_offset)
  where not exists (
    select 1 from public.problem_attempts pa
    where pa.user_id = p_user_id and pa.problem_id = t.problem_id
  );
end;
$$;

-- Apply once for any of the target users that already exist in profiles.
do $$
declare
  v_id uuid;
begin
  for v_id in
    select id from public.profiles
    where lower(email) in (
      'msalmansaleem08@gmail.com',
      'i220904@nu.edu.pk',
      'salmanss4790489@gmail.com'
    )
  loop
    perform public.seed_demo_profile(v_id);
  end loop;
end$$;

-- Auto-seed when one of the target users signs up later.
create or replace function public.handle_demo_profile_seed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.email) in (
    'msalmansaleem08@gmail.com',
    'i220904@nu.edu.pk',
    'salmanss4790489@gmail.com'
  ) then
    perform public.seed_demo_profile(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_seed_demo_profile on public.profiles;
create trigger trg_seed_demo_profile
after insert on public.profiles
for each row
execute function public.handle_demo_profile_seed();
