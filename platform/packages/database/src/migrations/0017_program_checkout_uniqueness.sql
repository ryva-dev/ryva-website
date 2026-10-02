ALTER TABLE program_checkout_sessions
  ADD COLUMN checkout_url TEXT;

CREATE UNIQUE INDEX program_checkout_sessions_one_open_per_user_idx
  ON program_checkout_sessions(user_id)
  WHERE status='created';

