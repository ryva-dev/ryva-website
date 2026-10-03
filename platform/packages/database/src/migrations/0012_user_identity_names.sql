-- Canonical account identity: first/last on users; display name remains users.name.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';

UPDATE users
   SET first_name = CASE
         WHEN trim(name) = '' THEN ''
         WHEN position(' ' in trim(name)) = 0 THEN trim(name)
         ELSE split_part(trim(name), ' ', 1)
       END,
       last_name = CASE
         WHEN position(' ' in trim(name)) = 0 THEN ''
         ELSE trim(substring(trim(name) from position(' ' in trim(name)) + 1))
       END
 WHERE first_name = '' AND last_name = '' AND trim(name) <> '';
