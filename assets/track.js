/* Fangviper order tracking page.
   Real orders: /?t=<secret token> -> GET /api/order/<token> (backend comes later).
   No token: sample order with a stage switcher, for previewing the look. */
(() => {
  const DAY = 864e5;

  const STAGES = [
    { label: 'Artwork', title: 'Artwork prepped', copy: 'Your order is in. The design file is being lined up for your size before anything touches the press.' },
    { label: 'Printing', title: 'On the press', copy: 'Your shirt is on the platen. The print head lays the ink straight into the fabric, pass by pass.' },
    { label: 'Curing', title: 'Heat curing', copy: 'The heat press locks the ink in, so the print holds up through the washer and every hard session after it.' },
    { label: 'Check', title: 'Quality check', copy: 'One last look at the print and the seams before your piece moves on.' },
    { label: 'Packed', title: 'Packed', copy: 'Folded, packed and labeled. Waiting for the courier to pick it up.' },
    { label: 'Shipped', title: 'On its way', copy: 'It is out the door. Follow every step with the tracking link below.' }
  ];

  const TIPS = [
    'Nobody is coming. Show up anyway.',
    'Motivation is a guest. Discipline lives here.',
    'Small reps every day beat big plans someday.',
    'What you measure, you can move.',
    'Do the boring work. That is where it gets built.',
    'Your future self is watching what you do today.',
    'Comfort is the one rival you invite in.'
  ];

  const $ = (id) => document.getElementById(id);
  const fmt = (d, opts) => new Date(d).toLocaleDateString('en-US', opts || { weekday: 'short', month: 'short', day: 'numeric' });

  // One scene per day since the order (Printful takes 2 to 5 days), holding on Packed from day 5.
  // As soon as the order ships, it jumps straight to the last scene, even on day 2.
  function pickStage(o) {
    if (o.status === 'shipped') return 5;
    const days = Math.floor((Date.now() - new Date(o.placed)) / DAY);
    return Math.min(Math.max(days, 0), 4);
  }

  function render(o, stage) {
    const s = STAGES[stage];
    const day = Math.floor((Date.now() - new Date(o.placed)) / DAY) + 1;

    $('orderNo').textContent = 'Order ' + o.number;
    $('placed').textContent = 'Placed ' + fmt(o.placed, { month: 'short', day: 'numeric' });
    $('stageTitle').textContent = s.title;
    $('stageDay').textContent = 'Day ' + day;
    $('stageCopy').textContent = s.copy;
    document.title = s.title + ' | Fangviper';

    document.querySelectorAll('#scene svg').forEach((svg) => { svg.toggleAttribute('hidden', +svg.dataset.stage !== stage); });

    $('steps').replaceChildren(...STAGES.map((st, i) => {
      const li = document.createElement('li');
      li.textContent = st.label;
      li.className = i < stage ? 'done' : i === stage ? 'now' : '';
      if (i === stage) li.setAttribute('aria-current', 'step');
      return li;
    }));

    const btn = $('trackBtn');
    if (stage === 5 && o.tracking) {
      $('statusBig').textContent = 'Shipped ' + fmt(o.tracking.shippedAt, { month: 'short', day: 'numeric' });
      $('statusSub').textContent = [o.tracking.carrier, o.tracking.number].filter(Boolean).join('  /  ');
      btn.href = o.tracking.url;
      btn.hidden = !o.tracking.url;
    } else {
      $('statusBig').textContent = 'Made to order';
      $('statusSub').textContent = 'Every piece is printed after you order it. You will get an email with tracking the moment it ships.';
      btn.hidden = true;
    }

    $('items').replaceChildren(...o.items.map((it) => {
      const row = document.createElement('div');
      row.className = it.image ? 'row row--img' : 'row';
      if (it.image) {
        const img = document.createElement('img');
        img.src = it.image; img.alt = ''; img.loading = 'lazy';
        row.append(img);
      }
      const name = document.createElement('span');
      name.className = 'row__name';
      name.textContent = it.title;
      const hint = document.createElement('span');
      hint.className = 'row__hint';
      hint.textContent = it.variant;
      name.append(hint);
      const qty = document.createElement('span');
      qty.className = 'row__v';
      qty.textContent = 'x' + it.qty;
      row.append(name, qty);
      return row;
    }));

    $('changeNote').textContent = stage === 0
      ? 'Need a different size or a new address? Message us today. The earlier we hear from you, the better the chance we can still change it.'
      : stage === 5
        ? 'Your order has already shipped, so the address can not change anymore. Questions about the delivery? We are here.'
        : 'Your piece is already being made, so the size and address can not change anymore. For anything else, we are here.';

    const doy = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / DAY);
    $('tip').textContent = TIPS[doy % TIPS.length];

    $('app').hidden = false;
  }

  function sampleOrder(stage) {
    const now = Date.now();
    const placed = now - Math.max(stage, 0.2) * DAY;
    return {
      number: '#1042',
      placed,
      status: stage === 0 ? 'pending' : stage === 5 ? 'shipped' : 'in_production',
      items: [
        { title: 'Nobody Is Coming Tee', variant: 'Black / M', qty: 1, image: 'assets/demo-tee.jpg' },
        { title: 'Sample Tee', variant: 'Black / L', qty: 1 }
      ],
      tracking: stage === 5
        ? { carrier: 'USPS', number: '9400 1000 0000 0000 0000 00', url: 'https://tools.usps.com/go/TrackConfirmAction', shippedAt: now - 0.3 * DAY }
        : null
    };
  }

  function demo() {
    const params = new URLSearchParams(location.search);
    let stage = Math.min(Math.max(parseInt(params.get('stage') || '1', 10) || 0, 0), 5);
    const bar = $('demo');
    const label = document.createElement('span');
    label.className = 'small-label';
    label.textContent = 'Sample order';
    const buttons = STAGES.map((st, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = st.label;
      b.addEventListener('click', () => show(i));
      return b;
    });
    bar.replaceChildren(label, ...buttons);
    bar.hidden = false;

    function show(i) {
      stage = i;
      buttons.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
      render(sampleOrder(i), i);
      history.replaceState(null, '', '?stage=' + i);
    }
    show(stage);
  }

  async function live(token) {
    try {
      const api = (document.querySelector('meta[name="api-base"]').content || '').replace(/\/$/, '');
      const res = await fetch(api + '/api/order/' + encodeURIComponent(token), { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(res.status);
      const o = await res.json();
      render(o, pickStage(o));
    } catch (e) {
      $('err').hidden = false;
    }
  }

  // Visitors without an order link see a short note; the sample order shows only with ?demo (or locally).
  function noLink() {
    $('errTitle').textContent = 'Follow your order';
    $('errText').textContent = 'Open the "Follow your order" button in the email we sent you. It brings you straight to your order.';
    $('err').hidden = false;
  }

  const params = new URLSearchParams(location.search);
  const token = params.get('t');
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if (token) live(token);
  else if (params.has('demo') || params.has('stage') || local) demo();
  else noLink();
})();
