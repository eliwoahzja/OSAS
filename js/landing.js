import { h, icon } from './ui.js';

export const GUIDES = [
  {
    id: 'earthquake', title: 'Earthquakes', icon: 'house-crack', label: 'When the ground shakes',
    summary: 'Drop, cover, and hold on. Wait for the shaking to stop before evacuating.',
    source: 'DOST / PHIVOLCS', url: 'https://www.dost.gov.ph/knowledge-resources/news/4423-dost-s-solidum-reiterates-preparedness-is-key-amidst-earthquake.html',
    stages: [
      ['Before', 'Find your safe spots', ['Locate sturdy tables and the posted evacuation routes.', 'Keep exits clear. Ask staff to secure heavy furniture.', 'Join school drills and learn your assembly area.']],
      ['During', 'Protect yourself first', ['Drop low, take cover under a sturdy table, and hold on.', 'Protect your head and neck. Stay clear of windows and falling objects.', 'Stay inside during shaking. Do not rush to the stairs.']],
      ['After', 'Leave when safe', ['After shaking stops, follow the safe evacuation route. Use stairs.', 'Stay with your class for headcount and expect aftershocks.', 'Keep away from damaged buildings until authorities clear them.']],
    ],
    extraSource: ['PHIVOLCS preparedness guide', 'https://region1.dost.gov.ph/wp-content/uploads/2025/10/RED_Book-1.pdf'],
  },
  {
    id: 'fire', title: 'Fires', icon: 'fire-flame-curved', label: 'When you see fire or smoke',
    summary: 'Raise the alarm and evacuate immediately using the nearest safe exit.',
    source: 'Quezon City Government fire safety', url: 'https://quezoncity.gov.ph/qcitizen-guides/fire-safety-tips/',
    stages: [
      ['Before', 'Keep the way clear', ['Learn the fire exits and an alternative escape route.', 'Keep flammable materials away from heat.', 'Report damaged wiring and avoid overloaded outlets.']],
      ['During', 'Get out safely', ['Sound the alarm, alert school staff, and evacuate immediately.', 'Use stairs. Stay low if you encounter smoke.', 'Do not open a hot door. Use another safe exit.']],
      ['After', 'Stay at the assembly area', ['Report to your teacher or marshal for headcount.', 'Tell responders if someone is missing. Do not go back inside.', 'Return only after authorities declare the building safe.']],
    ],
  },
  {
    id: 'typhoon', title: 'Typhoons', icon: 'cloud-bolt', label: 'When severe weather approaches',
    summary: 'Monitor official weather bulletins and follow evacuation instructions early.',
    source: 'Quezon City Government cyclone preparedness', url: 'https://quezoncity.gov.ph/qcitizen-guides/what-to-do-during-tropical-cyclone/',
    stages: [
      ['Before', 'Prepare early', ['Check PAGASA bulletins and official school announcements.', 'Know your evacuation plan and prepare an emergency bag.', 'Evacuate when instructed, before routes become unsafe.']],
      ['During', 'Shelter safely', ['Stay indoors, away from glass windows.', 'Keep a flashlight ready and follow official updates.', 'Stay in the designated shelter until authorities give clearance.']],
      ['After', 'Watch for hazards', ['Avoid damaged structures, fallen trees, and power lines.', 'Return only when authorities say your area is safe.', 'Have wet electrical equipment checked before use.']],
    ],
  },
  {
    id: 'flood', title: 'Floods', icon: 'water', label: 'When water levels rise',
    summary: 'Move to a safe, higher area early. Keep out of floodwater.',
    source: 'DOST-PAGASA flood safety rules', url: 'https://pagasa.dost.gov.ph/learning-tools/floods',
    stages: [
      ['Before', 'Know the warning signs', ['Learn local flood warnings and your evacuation destination.', 'Keep emergency supplies and contact details ready.', 'Move to a safe area before floodwater cuts off access.']],
      ['During', 'Avoid the water', ['Do not wade, swim, or play in floodwater.', 'Avoid flooded roads, bridges, and flowing rivers.', 'Follow evacuation instructions and use safe drinking water.']],
      ['After', 'Return with care', ['Stay away from broken wires and damaged utility lines.', 'Do not eat food or drink water contaminated by flooding.', 'Have electrical outlets and appliances checked before switching them on.']],
    ],
  },
];

export const REMINDERS = [
  'Know your nearest exit and an alternative route.',
  'Know your class assembly area.',
  'Know which teacher or marshal to report to.',
  'Discuss any assistance you need with school staff.',
  'Have your emergency contact details ready.',
  'Know the school’s family reunification instructions.',
];

export const DRILLS = [
  {
    "title": "Earthquake drill",
    "entries": [
      [
        "Recognize the signal",
        "Listen for the announced drill alarm."
      ],
      [
        "Drop, cover, and hold on",
        "Practise the protective response during simulated shaking."
      ],
      [
        "Evacuate after shaking",
        "Follow the designated route calmly when the drill leader directs."
      ],
      [
        "Assemble and account",
        "Stay with your class at the assembly area for roll call."
      ],
      [
        "Review and improve",
        "Report blocked exits or other problems during the debrief."
      ]
    ],
    "sourceLabel": "DepEd school drill stages",
    "sourceUrl": "https://tec.deped.gov.ph/wp-content/uploads/2020/09/PPST.RP_Module-15.pdf",
    "open": true
  },
  {
    "title": "Fire evacuation drill",
    "entries": [
      [
        "Respond to the alarm",
        "Stop your activity and follow staff instructions."
      ],
      [
        "Use the safe exit",
        "Leave by the designated route. Use stairs, not elevators."
      ],
      [
        "Report for headcount",
        "Tell your teacher or marshal if someone is missing."
      ],
      [
        "Wait for the all-clear",
        "Remain in the assembly area until instructed otherwise."
      ]
    ],
    "sourceLabel": "Fire evacuation guidance",
    "sourceUrl": "https://quezoncity.gov.ph/qcitizen-guides/fire-safety-tips/",
    "open": false
  },
  {
    "title": "Typhoon preparation",
    "entries": [
      [
        "Follow official updates",
        "Check PAGASA bulletins and school announcements."
      ],
      [
        "Prepare to evacuate",
        "Know the evacuation plan and keep an emergency bag ready."
      ],
      [
        "Move when instructed",
        "Go to the designated shelter before routes become unsafe."
      ],
      [
        "Wait for clearance",
        "Stay in the shelter until authorities say your area is safe."
      ]
    ],
    "sourceLabel": "Cyclone preparedness guidance",
    "sourceUrl": "https://quezoncity.gov.ph/qcitizen-guides/what-to-do-during-tropical-cyclone/",
    "open": false
  },
  {
    "title": "Flood evacuation",
    "entries": [
      [
        "Know the warning",
        "Learn local flood warnings and your evacuation destination."
      ],
      [
        "Move early",
        "Reach a safe, higher area before floodwater cuts off access."
      ],
      [
        "Keep out of floodwater",
        "Avoid flooded roads, bridges, and flowing rivers."
      ],
      [
        "Return with care",
        "Stay away from broken wires and damaged utility lines."
      ]
    ],
    "sourceLabel": "PAGASA flood safety rules",
    "sourceUrl": "https://pagasa.dost.gov.ph/learning-tools/floods",
    "open": false
  }
];

const external = (label, href) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, label);

export function createSafetyLanding({ onSignIn }) {
  const root = h('div', { id: 'public-safety', class: 'safety-landing' });
  const jump = (id, label, cls = '') => h('a', { href: `#${id}`, class: cls, onclick: (event) => {
    event.preventDefault();
    const destination = root.querySelector(`#${id}`);
    destination?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    destination?.focus({ preventScroll: true });
  } }, label);
  const signIn = (label, cls = 'safety-button') => h('button', { type: 'button', class: cls, onclick: onSignIn }, label, icon('arrow-right'));

  const tabs = h('div', { class: 'safety-tabs', role: 'tablist', 'aria-label': 'Disaster guides' });
  const panel = h('div', { class: 'safety-guide-panel', role: 'tabpanel', id: 'safety-guide-panel', tabindex: '0' });
  function selectGuide(index, focus = false) {
    const guide = GUIDES[index];
    [...tabs.children].forEach((button, i) => {
      button.setAttribute('aria-selected', String(i === index));
      button.tabIndex = i === index ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', `safety-tab-${guide.id}`);
    panel.replaceChildren(
      h('div', { class: 'safety-guide-intro' }, h('span', { class: 'safety-guide-symbol' }, icon(guide.icon)),
        h('p', { class: 'safety-kicker' }, guide.label), h('h3', {}, guide.title), h('p', {}, guide.summary)),
      h('div', { class: 'safety-guide-stages' }, guide.stages.map(([stage, title, items]) => h('section', {},
        h('p', { class: 'safety-stage-label' }, stage), h('h4', {}, title), h('ul', {}, items.map((item) => h('li', {}, item))))),
        h('div', { class: 'safety-source' }, 'Read the full guidance: ', external(guide.source, guide.url),
          guide.extraSource ? external(...guide.extraSource) : null)),
    );
    if (focus) tabs.children[index].focus();
  }
  GUIDES.forEach((guide, i) => tabs.append(h('button', {
    type: 'button', role: 'tab', id: `safety-tab-${guide.id}`, 'aria-controls': 'safety-guide-panel',
    onclick: () => selectGuide(i), onkeydown: (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (i + 1) % GUIDES.length;
      if (event.key === 'ArrowLeft') next = (i + GUIDES.length - 1) % GUIDES.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = GUIDES.length - 1;
      if (next !== undefined) { event.preventDefault(); selectGuide(next, true); }
    },
  }, icon(guide.icon), guide.title)));
  selectGuide(0);

  root.append(
    h('a', { class: 'safety-skip', href: '#safety-main', onclick: (event) => { event.preventDefault(); root.querySelector('#safety-main').focus(); } }, 'Skip to content'),
    h('header', { class: 'safety-header' }, h('div', { class: 'safety-container safety-nav' },
      jump('safety-top', h('span', { class: 'safety-brand' }, h('img', { src: '/assets/logo.png', alt: 'St. Agnes Academy seal', width: '46', height: '46' }), h('span', {}, h('strong', {}, 'St. Agnes Academy'), h('small', {}, 'OSAS · Safety & preparedness')))),
      h('nav', { 'aria-label': 'Safety brochure' }, jump('safety-guides', 'Disaster guides'), jump('safety-drills', 'Drills'), jump('safety-ready', 'Reminders')),
      signIn('Sign in'),
    )),
    h('main', { id: 'safety-main', tabindex: '-1' },
      h('section', { id: 'safety-top', class: 'safety-container safety-hero', 'aria-labelledby': 'safety-hero-title', tabindex: '-1' },
        h('div', { class: 'safety-hero-copy' }, h('h1', { id: 'safety-hero-title' }, 'Prepared today.', h('br'), h('em', {}, 'Safer together.')),
          h('p', { class: 'safety-lead' }, 'Know the hazards. Learn the response. Be ready for the next drill. A practical guide for every student, staff member, and family.'),
          h('div', { class: 'safety-hero-actions' }, jump('safety-guides', h('span', {}, 'Explore disaster guides', icon('arrow-down')), 'safety-button'), jump('safety-drills', 'Learn the drill', 'safety-text-link')),
          h('p', { class: 'safety-open-note' }, icon('book-open'), 'Read, learn, and prepare. No account needed.'),
        ),
        h('div', { class: 'safety-hero-visual' },
          h('div', { class: 'safety-visual-top' }, h('span', {}, 'EARTHQUAKE ESSENTIALS'), icon('shield-halved')),
          h('img', { src: '/assets/earthquake-cover.svg', alt: 'A person crouches under a sturdy table, protects their head, and holds a table leg.', width: '520', height: '320', fetchpriority: 'high' }),
          h('div', { class: 'safety-visual-copy' }, h('span', {}, 'WHEN THE GROUND SHAKES'), h('h2', {}, 'Drop. Cover. Hold On.'), h('p', {}, 'Protect your head and neck. Stay under cover until the shaking stops.')),
        ),
      ),
      h('section', { id: 'safety-guides', class: 'safety-container safety-section', 'aria-labelledby': 'safety-guides-title', tabindex: '-1' },
        h('div', { class: 'safety-section-heading' }, h('div', {}, h('p', { class: 'safety-kicker' }, '01 / Know the hazards'), h('h2', { id: 'safety-guides-title' }, 'Know what to do.')),
          h('p', {}, 'Simple steps for before, during, and after an emergency. Choose a guide to begin.')),
        tabs, panel,
      ),
      h('section', { id: 'safety-drills', class: 'safety-drills safety-section', 'aria-labelledby': 'safety-drills-title', tabindex: '-1' }, h('div', { class: 'safety-container' },
        h('div', { class: 'safety-section-heading' }, h('div', {}, h('p', { class: 'safety-kicker' }, '02 / Practice the response'), h('h2', { id: 'safety-drills-title' }, 'Every drill is preparation.')),
          h('p', {}, 'Listen to the briefing, follow your teacher or marshal, and use your school’s posted evacuation plan.')),
        h('div', { class: 'safety-drill-grid' },
          DRILLS.map(({ title, entries, sourceLabel, sourceUrl }, i) => h('article', { class: 'safety-drill-entry' },
            h('div', { class: 'safety-drill-title' }, icon(GUIDES[i].icon), h('h3', {}, title)),
            h('ol', {}, entries.map(([name, text]) => h('li', {}, h('strong', {}, name), h('p', {}, text)))),
            h('p', { class: 'safety-source' }, external(sourceLabel, sourceUrl)))),
        ),
        h('p', { class: 'safety-drill-note' }, icon('circle-info'), 'For drill dates and your assigned assembly area, follow official school announcements and your classroom evacuation plan.'),
      )),
      h('section', { id: 'safety-ready', class: 'safety-container safety-section safety-ready', 'aria-labelledby': 'safety-ready-title', tabindex: '-1' },
        h('div', {}, h('p', { class: 'safety-kicker' }, '03 / Your next step'), h('h2', { id: 'safety-ready-title' }, 'A little preparation.', h('br'), 'A clear plan.'),
          h('p', { class: 'safety-lead' }, 'Read these reminders before your next school drill. Ask your teacher about anything you have not confirmed.'),
          h('div', { class: 'safety-plan-note' }, icon('map'), h('p', {}, h('strong', {}, 'Know your actual route.'), ' Check the evacuation map posted in your classroom. Confirm the assembly area and any assistance arrangements with school staff.'))),
        h('div', { class: 'safety-reminder-sheet' }, h('div', { class: 'safety-reminder-head' }, h('h3', {}, 'Readiness reminders')),
          h('ul', { class: 'safety-reminders' }, REMINDERS.map((text) => h('li', {}, text)))),
      ),
      h('section', { class: 'safety-container safety-workspace', 'aria-labelledby': 'safety-workspace-title' },
        h('div', {}, h('p', { class: 'safety-kicker' }, 'Your school workspace'), h('h2', { id: 'safety-workspace-title' }, 'Stay connected with OSAS.'), h('p', {}, 'Sign in to view school emergency contacts and evacuation plans, or submit an incident report.')),
        signIn('Sign in to your account'),
      ),
    ),
    h('footer', { class: 'safety-footer' }, h('div', { class: 'safety-container' },
      h('div', { class: 'safety-footer-brand' }, h('img', { src: '/assets/logo.png', alt: '', width: '36', height: '36', loading: 'lazy' }), h('p', {}, h('strong', {}, 'St. Agnes Academy'), h('span', {}, 'Office of Student Affairs & Services'))),
      h('p', {}, 'During an emergency, follow school marshals and local authorities.'),
    )),
  );
  return root;
}
