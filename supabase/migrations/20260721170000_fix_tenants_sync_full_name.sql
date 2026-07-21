-- trg_tenants_sync_full_name recalculait toujours full_name depuis first_name/last_name,
-- même quand les deux sont vides — ce qui écrase silencieusement le filet de sécurité
-- `full_name: "Locataire"` que l'app envoie pour un formulaire de création vide
-- (components/landlord/sections/SectionLocataires.tsx, saveTenant). Résultat en prod :
-- un locataire "fantôme" avec full_name = '' dès qu'un formulaire vide était soumis,
-- qui cassait ensuite la vérification "mise en route terminée" (aucun bail rattaché).
--
-- Correctif : ne resynchroniser full_name depuis prénom/nom que si l'un des deux est
-- renseigné ; sinon laisser passer ce que l'app a fourni. Et si, malgré tout, full_name
-- reste vide, forcer "Locataire" au niveau trigger — dernier filet, valable pour tout
-- appelant futur, pas seulement le formulaire actuel.

create or replace function public.tenants_sync_full_name()
returns trigger
language plpgsql
as $function$
begin
  if new.first_name is not null or new.last_name is not null then
    new.full_name := trim(
      coalesce(new.first_name, '') ||
      case when new.first_name is not null and new.last_name is not null then ' ' else '' end ||
      coalesce(new.last_name, '')
    );
  end if;

  if coalesce(trim(new.full_name), '') = '' then
    new.full_name := 'Locataire';
  end if;

  return new;
end;
$function$;
