-- Run this in the Supabase SQL Editor before deploying the multi-plan feature.
-- It is idempotent and keeps existing WorkoutPlan rows by placing them in
-- one active "Plano atual" program per user.

create table if not exists public."WorkoutProgram" (
  "id" text primary key default gen_random_uuid(),
  "nome" text not null,
  "templateId" text,
  "objetivo" text,
  "divisao" text,
  "frequencia" text,
  "isActive" boolean not null default false,
  "createdAt" timestamp(3) without time zone not null default current_timestamp,
  "updatedAt" timestamp(3) without time zone not null default current_timestamp,
  "userId" text not null references public."User"("id") on delete cascade
);

alter table public."WorkoutPlan"
  add column if not exists "programId" text;

do $$
declare
  user_record record;
  program_id text;
begin
  for user_record in
    select distinct "userId" from public."WorkoutPlan" where "programId" is null
  loop
    insert into public."WorkoutProgram" ("nome", "isActive", "userId")
    values ('Plano atual', true, user_record."userId")
    returning "id" into program_id;

    update public."WorkoutPlan"
      set "programId" = program_id
      where "userId" = user_record."userId" and "programId" is null;
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'WorkoutPlan_programId_fkey'
  ) then
    alter table public."WorkoutPlan"
      add constraint "WorkoutPlan_programId_fkey"
      foreign key ("programId") references public."WorkoutProgram"("id")
      on delete set null on update cascade;
  end if;
end $$;

create index if not exists "WorkoutProgram_userId_idx"
  on public."WorkoutProgram"("userId");

create index if not exists "WorkoutPlan_programId_idx"
  on public."WorkoutPlan"("programId");

alter table public."WorkoutProgram" enable row level security;
