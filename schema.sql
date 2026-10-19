-- One row per Shopify order.
CREATE TABLE IF NOT EXISTS orders (
  id          TEXT PRIMARY KEY,          -- Shopify order id
  token       TEXT NOT NULL UNIQUE,      -- secret part of the tracking link
  number      TEXT NOT NULL,             -- Shopify order name, e.g. #1042
  placed      TEXT NOT NULL,             -- Shopify created_at, converted to UTC ISO
  placed_local TEXT,                     -- Shopify created_at as sent (store time zone)
  email       TEXT,
  first_name  TEXT,
  items       TEXT NOT NULL,             -- JSON [{title, variant, qty, image}]
  status      TEXT NOT NULL DEFAULT 'open',  -- open | shipped | canceled
  tracking    TEXT,                      -- JSON {carrier, number, url, shippedAt}
  emailed_at  TEXT,                      -- when the "being made" email went out
  email_error TEXT
);
CREATE INDEX IF NOT EXISTS orders_due ON orders (status, emailed_at, placed);
