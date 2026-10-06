ALTER TABLE transactional_email_outbox
  DROP CONSTRAINT transactional_email_outbox_message_kind_check;

ALTER TABLE transactional_email_outbox
  ADD CONSTRAINT transactional_email_outbox_message_kind_check
  CHECK (message_kind IN (
    'password_reset',
    'account_closure_requested',
    'account_closure_support_notification'
  ));
