-- Run this in the Supabase SQL Editor to satisfy the public-table RLS warnings.
-- No policies are created here, so direct public access through Supabase APIs stays denied.
-- The Express API continues to enforce access using its own JWT/auth checks.

alter table public."User" enable row level security;
alter table public."PasswordResetToken" enable row level security;
alter table public."WeightLog" enable row level security;
alter table public."Exercise" enable row level security;
alter table public."WorkoutPlan" enable row level security;
alter table public."WorkoutLog" enable row level security;
alter table public."WorkoutSession" enable row level security;
