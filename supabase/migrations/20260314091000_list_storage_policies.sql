-- This is a no-op migration that just lists policies for debugging
-- We'll check via a DO block that raises notices
DO $$
DECLARE
  pol RECORD;
  total INT := 0;
BEGIN
  FOR pol IN
    SELECT policyname, cmd, permissive, roles::text
    FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    ORDER BY policyname
  LOOP
    RAISE NOTICE 'POLICY: % | CMD: % | PERMISSIVE: % | ROLES: %', pol.policyname, pol.cmd, pol.permissive, pol.roles;
    total := total + 1;
  END LOOP;
  RAISE NOTICE 'Total policies on storage.objects: %', total;
END $$;
