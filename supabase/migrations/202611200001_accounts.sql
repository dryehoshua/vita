begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check(length(display_name)<=60),
 residence text not null default 'unspecified' check(residence in ('unspecified','tourist','cdmx','roma-condesa')),
 language text not null default 'es' check(language in ('es','en')),
 avatar_path text check(avatar_path is null or avatar_path = id::text || '/avatar.webp'),
 created_at timestamptz not null default now()
);
create function public.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,display_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'display_name',''),60));
 return new;
end $$;
create trigger vita_create_profile after insert on auth.users for each row execute function public.create_profile();
insert into public.profiles(id) select id from auth.users on conflict do nothing;
create table public.global_roles (
 user_id uuid references auth.users(id) on delete cascade,
 role text check(role in ('admin','editor','writer','guide')), primary key(user_id,role)
);
create table public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 120),
 category text not null default 'business', created_at timestamptz not null default now()
);
create table public.memberships (
 organization_id uuid references public.organizations on delete cascade,
 user_id uuid references auth.users on delete cascade,
 role text not null check(role in ('owner','staff')), active boolean not null default true,
 primary key(organization_id,user_id)
);
create table public.access_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 kind text not null check(kind in ('business','guide','writer')), name text not null check(length(name) between 1 and 120),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(), decided_at timestamptz
);
create unique index one_pending_request on public.access_requests(user_id,kind) where status='pending';
create table public.favorites (
 user_id uuid references auth.users on delete cascade,
 path text check(path ~ '^/[a-zA-Z0-9/_-]*$' and path !~ '^//' and length(path)<=240),
 title text not null check(length(title) between 1 and 150), created_at timestamptz not null default now(),
 primary key(user_id,path)
);
-- No client may award, spend or edit points. Future transactional program only.
create table public.point_entries (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 program text not null, delta integer not null check(delta<>0), reason text not null,
 reference text not null unique, created_at timestamptz not null default now()
);
create table public.audit_log (
 id bigint generated always as identity primary key, actor uuid references auth.users,
 action text not null, subject text not null, created_at timestamptz not null default now()
);
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'aal'='aal2',false) and exists(select 1 from public.global_roles where user_id=auth.uid() and role='admin')
$$;
create function public.owns_org(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships where organization_id=org and user_id=auth.uid() and role='owner' and active)
$$;
create function public.in_org(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships where organization_id=org and user_id=auth.uid() and active)
$$;
alter table public.profiles enable row level security;
alter table public.global_roles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.access_requests enable row level security;
alter table public.favorites enable row level security;
alter table public.point_entries enable row level security;
alter table public.audit_log enable row level security;
revoke all on public.profiles, public.global_roles, public.organizations, public.memberships, public.access_requests, public.favorites, public.point_entries, public.audit_log from anon, authenticated;
grant select on public.profiles,public.global_roles,public.organizations,public.memberships,public.access_requests,public.favorites,public.point_entries to authenticated;
grant update(display_name,residence,language,avatar_path) on public.profiles to authenticated;
grant insert(user_id,kind,name) on public.access_requests to authenticated;
grant insert(user_id,path,title),delete on public.favorites to authenticated;
create policy own_profile_read on public.profiles for select to authenticated using(id=auth.uid());
create policy own_profile_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy own_roles on public.global_roles for select to authenticated using(user_id=auth.uid());
create policy member_org on public.organizations for select to authenticated using(public.in_org(id) or public.is_admin());
create policy member_read on public.memberships for select to authenticated using(user_id=auth.uid() or public.owns_org(organization_id) or public.is_admin());
create policy request_read on public.access_requests for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy request_insert on public.access_requests for insert to authenticated with check(user_id=auth.uid() and status='pending' and decided_at is null);
create policy favorites_read on public.favorites for select to authenticated using(user_id=auth.uid());
create policy favorites_insert on public.favorites for insert to authenticated with check(user_id=auth.uid());
create policy favorites_delete on public.favorites for delete to authenticated using(user_id=auth.uid());
create policy points_read on public.point_entries for select to authenticated using(user_id=auth.uid());
create function public.decide_request(request_id uuid, approve boolean) returns void language plpgsql security definer set search_path='' as $$
declare r public.access_requests; org uuid;
begin
 if not public.is_admin() then raise exception 'Forbidden'; end if;
 select * into r from public.access_requests where id=request_id for update;
 if not found or r.status<>'pending' then raise exception 'Request is not pending'; end if;
 if approve then
  if r.kind='business' then
   insert into public.organizations(name) values(r.name) returning id into org;
   insert into public.memberships values(org,r.user_id,'owner',true);
  else insert into public.global_roles values(r.user_id,r.kind) on conflict do nothing;
  end if;
 end if;
 update public.access_requests set status=case when approve then 'approved' else 'rejected' end,decided_at=now() where id=request_id;
 insert into public.audit_log(actor,action,subject) values(auth.uid(),case when approve then 'approve_request' else 'reject_request' end,request_id::text);
end $$;
-- Existing verified accounts only. Owner cannot grant owner/admin/editor privileges.
create function public.set_team_member(org uuid, member_email text, enabled boolean) returns void language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 if not (public.owns_org(org) or public.is_admin()) then raise exception 'Forbidden'; end if;
 select id into target from auth.users where lower(email)=lower(trim(member_email)) and email_confirmed_at is not null;
 if target is null then raise exception 'Verified account required'; end if;
 insert into public.memberships values(org,target,'staff',enabled)
 on conflict(organization_id,user_id) do update set active=excluded.active where public.memberships.role='staff';
 if not found then raise exception 'Owner cannot be modified here'; end if;
 insert into public.audit_log(actor,action,subject) values(auth.uid(),case when enabled then 'enable_staff' else 'disable_staff' end,org::text||':'||target::text);
end $$;
create function public.account_metrics() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Forbidden'; end if;
 return jsonb_build_object(
  'accounts',(select count(*) from auth.users where email_confirmed_at is not null),
  'profiles',(select count(*) from public.profiles),
  'roles',(select coalesce(jsonb_object_agg(role,n),'{}'::jsonb) from (
   select role,count(distinct user_id) n from (
    select role,user_id from public.global_roles union all select role,user_id from public.memberships where active
   ) r group by role) c),
  'residence',(select coalesce(jsonb_object_agg(residence,n),'{}'::jsonb) from(select residence,count(*) n from public.profiles group by residence) c),
  'pending',(select count(*) from public.access_requests where status='pending'),
  'generated_at',now());
end $$;
revoke all on function public.create_profile(),public.is_admin(),public.owns_org(uuid),public.in_org(uuid),public.decide_request(uuid,boolean),public.set_team_member(uuid,text,boolean),public.account_metrics() from public,anon;
grant execute on function public.is_admin(),public.owns_org(uuid),public.in_org(uuid),public.decide_request(uuid,boolean),public.set_team_member(uuid,text,boolean),public.account_metrics() to authenticated;
-- Private photos. No public bucket or user-supplied remote URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('avatars','avatars',false,2097152,array['image/webp']);
create policy avatar_read on storage.objects for select to authenticated using(bucket_id='avatars' and name=auth.uid()::text||'/avatar.webp');
create policy avatar_insert on storage.objects for insert to authenticated with check(bucket_id='avatars' and name=auth.uid()::text||'/avatar.webp');
create policy avatar_update on storage.objects for update to authenticated using(bucket_id='avatars' and name=auth.uid()::text||'/avatar.webp') with check(bucket_id='avatars' and name=auth.uid()::text||'/avatar.webp');
create policy avatar_delete on storage.objects for delete to authenticated using(bucket_id='avatars' and name=auth.uid()::text||'/avatar.webp');
commit;
