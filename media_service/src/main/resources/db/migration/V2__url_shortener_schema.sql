CREATE TABLE public.short_links (
    id varchar(255) NOT NULL,
    short_name varchar(255) NOT NULL,
    destination_url text NOT NULL,
    status varchar(50) NOT NULL,
    source varchar(255),
    source_id varchar(255),
    last_queried_at timestamp,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT short_links_pkey PRIMARY KEY (id),
    CONSTRAINT short_links_short_name_key UNIQUE (short_name)
);

CREATE INDEX idx_short_links_short_name ON public.short_links(short_name);
CREATE INDEX idx_short_links_destination_url ON public.short_links(destination_url);
