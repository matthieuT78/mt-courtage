-- Only the explicitly approved owner account should retain database admin rights.
update public.profiles
set is_admin = (lower(email) = 'matthieu.turbier@gmail.com')
where is_admin is distinct from (lower(email) = 'matthieu.turbier@gmail.com');

notify pgrst, 'reload schema';
