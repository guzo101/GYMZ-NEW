-- Marketing website lead capture
create table if not exists public.website_inquiries (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  email text not null,
  phone text,
  interest text,
  preferred_contact text,
  message text,
  status text not null default 'new',
  source text not null default 'website',
  created_at timestamptz not null default now()
);

create index if not exists website_inquiries_status_idx on public.website_inquiries (status);
create index if not exists website_inquiries_created_idx on public.website_inquiries (created_at desc);

comment on table public.website_inquiries is 'Inbound leads captured from the public website';

-- Visitor chat sessions (anonymous website conversations with the front desk team)
create table if not exists public.visitor_chat_sessions (
  id uuid primary key default uuid_generate_v4(),
  visitor_name text,
  visitor_email text,
  visitor_phone text,
  preferred_channel text,
  status text not null default 'open',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists visitor_chat_sessions_status_idx on public.visitor_chat_sessions (status);
create index if not exists visitor_chat_sessions_last_message_idx on public.visitor_chat_sessions (last_message_at desc);

comment on table public.visitor_chat_sessions is 'Lightweight chat sessions started from the public marketing site';

-- Individual chat messages tied to a visitor session
create table if not exists public.visitor_chat_messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.visitor_chat_sessions(id) on delete cascade,
  sender text not null check (sender in ('visitor', 'admin')),
  message text not null,
  admin_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists visitor_chat_messages_session_idx on public.visitor_chat_messages (session_id);
create index if not exists visitor_chat_messages_created_idx on public.visitor_chat_messages (created_at asc);

comment on table public.visitor_chat_messages is 'Message log for visitor <> admin chat sessions started from the marketing site';

-- Keep session timestamps current whenever a new message is posted
create or replace function public.update_visitor_session_timestamp()
returns trigger as $$
begin
  update public.visitor_chat_sessions
  set last_message_at = now()
  where id = new.session_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists visitor_chat_message_updater on public.visitor_chat_messages;
create trigger visitor_chat_message_updater
after insert on public.visitor_chat_messages
for each row
execute function public.update_visitor_session_timestamp();

-- Note: Row level security is intentionally disabled for these tables for now because
-- the public website must be able to submit inquiries without authentication. Apply
-- tighter policies when an authenticated gateway is introduced.


