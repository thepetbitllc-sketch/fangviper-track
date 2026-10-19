/* Fangviper order tracking backend (Cloudflare Worker).
   - Shopify admin webhooks (orders/create, fulfillments/create|update, orders/cancelled) -> POST /webhooks/shopify
   - The tracking page in /public reads GET /api/order/<token>
   - Every hour, orders that are EMAIL_DELAY_HOURS old get the "being made" email (Resend). */
import { renderEmail } from './email.js';

const HOUR = 36e5;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (request.method === 'GET' && path.startsWith('/api/order/')) return await getOrder(decodeURIComponent(path.slice(11)), env);
      if (request.method === 'POST' && path === '/webhooks/shopify') return await shopifyWebhook(request, env, ctx);
      // Local testing only (DEV=1 lives in .dev.vars, never in production).
      if (env.DEV === '1' && path === '/dev/email') return await devEmail(url, env);
      if (env.DEV === '1' && path === '/dev/send-due') return json(await sendDueEmails(env, Number(url.searchParams.get('delay') ?? env.EMAIL_DELAY_HOURS)));
    } catch (err) {
      console.error(err);
      return json({ error: 'server error' }, 500);
    }
    return new Response('Not found', { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendDueEmails(env, Number(env.EMAIL_DELAY_HOURS)).then((r) => console.log(JSON.stringify(r))));
  }
};

/* ---------- tracking page API ---------- */

async function getOrder(token, env) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return json({ error: 'not found' }, 404);
  const row = await env.DB.prepare('SELECT * FROM orders WHERE token = ?').bind(token).first();
  if (!row || row.status === 'canceled') return json({ error: 'not found' }, 404);
  return json({
    number: row.number,
    placed: row.placed,
    status: row.status === 'shipped' ? 'shipped' : 'in_production',
    items: JSON.parse(row.items).map(({ title, variant, qty, image }) => ({ title, variant, qty, image })),
    tracking: row.tracking ? JSON.parse(row.tracking) : null
  });
}

/* ---------- Shopify webhooks ---------- */

async function shopifyWebhook(request, env, ctx) {
  const body = await request.arrayBuffer();
  if (!(await verifyShopify(body, request.headers.get('x-shopify-hmac-sha256'), env.SHOPIFY_WEBHOOK_SECRET))) {
    console.warn('webhook rejected: bad signature', request.headers.get('x-shopify-topic'));
    return new Response('Unauthorized', { status: 401 });
  }
  const topic = request.headers.get('x-shopify-topic');
  const data = JSON.parse(new TextDecoder().decode(body));

  if (topic === 'orders/create') await saveOrder(data, env, ctx);
  else if (topic === 'fulfillments/create' || topic === 'fulfillments/update') await markShipped(data, env);
  else if (topic === 'orders/cancelled') await env.DB.prepare("UPDATE orders SET status = 'canceled' WHERE id = ?").bind(String(data.id)).run();

  console.log('webhook', topic, data.name || data.order_id || data.id);
  return new Response('ok');
}

// Shopify signs the raw body with HMAC-SHA256 (base64). subtle.verify compares in constant time.
async function verifyShopify(body, header, secret) {
  if (!header || !secret) return false;
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sig = Uint8Array.from(atob(header), (c) => c.charCodeAt(0));
    return await crypto.subtle.verify('HMAC', key, sig, body);
  } catch {
    return false;
  }
}

async function saveOrder(o, env, ctx) {
  const items = (o.line_items || [])
    .filter((li) => li.quantity > 0 && li.requires_shipping !== false)
    .map((li) => ({ title: li.title, variant: li.variant_title || '', qty: li.quantity, productId: li.product_id, variantId: li.variant_id, image: null }));
  const addr = o.shipping_address || o.billing_address || {};
  const id = String(o.id);

  const insert = await env.DB.prepare(
    `INSERT OR IGNORE INTO orders (id, token, number, placed, placed_local, email, first_name, items)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    newToken(),
    o.name || '#' + o.order_number,
    new Date(o.created_at || Date.now()).toISOString(),
    o.created_at || null,
    o.email || o.contact_email || (o.customer && o.customer.email) || null,
    (o.customer && o.customer.first_name) || addr.first_name || null,
    JSON.stringify(items)
  ).run();

  if (!insert.meta.changes) return; // Shopify retried a webhook we already have

  // Product photos come from the store's public product feed; done after replying so Shopify gets a fast 200.
  ctx.waitUntil(addImages(id, items, env).catch((e) => console.error('images', e)));
}

async function addImages(id, items, env) {
  const products = new Map();
  for (let page = 1; page <= 4; page++) {
    const res = await fetch(`${env.STORE_URL}/products.json?limit=250&page=${page}`, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; FangviperTrack/1.0; +https://track.fangviper.com)', accept: 'application/json' }
    });
    if (!res.ok) { console.error('products.json', res.status); break; }
    const list = (await res.json()).products || [];
    list.forEach((p) => products.set(p.id, p));
    if (list.length < 250) break;
  }
  for (const it of items) {
    const p = products.get(it.productId);
    if (!p) continue;
    const v = (p.variants || []).find((x) => x.id === it.variantId);
    const images = p.images || [];
    // Printful mockups are named after the color (".../unisex-tee-maroon-front-...jpg"), so use that when the variant has no photo of its own.
    const color = (it.variant.split(' / ')[0] || '').toLowerCase().trim().replace(/\s+/g, '-');
    const byColor = color && images.find((img) => img.src.toLowerCase().includes(`-${color}-`));
    const src = (v && v.featured_image && v.featured_image.src) || (byColor && byColor.src) || (images[0] && images[0].src);
    if (src) it.image = src + (src.includes('?') ? '&' : '?') + 'width=240';
  }
  await env.DB.prepare('UPDATE orders SET items = ? WHERE id = ?').bind(JSON.stringify(items), id).run();
}

async function markShipped(f, env) {
  if (!f.order_id || f.status === 'cancelled' || f.status === 'failure') return;
  const tracking = {
    carrier: f.tracking_company || '',
    number: f.tracking_number || (f.tracking_numbers || [])[0] || '',
    url: f.tracking_url || (f.tracking_urls || [])[0] || '',
    shippedAt: new Date(f.created_at || Date.now()).toISOString()
  };
  await env.DB.prepare("UPDATE orders SET status = 'shipped', tracking = ? WHERE id = ? AND status != 'canceled'")
    .bind(JSON.stringify(tracking), String(f.order_id)).run();
}

/* ---------- the delayed "being made" email ---------- */

async function sendDueEmails(env, delayHours) {
  const now = Date.now();
  const due = new Date(now - delayHours * HOUR).toISOString();
  const tooOld = new Date(now - 7 * 24 * HOUR).toISOString(); // never email about week-old orders
  const { results } = await env.DB.prepare(
    `SELECT * FROM orders WHERE status = 'open' AND emailed_at IS NULL AND email IS NOT NULL
     AND placed <= ? AND placed >= ? ORDER BY placed LIMIT 50`
  ).bind(due, tooOld).all();

  const report = { due: results.length, sent: [], failed: [], dryRun: [] };
  for (const row of results) {
    const mail = renderEmail(row, env);
    if (!env.RESEND_API_KEY) { report.dryRun.push(row.number); continue; }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
        'idempotency-key': `being-made-${row.id}`
      },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [row.email], reply_to: env.MAIL_REPLY_TO, subject: mail.subject, html: mail.html, text: mail.text })
    });
    if (res.ok) {
      await env.DB.prepare('UPDATE orders SET emailed_at = ?, email_error = NULL WHERE id = ?').bind(new Date().toISOString(), row.id).run();
      report.sent.push(row.number);
    } else {
      const msg = (await res.text()).slice(0, 300);
      await env.DB.prepare('UPDATE orders SET email_error = ? WHERE id = ?').bind(`${res.status} ${msg}`, row.id).run();
      report.failed.push(row.number);
    }
  }
  return report;
}

async function devEmail(url, env) {
  const row = await env.DB.prepare('SELECT * FROM orders WHERE token = ?').bind(url.searchParams.get('t') || '').first();
  if (!row) return new Response('No order with that token', { status: 404 });
  const mail = renderEmail(row, env);
  return new Response(url.searchParams.has('text') ? mail.text : mail.html, {
    headers: { 'content-type': url.searchParams.has('text') ? 'text/plain; charset=utf-8' : 'text/html; charset=utf-8' }
  });
}

/* ---------- helpers ---------- */

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function json(data, status = 200) {
  // The page lives on track.fangviper.com (GitHub Pages) and calls this Worker from there.
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });
}
