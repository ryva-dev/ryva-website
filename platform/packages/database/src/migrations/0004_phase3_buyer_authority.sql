ALTER TABLE business_buyers
  ADD COLUMN authority_evidence_id UUID,
  ADD CONSTRAINT business_buyers_authority_evidence_fk
    FOREIGN KEY (workspace_id,authority_evidence_id)
    REFERENCES evidence_records(workspace_id,id);

CREATE INDEX business_buyers_authority_evidence_idx
  ON business_buyers(workspace_id,authority_evidence_id)
  WHERE authority_evidence_id IS NOT NULL;
