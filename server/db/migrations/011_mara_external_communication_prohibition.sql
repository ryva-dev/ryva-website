-- Founder policy: Gmail remains read-only context for Mara. She prepares copy
-- inside Ryva, but never receives send authority or creates Gmail drafts.

UPDATE worker_permissions
SET can_send_emails_with_approval = 0,
    can_send_emails_without_approval = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE worker_id IN ('mara', 'mara-vale');

UPDATE worker_approval_requests
SET status = 'cancelled',
    description = description || ' Cancelled: Mara no longer performs external communication.',
    updated_at = CURRENT_TIMESTAMP
WHERE worker_id IN ('mara', 'mara-vale')
  AND action_type = 'send_email'
  AND status IN ('pending', 'processing');
