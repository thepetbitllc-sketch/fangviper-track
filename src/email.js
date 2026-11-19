/* The "your order is underway" email, sent 24 hours after an order, and the "it moved again" reminder on day 5 if it has not shipped. White like drevaunt.com (ink #19110B, Jost);
   table layout so it holds up in Gmail and Outlook. Wording follows what the order holds: printed pieces
   (made to order), warehouse pieces (ready-made, packed and shipped) or both. */
import { groupsOf } from './order.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const INK = '#19110B', MUTE = '#6f6a65', DIM = '#9a948e', HAIR = '#e8e4df';
const FONT = "Jost, 'Helvetica Neue', Arial, sans-serif";

// Date in the store's own time zone: Shopify sends created_at with its offset, so the first 10 chars are the store's local date.
function placedDate(row) {
  const [y, m, d] = String(row.placed_local || row.placed).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function copyFor(groups, name) {
  const open = groups.filter((g) => !g.tracking).map((g) => g.source);
  const hey = name ? `Hey ${name}, ` : '';
  const cap = (s) => (hey ? hey + s : s[0].toUpperCase() + s.slice(1));
  if (open.length === 2) return {
    title: 'Your order is underway',
    intro: cap('your printed pieces are being made just for you, and the rest of your order is being picked and packed at our warehouse. The two parts ship separately, and you can follow both on one page.')
  };
  if (open[0] === 'stock') return {
    title: 'Your order is being prepared',
    intro: cap('your order is being picked, checked and packed at our warehouse. Follow it step by step until it leaves for your door.')
  };
  return {
    title: 'Your order is being made',
    intro: cap(`${groups.length > 1 ? 'the printed part of your order' : 'your order'} is in the print shop. Every Drevaunt print is made after you order it, so this one is being made just for you right now.`)
  };
}

const LABEL = { pod: 'Made for you', stock: 'From our warehouse' };

export function renderEmail(row, env, mode = 'first') {
  const groups = groupsOf(row);
  const link = `${env.SITE_URL}/?t=${encodeURIComponent(row.token)}`;
  const name = (row.first_name || '').trim();
  const placed = placedDate(row);
  const reminder = mode === 'reminder';
  const { title, intro } = reminder
    ? { title: 'Your order moved again', intro: `${name ? `Hey ${name}, your` : 'Your'} order has moved on since our last email, and there is a new step waiting on your page today. Tap below to see where it is now.` }
    : copyFor(groups, name);
  const cta = reminder ? "See today's step" : 'Follow your order';
  const subject = `${title.replace('Your order', `Your order ${row.number}`)}`;
  const labelled = groups.length > 1;

  const itemRows = (items) => items.map((it) => `
          <tr>
            ${it.image ? `<td width="64" style="padding:14px 16px 14px 0;border-bottom:1px solid ${HAIR};" valign="middle"><img src="${esc(it.image)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;object-fit:cover;border:0;background:#f6f5f3;"></td>` : ''}
            <td style="padding:14px 0;border-bottom:1px solid ${HAIR};font:500 14px/1.4 ${FONT};color:${INK};" valign="middle">
              ${esc(it.title)}<br><span style="font-weight:400;font-size:12.5px;color:${MUTE};">${esc(it.variant)}</span>
            </td>
            <td align="right" style="padding:14px 0;border-bottom:1px solid ${HAIR};font:400 14px/1 ${FONT};color:${MUTE};white-space:nowrap;" valign="middle">x${esc(it.qty)}</td>
          </tr>`).join('');

  const sections = groups.map((g) => `
        <tr><td class="pad" style="padding:${labelled ? '28px' : '0'} 32px 0;">
          ${labelled ? `<div style="font:500 11px/1 ${FONT};letter-spacing:2px;text-transform:uppercase;color:${DIM};padding-bottom:10px;">${LABEL[g.source]}${g.tracking ? ' &nbsp;&middot;&nbsp; already shipped' : ''}</div>` : ''}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${HAIR};">${itemRows(g.items)}
          </table>
        </td></tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${esc(subject)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 0; background: #ffffff; }
    @media (max-width: 600px) { .pad { padding-left: 20px !important; padding-right: 20px !important; } .h1 { font-size: 30px !important; } }
  </style>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Follow your order step by step, all the way to your door.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background:#ffffff;">
    <tr><td align="center" style="padding:40px 0 48px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
        <tr><td align="center" class="pad" style="padding:0 32px;">
          <a href="${esc(env.STORE_URL)}"><img src="${esc(env.SITE_URL)}/assets/wordmark-ink.png" width="150" alt="DREVAUNT" style="display:block;width:150px;height:auto;border:0;"></a>
        </td></tr>
        <tr><td align="center" class="pad" style="padding:44px 32px 0;font:500 11px/1.4 ${FONT};letter-spacing:2px;text-transform:uppercase;color:${DIM};">
          Order ${esc(row.number)} &nbsp;&middot;&nbsp; Placed ${esc(placed)}
        </td></tr>
        <tr><td align="center" class="pad h1" style="padding:14px 32px 0;font:400 36px/1.15 ${FONT};letter-spacing:.01em;color:${INK};">
          ${esc(title)}
        </td></tr>
        <tr><td align="center" class="pad" style="padding:18px 32px 0;font:400 15px/1.7 ${FONT};color:${MUTE};">
          ${esc(intro)}
        </td></tr>
        <tr><td align="center" class="pad" style="padding:30px 32px 0;">
          <a href="${esc(link)}" style="display:inline-block;padding:15px 30px;border-radius:100px;background:${INK};font:500 13px/1 ${FONT};letter-spacing:1.5px;text-transform:uppercase;color:#ffffff;text-decoration:none;">${esc(cta)}</a>
        </td></tr>
        <tr><td align="center" class="pad" style="padding:14px 32px 0;font:400 12px/1.6 ${FONT};color:${DIM};">
          A new step shows up every day until it leaves for your door.
        </td></tr>
        <tr><td class="pad" style="padding:52px 32px 0;font:400 20px/1 ${FONT};color:${INK};">In this order</td></tr>
        <tr><td style="padding:${labelled ? '0' : '14px'} 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${sections}
        </table></td></tr>
        <tr><td align="center" class="pad" style="padding:52px 32px 0;font:400 13px/1.7 ${FONT};color:${MUTE};">
          Questions? Just reply to this email.
        </td></tr>
        <tr><td align="center" class="pad" style="padding:10px 32px 0;font:400 12px/1.6 ${FONT};color:${DIM};">
          Drevaunt &nbsp;&middot;&nbsp; Men of Standard. &nbsp;&middot;&nbsp; <a href="${esc(env.STORE_URL)}" style="color:${DIM};text-decoration:none;">drevaunt.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    subject,
    '',
    intro,
    '',
    `${cta}: ${link}`,
    'A new step shows up every day until it leaves for your door.',
    '',
    'In this order:',
    ...groups.flatMap((g) => [
      ...(labelled ? [`${LABEL[g.source]}${g.tracking ? ' (already shipped)' : ''}:`] : []),
      ...g.items.map((it) => `- ${it.title}${it.variant ? ` (${it.variant})` : ''} x${it.qty}`)
    ]),
    '',
    'Questions? Just reply to this email.',
    'Drevaunt - Men of Standard. - drevaunt.com'
  ].join('\n');

  return { subject, html, text };
}