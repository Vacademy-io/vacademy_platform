-- public.external_communication_logs definition

CREATE TABLE IF NOT EXISTS public.external_communication_logs (
	id varchar(255) NOT NULL,
	source varchar(100) NOT NULL,
	source_id varchar(255) NULL,
	payload_json TEXT NULL,
	response_json TEXT NULL,
	status varchar(20) NOT NULL,
	error_message TEXT NULL,
	created_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp(6) DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT external_communication_logs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_external_comm_logs_source ON public.external_communication_logs USING btree (source);
CREATE INDEX IF NOT EXISTS idx_external_comm_logs_status ON public.external_communication_logs USING btree (status);
CREATE INDEX IF NOT EXISTS idx_external_comm_logs_created_at ON public.external_communication_logs USING btree (created_at);


