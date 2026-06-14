do $$
begin
  if to_regclass('public.property_finance') is not null then
    alter table public.property_finance
      add column if not exists rental_tax_monthly numeric(12,2);
  end if;
end $$;

notify pgrst, 'reload schema';
