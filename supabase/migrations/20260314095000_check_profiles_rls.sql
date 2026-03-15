DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, cmd, permissive, roles::text, qual, with_check
    FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public'
    ORDER BY cmd, policyname
  LOOP
    RAISE NOTICE 'POLICY: % | CMD: % | PERMISSIVE: % | ROLES: % | USING: % | CHECK: %',
      pol.policyname, pol.cmd, pol.permissive, pol.roles,
      left(pol.qual::text, 80), left(pol.with_check::text, 80);
  END LOOP;
END $$;
