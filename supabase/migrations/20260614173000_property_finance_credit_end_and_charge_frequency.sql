do $$
begin
  if to_regclass('public.property_finance') is not null then
    alter table public.property_finance
      add column if not exists loan_end_year integer,
      add column if not exists fixed_charges_frequency text not null default 'monthly';

    alter table public.property_finance
      drop constraint if exists property_finance_loan_end_year_check,
      drop constraint if exists property_finance_fixed_charges_frequency_check;

    alter table public.property_finance
      add constraint property_finance_loan_end_year_check
        check (loan_end_year is null or (loan_end_year >= 1900 and loan_end_year <= 2200)),
      add constraint property_finance_fixed_charges_frequency_check
        check (fixed_charges_frequency in ('monthly', 'quarterly', 'yearly'));

    update public.property_finance
    set loan_end_year = extract(year from now())::integer + ceiling(loan_remaining_months::numeric / 12)::integer
    where loan_end_year is null
      and loan_remaining_months is not null
      and loan_remaining_months > 0;
  end if;
end $$;

notify pgrst, 'reload schema';
