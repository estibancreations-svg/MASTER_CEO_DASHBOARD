insert into public.system_settings (key, value)
values ('kling_api_base', '"https://api-singapore.klingai.com"'::jsonb)
on conflict (key) do update set value = excluded.value;
