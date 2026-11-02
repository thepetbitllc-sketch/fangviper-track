/* Fangviper order tracking page.
   Real orders: /?t=<secret token> -> GET /api/order/<token> on the Worker (see api-base in index.html).
   Sample order (?demo, or locally): stage and product switcher for previewing the look. */
(() => {
  const DAY = 864e5;
  const isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

  // What changes per product: the noun, step 3 (each product is finished differently) and the press/check/pack lines.
  const KINDS = {
    tee: {
      noun: 'shirt',
      step3: ['Curing', 'Heat curing', 'The heat press locks the ink in, so the print holds up through the washer and every hard session after it.'],
      press: 'Your shirt is on the platen. The print head lays the ink straight into the fabric, pass by pass.',
      check: 'One last look at the print and the seams before your shirt moves on.',
      pack: 'Folded, packed and labeled. Waiting for the courier to pick it up.'
    },
    bag: {
      noun: 'gym bag',
      step3: ['Sewing', 'Cut and sewn', 'The printed panels are cut and stitched together into your bag.'],
      press: 'Your design is being printed onto the fabric panels that will become your gym bag.',
      check: 'One last look at the print, the seams and the zipper before your bag moves on.',
      pack: 'Packed and labeled. Waiting for the courier to pick it up.'
    },
    bottle: {
      noun: 'bottle',
      step3: ['Setting', 'Setting the print', 'The print is left to set, so it holds up to everyday use.'],
      press: 'Your design is being printed onto your bottle.',
      check: 'One last look at the print and the lid before your bottle moves on.',
      pack: 'Wrapped, packed and labeled. Waiting for the courier to pick it up.'
    },
    mug: {
      noun: 'mug',
      step3: ['Heat set', 'Heat set', 'Heat presses the design into the mug, so it stays sharp sip after sip.'],
      press: 'Your design is being printed and lined up to wrap around your mug.',
      check: 'One last look at the print, edge to edge, before your mug moves on.',
      pack: 'Wrapped, packed and labeled. Waiting for the courier to pick it up.'
    },
    journal: {
      noun: 'journal',
      step3: ['Binding', 'Binding', 'The pages are stacked and bound into your printed cover.'],
      press: 'Your cover is being printed, edge to edge.',
      check: 'One last look at the cover and the binding before your journal moves on.',
      pack: 'Packed and labeled. Waiting for the courier to pick it up.'
    },
    item: {
      noun: 'piece',
      step3: ['Finishing', 'Finishing', 'The print is set and the last details are finished.'],
      press: 'Your design is being printed onto your piece.',
      check: 'One last look at the print before your piece moves on.',
      pack: 'Packed and labeled. Waiting for the courier to pick it up.'
    }
  };

  function stagesFor(kind) {
    const k = KINDS[kind];
    return [
      { label: 'Artwork', title: 'Artwork prepped', copy: `Your order is in. The design file is being lined up for your ${k.noun} before anything gets printed.` },
      { label: 'Printing', title: 'On the press', copy: k.press },
      { label: k.step3[0], title: k.step3[1], copy: k.step3[2] },
      { label: 'Check', title: 'Quality check', copy: k.check },
      { label: 'Packed', title: 'Packed', copy: k.pack },
      { label: 'Shipped', title: 'On its way', copy: 'It is out the door. Follow every step with the tracking link below.' }
    ];
  }

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

  // The backend tags each item (tee, bag, bottle, mug, journal); older orders fall back to the title.
  function kindOf(it) {
    if (KINDS[it.kind]) return it.kind;
    const t = (it.title || '').toLowerCase();
    if (/t-?shirt|\btee\b/.test(t)) return 'tee';
    if (/\bbag\b/.test(t)) return 'bag';
    if (/bottle/.test(t)) return 'bottle';
    if (/\bmug\b/.test(t)) return 'mug';
    if (/journal|notebook/.test(t)) return 'journal';
    return 'item';
  }

  // One scene per day since the order (Printful takes 2 to 5 days), holding on Packed from day 5.
  // As soon as the order ships, it jumps straight to the last scene, even on day 2.
  function pickStage(o) {
    if (o.status === 'shipped') return 5;
    const days = Math.floor((Date.now() - new Date(o.placed)) / DAY);
    return Math.min(Math.max(days, 0), 4);
  }

  function render(o, stage) {
    // Scenes follow the first item in the order; a mixed order says the rest is being made alongside it.
    const kinds = o.items.map(kindOf);
    const kind = kinds[0] || 'item';
    const mixed = new Set(kinds).size > 1;
    const stages = stagesFor(kind);
    const s = stages[stage];
    const day = Math.floor((Date.now() - new Date(o.placed)) / DAY) + 1;

    $('orderNo').textContent = 'Order ' + o.number;
    $('placed').textContent = 'Placed ' + fmt(o.placed, { month: 'short', day: 'numeric' });
    $('stageTitle').textContent = s.title;
    $('stageDay').textContent = 'Day ' + day;
    $('stageCopy').textContent = s.copy + (mixed && stage < 5 ? ' The rest of your order is being made alongside it.' : '');
    document.title = s.title + ' | Fangviper';

    document.querySelectorAll('#scene use[data-obj]').forEach((u) => {
      const id = u.dataset.obj === 'pack' && $(kind + '-pack') ? kind + '-pack' : kind;
      u.setAttribute('href', '#' + id);
    });
    document.querySelectorAll('#scene > svg').forEach((svg) => {
      const only = svg.dataset.kind;
      svg.toggleAttribute('hidden', +svg.dataset.stage !== stage || (only && !only.split(',').includes(kind)));
    });

    $('steps').replaceChildren(...stages.map((st, i) => {
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

    $('changeNote').textContent = stage === 5
      ? 'Questions about the delivery? Message us and we will help you out.'
      : 'Something wrong with your order? Message us and we will sort it out.';

    const doy = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / DAY);
    $('tip').textContent = TIPS[doy % TIPS.length];

    $('app').hidden = false;
  }

  const SAMPLE_ITEMS = {
    tee: { title: 'Nobody Is Coming Tee', variant: 'Black / M', image: 'assets/demo-tee.jpg' },
    bag: { title: 'Iron blueprint', variant: 'Gym bag' },
    bottle: { title: 'Hydrate then dominate', variant: 'Water bottle' },
    mug: { title: 'First coffee then conquer', variant: 'Mug' },
    journal: { title: 'Begin', variant: 'Journal' }
  };

  function sampleOrder(stage, kind) {
    const now = Date.now();
    const placed = now - Math.max(stage, 0.2) * DAY;
    return {
      number: '#1042',
      placed,
      status: stage === 5 ? 'shipped' : 'in_production',
      items: [{ ...SAMPLE_ITEMS[kind], qty: 1, kind }],
      tracking: stage === 5
        ? { carrier: 'USPS', number: '9400 1000 0000 0000 0000 00', url: 'https://tools.usps.com/go/TrackConfirmAction', shippedAt: now - 0.3 * DAY }
        : null
    };
  }

  function demo() {
    const params = new URLSearchParams(location.search);
    let stage = Math.min(Math.max(parseInt(params.get('stage') || '1', 10) || 0, 0), 5);
    let kind = SAMPLE_ITEMS[params.get('kind')] ? params.get('kind') : 'tee';
    const bar = $('demo');
    const label = (text) => Object.assign(document.createElement('span'), { className: 'small-label', textContent: text });
    const button = (text, onClick) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.addEventListener('click', onClick);
      return b;
    };
    const stageButtons = stagesFor(kind).map((st, i) => button(st.label, () => show(i, kind)));
    const kindButtons = Object.keys(SAMPLE_ITEMS).map((k) => button(KINDS[k].noun, () => show(stage, k)));
    bar.replaceChildren(label('Sample order'), ...stageButtons, label('/'), ...kindButtons);
    bar.hidden = false;

    function show(i, k) {
      stage = i;
      kind = k;
      const labels = stagesFor(k);
      stageButtons.forEach((b, j) => { b.textContent = labels[j].label; b.setAttribute('aria-pressed', String(j === i)); });
      kindButtons.forEach((b, j) => b.setAttribute('aria-pressed', String(Object.keys(SAMPLE_ITEMS)[j] === k)));
      render(sampleOrder(i, k), i);
      history.replaceState(null, '', '?stage=' + i + '&kind=' + k);
    }
    show(stage, kind);
  }

  async function live(token) {
    try {
      // Local copies (wrangler dev) talk to their own backend; the live page uses the Worker address.
      const api = isLocal ? '' : (document.querySelector('meta[name="api-base"]').content || '').replace(/\/$/, '');
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

  if (token) live(token);
  else if (params.has('demo') || params.has('stage') || isLocal) demo();
  else noLink();
})();
