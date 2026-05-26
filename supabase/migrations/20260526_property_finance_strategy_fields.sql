do $$
begin
  if to_regclass('public.property_finance') is not null then
    alter table public.property_finance
      add column if not exists loan_rate_percent numeric(5,2),
      add column if not exists loan_remaining_months integer,
      add column if not exists tax_regime text;
  end if;
end $$;
