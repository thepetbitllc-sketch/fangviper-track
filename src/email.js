/* The "your order is being made" email. Black and white like fangviper.com; table layout so it holds up in Gmail and Outlook. */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const DISPLAY = "'Bebas Neue', Impact, 'Arial Narrow Bold', 'Arial Narrow', sans-serif";
const BODY = "Montserrat, 'Helvetica Neue', Arial, sans-serif";

// Date in the store's own time zone: Shopify sends created_at with its offset, so the first 10 chars are the store's local date.
function placedDate(row) {
  const [y, m, d] = String(row.placed_local || row.placed).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export function renderEmail(row, env) {
  const items = JSON.parse(row.items || '[]');
  const link = `${env.SITE_URL}/?t=${encodeURIComponent(row.token)}`;
  const name = (row.first_name || '').trim();
  const placed = placedDate(row);
  const subject = `Your order ${row.number} is being made`;
  const intro = `${name ? `Hey ${name}, your` : 'Your'} order is in the print shop. Every Fangviper piece is printed after you order it, so this one is being made just for you right now.`;

  const itemRows = items.map((it) => `
          <tr>
            ${it.image ? `<td width="64" style="padding:16px 16px 16px 0;border-bottom:1px solid #262626;" valign="middle"><img src="${esc(it.image)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;object-fit:cover;border:0;"></td>` : ''}
            <td style="padding:16px 0;border-bottom:1px solid #262626;font:500 14px/1.4 ${BODY};color:#ffffff;" valign="middle">
              ${esc(it.title)}<br><span style="font-weight:400;font-size:12.5px;color:#9a9a9a;">${esc(it.variant)}</span>
            </td>
            <td align="right" style="padding:16px 0;border-bottom:1px solid #262626;font:400 22px/1 ${DISPLAY};color:#9a9a9a;white-space:nowrap;" valign="middle">x${esc(it.qty)}</td>
          </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${esc(subject)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@400;500&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 0; background: #000000; }
    @media (max-width: 600px) { .pad { padding-left: 20px !important; padding-right: 20px !important; } .h1 { font-size: 46px !important; } }
  </style>
</head>
<body style="margin:0;padding:0;background:#000000;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Printed just for you. Follow it from the press to your door.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background:#000000;">
    <tr><td align="center" style="padding:40px 0 48px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
        <tr><td align="center" class="pad" style="padding:0 32px;">
          <a href="${esc(env.STORE_URL)}"><img src="${esc(env.SITE_URL)}/assets/logo-white.png" width="28" alt="Fangviper" style="display:block;width:28px;height:auto;border:0;"></a>
        </td></tr>
        <tr><td align="center" class="pad" style="padding:44px 32px 0;font:500 11px/1.4 ${BODY};letter-spacing:2px;text-transform:uppercase;color:#5e5e5e;">
          Order ${esc(row.number)} &nbsp;&middot;&nbsp; Placed ${esc(placed)}
        </td></tr>
        <tr><td align="center" class="pad h1" style="padding:16px 32px 0;font-family:${DISPLAY};font-size:58px;line-height:1;font-weight:400;color:#ffffff;">
          YOUR ORDER IS BEING MADE
        </td></tr>
        <tr><td align="center" class="pad" style="padding:20px 32px 0;font:400 15px/1.7 ${BODY};color:#9a9a9a;">
          ${esc(intro)}
        </td></tr>
        <tr><td align="center" class="pad" style="padding:32px 32px 0;">
          <a href="${esc(link)}" style="display:inline-block;padding:16px 28px;border:1px solid #ffffff;border-radius:100px;font:400 14px/1 ${BODY};letter-spacing:1px;text-transform:uppercase;color:#ffffff;text-decoration:none;background:#000000;">Follow your order</a>
        </td></tr>
        <tr><td align="center" class="pad" style="padding:14px 32px 0;font:400 12px/1.6 ${BODY};color:#5e5e5e;">
          A new step shows up every day, from the press to your door.
        </td></tr>
        <tr><td class="pad" style="padding:56px 32px 0;">
          <div style="font:400 26px/1 ${DISPLAY};color:#ffffff;padding-bottom:14px;border-bottom:1px solid #262626;">IN THIS ORDER</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${itemRows}
          </table>
        </td></tr>
        <tr><td align="center" class="pad" style="padding:56px 32px 0;font:400 13px/1.7 ${BODY};color:#9a9a9a;">
          Questions? Just reply to this email.
        </td></tr>
        <tr><td align="center" class="pad" style="padding:10px 32px 0;font:400 12px/1.6 ${BODY};color:#5e5e5e;">
          Fangviper &nbsp;&middot;&nbsp; <a href="${esc(env.STORE_URL)}" style="color:#5e5e5e;text-decoration:none;">fangviper.com</a>
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
    `Follow your order: ${link}`,
    'A new step shows up every day, from the press to your door.',
    '',
    'In this order:',
    ...items.map((it) => `- ${it.title}${it.variant ? ` (${it.variant})` : ''} x${it.qty}`),
    '',
    'Questions? Just reply to this email.',
    'Fangviper - fangviper.com'
  ].join('\n');

  return { subject, html, text };
}
