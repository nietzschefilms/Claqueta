-- ═══════════════════════════════════════════════════════════════════════════
-- 0001c · Ya aplicada en Supabase (claqueta). Se copia aquí para que el repo
-- coincida con la base. Cierra la función rls_auto_enable si existe.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
