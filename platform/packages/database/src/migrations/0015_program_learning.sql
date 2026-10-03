CREATE TABLE program_item_progress (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  learning_item_id TEXT NOT NULL,
  content_version INTEGER NOT NULL CHECK (content_version > 0),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ NOT NULL,
  progress_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, learning_item_id, content_version)
);

CREATE INDEX program_item_progress_user_idx
  ON program_item_progress(user_id, last_viewed_at DESC);

CREATE TABLE program_activity_submissions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  learning_item_id TEXT NOT NULL,
  content_version INTEGER NOT NULL CHECK (content_version > 0),
  response_json JSONB NOT NULL,
  completion_state TEXT NOT NULL CHECK (completion_state IN ('submitted','completed')),
  submitted_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX program_activity_submissions_user_item_idx
  ON program_activity_submissions(user_id, learning_item_id, content_version, submitted_at DESC);

CREATE TABLE program_learner_state (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_module_id TEXT,
  last_learning_item_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
