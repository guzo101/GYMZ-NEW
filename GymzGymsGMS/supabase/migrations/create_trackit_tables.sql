-- TrackIt core tables for workouts, nutrition, gamification, and analytics

create table if not exists public.users_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  username text,
  email text,
  fitness_goal text,
  age integer,
  weight numeric,
  height numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.daily_nutrition_logs (
  log_id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  food_name text not null,
  quantity numeric not null,
  calories numeric not null,
  protein numeric default 0,
  carbs numeric default 0,
  fats numeric default 0,
  fiber numeric default 0,
  meal_type text check (meal_type in ('breakfast','lunch','dinner','snack')) default 'breakfast',
  logged_at timestamptz default now(),
  barcode_scanned boolean default false
);

create table if not exists public.daily_macro_targets (
  target_id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  daily_calorie_goal numeric not null,
  protein_goal numeric default 0,
  carbs_goal numeric default 0,
  fats_goal numeric default 0,
  date date not null,
  unique (user_id, date)
);

create table if not exists public.workout_sessions (
  session_id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  exercise_name text not null,
  sets integer,
  reps integer,
  weight numeric,
  duration integer,
  intensity_level text,
  form_score integer check (form_score between 0 and 100),
  completed_at timestamptz default now()
);

create table if not exists public.personal_records (
  pr_id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  exercise_name text not null,
  max_weight numeric not null,
  reps_achieved integer,
  achieved_date timestamptz default now()
);

create table if not exists public.user_achievements (
  achievement_id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  achievement_type text not null,
  points_earned integer default 0,
  streak_count integer default 0,
  unlocked_at timestamptz default now(),
  is_active boolean default true
);

create table if not exists public.leaderboard_data (
  leaderboard_id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  weekly_points integer default 0,
  total_points integer default 0,
  rank integer,
  calories_logged_count integer default 0,
  last_updated_at timestamptz default now()
);

create table if not exists public.form_analysis_logs (
  analysis_id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  exercise_name text not null,
  form_score integer check (form_score between 0 and 100),
  feedback_points text,
  camera_url text,
  analyzed_at timestamptz default now()
);

create table if not exists public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  action_type text not null,
  points integer not null,
  created_at timestamptz default now()
);

create table if not exists public.leaderboard_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  snapshot_week date not null,
  rank integer,
  points integer,
  created_at timestamptz default now()
);

-- Simple trigger to keep users_profiles.updated_at current
create or replace function public.update_users_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_profiles_updated_at on public.users_profiles;
create trigger trg_users_profiles_updated_at
before update on public.users_profiles
for each row execute function public.update_users_profiles_updated_at();


