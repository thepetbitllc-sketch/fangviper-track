/* Shared order logic for the Worker and the email.
   Every item is either made to order (Printful, "pod") or ships ready-made from the warehouse (Zendrop, "stock").
   Each part of an order has its own progress and tracking, because the two suppliers ship separately. */

export const SOURCES = ['pod', 'stock'];

// Printful items are fulfilled by the "printful" fulfillment service and carry SKUs like "2400464_12634";
// Zendrop items say "zendrop" and use plain SKUs. The SKU check covers payloads without the service field.
export function isPrintOnDemand(li) {
  const service = li.fulfillment_service;
  if (service && service !== 'manual') return service === 'printful';
  return /^\d+_\d+$/.test(li.sku || '');
}

// Splits a stored order into its made-to-order and warehouse parts.
// Older rows have no pod flag (they were all Printful) and one flat tracking object.
export function groupsOf(row) {
  const items = JSON.parse(row.items || '[]');
  let tracking = row.tracking ? JSON.parse(row.tracking) : {};
  if ('shippedAt' in tracking || 'number' in tracking) tracking = { pod: tracking };
  return SOURCES.map((source) => ({
    source,
    items: items.filter((it) => (source === 'pod' ? it.pod !== false : it.pod === false)),
    tracking: tracking[source] || null
  })).filter((g) => g.items.length);
}

// Printed products: store tags, product type, title and the Printful mockup file name
// (e.g. ".../unisex-classic-tee-black-front.png"), so untagged products are still recognized.
export function printKindOf(p, title) {
  const photo = (p && p.images && p.images[0] && p.images[0].src.split('/').pop()) || '';
  const words = [...((p && p.tags) || []), (p && p.product_type) || '', title || '', photo].join(' ').toLowerCase();
  if (/t-?shirt|\btee\b/.test(words)) return 'tee';
  if (/\bbag\b/.test(words)) return 'bag';
  if (/bottle|drinkware/.test(words)) return 'bottle';
  if (/\bmug\b/.test(words)) return 'mug';
  if (/journal|notebook/.test(words)) return 'journal';
  return 'item';
}

// Warehouse products, from the title, product type and tags. Order matters: "suit pants" are pants,
// "suit vest" is part of a suit, a "gym vest" is a top.
export function stockKindOf(p, title) {
  const t = [title || '', (p && p.product_type) || '', ...((p && p.tags) || [])].join(' ').toLowerCase();
  if (/pants|trouser|jogger|shorts/.test(t)) return 'pants';
  if (/shoe|brogue|loafer|oxford|boot/.test(t)) return 'shoes';
  if (/sock/.test(t)) return 'socks';
  if (/\btie\b|necktie|cufflink|pocket square/.test(t)) return 'tie';
  if (/suit|blazer|waistcoat|jacket|coat|parka/.test(t)) return 'suit';
  if (/dress shirt|long sleeve|button/.test(t)) return 'shirt';
  if (/t-?shirt|\btee\b|vest|tank|stringer|hoodie|compression/.test(t)) return 'tee';
  return 'gear';
}