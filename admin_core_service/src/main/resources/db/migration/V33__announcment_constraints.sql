ALTER TABLE audience
ADD CONSTRAINT unique_institute_campaign
UNIQUE (institute_id, campaign_name);
