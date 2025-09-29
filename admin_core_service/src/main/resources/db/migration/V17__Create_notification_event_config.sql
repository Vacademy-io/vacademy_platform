-- Create notification_event_config table
CREATE TABLE public.notification_event_config (
    id varchar(255) NOT NULL,
    event_name varchar(100) NOT NULL,
    source_type varchar(50) NOT NULL,
    source_id varchar(255) NOT NULL,
    template_type varchar(50) NOT NULL,
    template_id varchar(255) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by varchar(255) NULL,
    CONSTRAINT pk_notification_event_config PRIMARY KEY (id)
);

-- Create indexes for better performance
CREATE INDEX idx_notification_event_config_event_source ON public.notification_event_config USING btree (event_name, source_type, source_id);
CREATE INDEX idx_notification_event_config_active ON public.notification_event_config USING btree (is_active) WHERE is_active = true;
CREATE INDEX idx_notification_event_config_template ON public.notification_event_config USING btree (template_id);

-- Insert sample data for LEARNER_ENROLL event
INSERT INTO public.notification_event_config (id, event_name, source_type, source_id, template_type, template_id, is_active) VALUES
('email-paid-learner-enroll', 'LEARNER_ENROLL', 'BATCH', 'ALL', 'EMAIL', 'PAID_USER_EMAIL_TEMPLATE', true),
('whatsapp-paid-learner-enroll', 'LEARNER_ENROLL', 'BATCH', 'ALL', 'WHATSAPP', 'PAID_USER_WHATSAPP_TEMPLATE', true),
('email-free-learner-enroll', 'LEARNER_ENROLL', 'BATCH', 'ALL', 'EMAIL', 'FREE_USER_EMAIL_TEMPLATE', true),
('whatsapp-free-learner-enroll', 'LEARNER_ENROLL', 'BATCH', 'ALL', 'WHATSAPP', 'FREE_USER_WHATSAPP_TEMPLATE', true);

-- Add trigger for updated_at
CREATE TRIGGER update_notification_event_config_updated_on 
    BEFORE UPDATE ON public.notification_event_config 
    FOR EACH ROW EXECUTE FUNCTION update_updated_on_user_task();

