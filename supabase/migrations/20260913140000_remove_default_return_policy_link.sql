begin;

delete from public.site_links
where location = 'header'
  and lower(btrim(label)) = 'return policy'
  and url = '/return-policy';

commit;
