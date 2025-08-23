-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.deposit_amounts (
  deposit_id bigint NOT NULL,
  amount bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT deposit_amounts_pkey PRIMARY KEY (deposit_id)
);
CREATE TABLE public.event_notifications (
  chat_id bigint NOT NULL,
  deposit_id integer,
  event_type text NOT NULL,
  id integer NOT NULL DEFAULT nextval('event_notifications_id_seq'::regclass),
  sent_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT fk_event_notifications_chat_id FOREIGN KEY (chat_id) REFERENCES public.users(chat_id)
);
CREATE TABLE public.intent_data (
  created_at timestamp with time zone DEFAULT now(),
  intent_hash text NOT NULL,
  deposit_id bigint NOT NULL,
  fiat_currency text NOT NULL,
  conversion_rate text NOT NULL,
  verifier text NOT NULL,
  CONSTRAINT intent_data_pkey PRIMARY KEY (intent_hash)
);
CREATE TABLE public.sniper_alerts (
  chat_id bigint NOT NULL,
  deposit_id integer NOT NULL,
  currency character varying NOT NULL,
  deposit_rate numeric NOT NULL,
  market_rate numeric NOT NULL,
  percentage_diff numeric NOT NULL,
  id integer NOT NULL DEFAULT nextval('sniper_alerts_id_seq'::regclass),
  sent_at timestamp without time zone DEFAULT now(),
  CONSTRAINT sniper_alerts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_deposits (
  chat_id bigint NOT NULL,
  deposit_id integer NOT NULL,
  intent_hash text,
  id integer NOT NULL DEFAULT nextval('user_deposits_id_seq'::regclass),
  status text DEFAULT 'tracking'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  CONSTRAINT user_deposits_pkey PRIMARY KEY (id),
  CONSTRAINT fk_user_deposits_chat_id FOREIGN KEY (chat_id) REFERENCES public.users(chat_id)
);
CREATE TABLE public.user_settings (
  chat_id bigint NOT NULL UNIQUE,
  id integer NOT NULL DEFAULT nextval('user_settings_id_seq'::regclass),
  listen_all boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  threshold numeric DEFAULT 0.2,
  CONSTRAINT user_settings_pkey PRIMARY KEY (id),
  CONSTRAINT fk_user_settings_chat_id FOREIGN KEY (chat_id) REFERENCES public.users(chat_id)
);
CREATE TABLE public.user_snipers (
  chat_id bigint NOT NULL,
  currency character varying NOT NULL,
  id integer NOT NULL DEFAULT nextval('user_snipers_id_seq'::regclass),
  is_active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  platform text,
  CONSTRAINT user_snipers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  id integer NOT NULL DEFAULT nextval('users_id_seq'::regclass),
  chat_id bigint NOT NULL UNIQUE,
  username text,
  first_name text,
  last_name text,
  created_at timestamp with time zone DEFAULT now(),
  last_active timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);