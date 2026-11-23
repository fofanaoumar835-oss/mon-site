create table if not exists public.sellers (
    user_id uuid primary key references auth.users (id) on delete cascade,
    created_at timestamptz not null default now()
);

create or replace function public.is_seller()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.sellers
        where user_id = (select auth.uid())
    );
$$;

revoke all on function public.is_seller() from public;
grant execute on function public.is_seller() to anon, authenticated;

create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),
    name varchar(120) not null check (char_length(btrim(name)) > 0),
    description varchar(2000) not null default '',
    price numeric(12, 0) not null check (price >= 0),
    image_path text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.reviews (
    id uuid primary key default gen_random_uuid(),
    author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    name varchar(80) not null check (char_length(btrim(name)) > 0),
    rating integer not null check (rating between 1 and 5),
    content varchar(2000) not null check (char_length(btrim(content)) > 0),
    created_at timestamptz not null default now()
);

create table if not exists public.page_likes (
    user_id uuid primary key references auth.users (id) on delete cascade,
    created_at timestamptz not null default now()
);

alter table public.sellers enable row level security;
alter table public.products enable row level security;
alter table public.reviews enable row level security;
alter table public.page_likes enable row level security;

grant select on public.products, public.reviews, public.page_likes to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant insert on public.reviews to authenticated;
grant insert, delete on public.page_likes to authenticated;
revoke insert, update, delete on public.reviews from anon;
revoke insert, update, delete on public.page_likes from anon;
revoke select on public.page_likes from anon;

drop policy if exists "Anyone can view products" on public.products;
create policy "Anyone can view products"
on public.products for select
to anon, authenticated
using (true);

drop policy if exists "Sellers can add products" on public.products;
create policy "Sellers can add products"
on public.products for insert
to authenticated
with check ((select public.is_seller()));

drop policy if exists "Sellers can update products" on public.products;
create policy "Sellers can update products"
on public.products for update
to authenticated
using ((select public.is_seller()))
with check ((select public.is_seller()));

drop policy if exists "Sellers can delete products" on public.products;
create policy "Sellers can delete products"
on public.products for delete
to authenticated
using ((select public.is_seller()));

drop policy if exists "Anyone can view reviews" on public.reviews;
create policy "Anyone can view reviews"
on public.reviews for select
to anon, authenticated
using (true);

drop policy if exists "Anyone can publish a review" on public.reviews;
create policy "Anyone can publish a review"
on public.reviews for insert
to anon, authenticated
with check (
    author_id = (select auth.uid())
    and
    char_length(btrim(name)) between 1 and 80
    and rating between 1 and 5
    and char_length(btrim(content)) between 1 and 2000
);

drop policy if exists "Anyone can view page likes" on public.page_likes;
drop policy if exists "Visitors can view their own like" on public.page_likes;
create policy "Visitors can view their own like"
on public.page_likes for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Anyone can like the page" on public.page_likes;
drop policy if exists "Visitors can like the page" on public.page_likes;
create policy "Visitors can like the page"
on public.page_likes for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Anyone can remove a page like" on public.page_likes;
drop policy if exists "Visitors can remove their own like" on public.page_likes;
create policy "Visitors can remove their own like"
on public.page_likes for delete
to authenticated
using (user_id = (select auth.uid()));

create or replace function public.get_page_like_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
    select count(*) from public.page_likes;
$$;

revoke all on function public.get_page_like_count() from public;
grant execute on function public.get_page_like_count() to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'product-images',
    'product-images',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view product photos" on storage.objects;
create policy "Anyone can view product photos"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists "Sellers can upload product photos" on storage.objects;
create policy "Sellers can upload product photos"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'product-images'
    and (select public.is_seller())
);

drop policy if exists "Sellers can update product photos" on storage.objects;
create policy "Sellers can update product photos"
on storage.objects for update
to authenticated
using (
    bucket_id = 'product-images'
    and (select public.is_seller())
)
with check (
    bucket_id = 'product-images'
    and (select public.is_seller())
);

drop policy if exists "Sellers can delete product photos" on storage.objects;
create policy "Sellers can delete product photos"
on storage.objects for delete
to authenticated
using (
    bucket_id = 'product-images'
    and (select public.is_seller())
);
