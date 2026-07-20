ALTER TABLE import_previews DROP CONSTRAINT import_previews_record_type_check;
ALTER TABLE import_previews ADD CONSTRAINT import_previews_record_type_check
  CHECK(record_type IN (
    'brand','product','business','contact',
    'representation_opportunity','representation_agreement'
  ));
