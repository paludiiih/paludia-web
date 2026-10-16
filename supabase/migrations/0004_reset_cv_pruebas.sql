-- Reinicia el cupo de CV consumido durante las pruebas iniciales de la herramienta,
-- para no descontarle al usuario un uso que gastaron las verificaciones. Se aplica una vez.
update public.usage_windows set used = 0 where kind = 'cv';
