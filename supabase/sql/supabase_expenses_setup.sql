-- ============================================
-- FASE 16: GESTIÓN DE GASTOS - DATABASE SETUP
-- ============================================

-- 1. Crear tabla expenses
-- ============================================
create table if not exists expenses (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  date date not null,
  category text not null,
  description text not null,
  amount numeric(10, 2) not null,
  payment_method text not null,
  receipt_url text,
  notes text,
  user_id uuid references auth.users not null
);

-- 2. Crear índices para mejorar performance
-- ============================================
create index if not exists expenses_date_idx on expenses(date desc);
create index if not exists expenses_category_idx on expenses(category);
create index if not exists expenses_user_id_idx on expenses(user_id);
create index if not exists expenses_created_at_idx on expenses(created_at desc);

-- 3. Habilitar Row Level Security
-- ============================================
alter table expenses enable row level security;

-- 4. Crear políticas RLS (todos los usuarios autenticados ven y gestionan todos los gastos; user_id se guarda para auditoría)
-- ============================================
drop policy if exists "Users can view their own expenses" on expenses;
drop policy if exists "Users can insert their own expenses" on expenses;
drop policy if exists "Users can update their own expenses" on expenses;
drop policy if exists "Users can delete their own expenses" on expenses;
drop policy if exists "Users can manage own expenses" on expenses;
drop policy if exists "Authenticated can manage expenses" on expenses;
create policy "Authenticated can manage expenses"
  on expenses for all to authenticated
  using (true) with check (true);

-- 5. Crear bucket de storage para comprobantes
-- ============================================
-- Nota: Ejecutar esto en el SQL Editor de Supabase
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

-- 6. Crear políticas de storage
-- ============================================
-- Política para INSERT (upload)
drop policy if exists "Users can upload receipts" on storage.objects;
create policy "Users can upload receipts"
  on storage.objects for insert
  with check (
    bucket_id = 'receipts' 
    and auth.role() = 'authenticated'
  );

-- Política para SELECT (view): solo autenticados (alineado con migración 20260313210000)
drop policy if exists "Users can view receipts" on storage.objects;
drop policy if exists "Authenticated can view receipts" on storage.objects;
create policy "Authenticated can view receipts"
  on storage.objects for select to authenticated
  using (bucket_id = 'receipts');

-- Política para DELETE
drop policy if exists "Users can delete their receipts" on storage.objects;
create policy "Users can delete their receipts"
  on storage.objects for delete
  using (
    bucket_id = 'receipts' 
    and auth.role() = 'authenticated'
  );

-- Política para UPDATE
drop policy if exists "Users can update receipts" on storage.objects;
create policy "Users can update receipts"
  on storage.objects for update
  using (
    bucket_id = 'receipts' 
    and auth.role() = 'authenticated'
  );
