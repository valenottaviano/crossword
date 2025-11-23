-- Create a table for public profiles
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  username text unique,
  updated_at timestamp with time zone,
  constraint username_length check (char_length(username) >= 3)
);

-- Set up Row Level Security (RLS)
alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- Create a table for friendships
create table friendships (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) not null,
  friend_id uuid references profiles(id) not null,
  status text check (status in ('pending', 'accepted')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, friend_id)
);

alter table friendships enable row level security;

-- Policy: Users can view their own friendships
create policy "Users can view their own friendships" on friendships
  for select using (auth.uid() = user_id or auth.uid() = friend_id);

-- Policy: Users can insert friend requests
create policy "Users can insert friend requests" on friendships
  for insert with check (auth.uid() = user_id);

-- Policy: Users can update friendships (accept requests)
create policy "Users can update friendships" on friendships
  for update using (auth.uid() = friend_id);

-- Create a table for game results
create table game_results (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) not null,
  date date not null,
  time_seconds int not null,
  completed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table game_results enable row level security;

-- Policy: Everyone can view game results (for leaderboards)
-- You might want to restrict this to friends only in a real app, but for simplicity:
create policy "Game results are viewable by everyone" on game_results
  for select using (true);

create policy "Users can insert their own game results" on game_results
  for insert with check (auth.uid() = user_id);

-- Function to handle new user creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call the function on new user creation
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
