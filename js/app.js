import { h, icon, statCard, donutChart, yearBarChart, skeleton, errorBanner, toast } from './ui.js';
import * as api from './api.js';
import * as auth from './auth.js';
import * as modules from './modules.js';

const NAV = [
  { route: 'dashboard', label: 'Dashboard', icon: 'border-all' },
  { route: 'emergency-contacts', label: 'Emergency Contacts', icon: 'phone' },
  { route: 'drill-scheduling', label: 'Drill Scheduling', icon: 'person-running' },
  { route: 'evacuation-plans', label: 'Evacuation Map & Plans', icon: 'map' },
  { route: 'incident-logging', label: 'Incident Logging', icon: 'report' },
  { route: 'safety-inspections', label: 'Safety Inspections', icon: 'fact_check' },
  { route: 'risk-assessment', label: 'Risk Assessment', icon: 'security', adminOnly: true },
  { route: 'parent-notifications', label: 'Parent Notifications', icon: 'notifications' },
  { route: 'safety-reports', label: 'Safety Reports', icon: 'assessment', adminOnly: true },
  { route: 'emergency-roles', label: 'Emergency Roles', icon: 'groups', adminOnly: true },
  { route: 'first-aid-supplies', label: 'First Aid Supplies', icon: 'medical_services' },
];

const VIEWS = {
  dashboard: renderDashboard,
  'emergency-contacts': modules.emergencyContacts,
  'drill-scheduling': modules.drillScheduling,
  'evacuation-plans': modules.evacuationPlans,
  'incident-logging': modules.incidentLogging,
  'safety-inspections': modules.safetyInspections,
  'risk-assessment': modules.riskAssessment,
  'parent-notifications': modules.parentNotifications,
  'safety-reports': modules.complianceReports,
  'emergency-roles': modules.emergencyRoles,
  'first-aid-supplies': modules.firstAidSupplies,
};

const viewEl = () => document.getElementById('view');
const titleEl = () => document.getElementById('page-title');

function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = '';
  const admin = auth.isAdmin();
  for (const item of NAV) {
    if (item.adminOnly && !admin) continue;
    const a = h('a', {
      class: 'flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-gray-800/50 text-gray-400 hover:text-white transition-colors clickable',
      href: `#/${item.route}`,
    },
      icon(item.icon, 'text-sm w-5 text-center'),
      h('span', { class: 'text-[13px]' }, item.label),
    );
    nav.appendChild(h('li', {}, a));
  }
}

function highlightSidebar(route) {
  document.querySelectorAll('#sidebar-nav a').forEach((a) => {
    const active = a.getAttribute('href') === `#/${route}`;
    a.classList.toggle('bg-sidebar-active', active);
    a.classList.toggle('text-white', active);
    a.classList.toggle('font-medium', active);
    a.classList.toggle('text-gray-400', !active);
  });
}

function route() {
  let r = (location.hash || '#/dashboard').replace(/^#\//, '');
  if (!VIEWS[r]) r = 'dashboard';
  if (r !== 'dashboard') clearInterval(statsTimer);
  const view = VIEWS[r];
  const title = (NAV.find((n) => n.route === r) || {}).label || 'Admin Dashboard';
  titleEl().textContent = title;
  highlightSidebar(r);
  const el = viewEl();
  el.innerHTML = '';
  el.scrollTop = 0;
  el.classList.remove('animate-view');
  void el.offsetWidth;
  el.classList.add('animate-view');
  try {
    view(el);
  } catch (e) {
    console.error(e);
    el.appendChild(errorBanner(e.message, () => route()));
  }
}

function enterApp() {
  document.getElementById('sidebar-backdrop').classList.add('hidden');
  const user = auth.currentUser() || { name: 'Local Administrator', email: '@admin', role: 'admin' };
  const initials = (user.name || user.email || 'LA').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const isAdmin = auth.isAdmin();
  document.getElementById('workspace-label').textContent = isAdmin ? 'Administrator' : 'Staff Workspace';
  document.getElementById('user-handle').textContent = user.email || '@admin';
  document.querySelectorAll('[data-user-initials]').forEach((el) => { el.textContent = initials; });
  document.querySelectorAll('[data-user-name]').forEach((el) => { el.textContent = user.name || 'Local Administrator'; });
  document.querySelectorAll('[data-user-role]').forEach((el) => { el.textContent = isAdmin ? 'Administrator' : 'Staff'; });
  renderSidebar();
  route();
}

function wireShell() {
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('-translate-x-full');
    document.getElementById('sidebar-backdrop').classList.toggle('hidden');
  });
  document.getElementById('sidebar-backdrop').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('sidebar-backdrop').classList.add('hidden');
  });
  window.addEventListener('hashchange', route);
  const d = new Date();
  document.getElementById('topbar-date').textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

let statsTimer = null;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function drawStats(box, s) {
  box.innerHTML = '';
  box.appendChild(h('div', {
    class: 'bg-[#FFF8E7] border border-amber-200/60 rounded-2xl p-4 flex items-center gap-4',
  },
    h('div', { class: 'w-8 h-8 rounded-full bg-amber-100 text-amber-500 flex items-center justify-center shrink-0' }, icon('database', 'text-xs')),
    h('div', {},
      h('h4', { class: 'text-[13px] font-bold text-gray-900' }, 'Live data status'),
      h('p', { class: 'text-[13px] text-gray-600 mt-0.5' },
        api.dataMode() === 'api'
          ? 'Connected to Supabase — figures update from the database.'
          : 'Demo dataset — sign in via the companion app to see live data.'),
    ),
  ));

  const cards = h('div', { class: 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-5' });
  const defs = [
    { label: 'Total Incidents', value: s.incidents_total, sub: 'Reported safety\nincidents', iconName: 'warning', tone: 'pink', blob: 'bg-pink-50' },
    { label: 'Pending Inspections', value: s.inspections_pending, sub: 'Scheduled safety\nchecks', iconName: 'checklist', tone: 'blue', blob: 'bg-blue-50' },
    { label: 'Active Drills', value: s.drills_active, sub: 'Ongoing evacuation\nexercises', iconName: 'emergency', tone: 'green', blob: 'bg-emerald-50' },
    { label: 'Low Supplies', value: s.supplies_low, sub: 'First aid items\nneeding restock', iconName: 'medical_services', tone: 'amber', blob: 'bg-amber-50' },
    { label: 'Emergency Contacts', value: s.emergency_contacts_total, sub: 'Verified responder\nprofiles', iconName: 'contacts', tone: 'red', blob: 'bg-red-50' },
    { label: 'Compliance Score', value: `${s.compliance_score}%`, sub: 'Overall safety\nrating', iconName: 'verified_user', tone: 'purple', blob: 'bg-purple-50' },
  ];
  defs.forEach((d) => cards.appendChild(statCard(d)));
  box.appendChild(h('section', {},
    h('div', { class: 'mb-6' },
      h('p', { class: 'text-[10px] font-bold text-pink-600 uppercase tracking-widest mb-1.5' }, 'At a Glance'),
      h('div', { class: 'flex items-center justify-between' },
        h('div', {},
          h('h3', { class: 'text-[28px] font-extrabold text-gray-900 tracking-tight' }, 'Dashboard summary'),
          h('p', { class: 'text-[15px] text-gray-500 mt-1' }, 'Figures from the OSAS database.'),
        ),
        h('span', { class: 'px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-600 shadow-sm' }, `${defs.length} summaries`),
      ),
    ),
    cards,
  ));

  box.appendChild(h('section', { class: 'space-y-5' },
    h('div', {},
      h('p', { class: 'text-[10px] font-bold text-pink-600 uppercase tracking-widest mb-1.5' }, 'Safety Analytics'),
      h('h3', { class: 'text-[28px] font-extrabold text-gray-900 tracking-tight' }, 'Incident & Inspection Health'),
      h('p', { class: 'text-[15px] text-gray-500 mt-1' }, 'From the incident and inspection modules.'),
    ),
    h('div', { class: 'grid lg:grid-cols-3 gap-5' },
      donutChart(s.incident_breakdown || [], { centerLabel: 'Incidents' }),
      donutChart(s.inspection_status || [], { centerLabel: 'Inspections' }),
      donutChart(s.supplies_breakdown || [], { centerLabel: 'Supplies' }),
    ),
  ));

  const yearsData = s.years_by_year || [];
  if (yearsData.length > 1) {
    box.appendChild(h('section', {},
      yearBarChart(yearsData, {
        title: 'Incidents by Year',
        subtitle: 'Compare incident volume and types across school years.',
      }),
    ));
  }
}

async function renderDashboard(el) {
  const wrap = h('div', { class: 'max-w-[1400px] 2xl:max-w-[1600px] mx-auto space-y-8' });

  wrap.appendChild(
    h('section', {
      class: 'bg-maroon-gradient rounded-3xl p-10 sm:p-12 text-white relative overflow-hidden shadow-sm',
    },
      h('div', {
        class: 'absolute right-0 top-0 w-1/2 h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-50',
      }),
      h('div', { class: 'relative z-10 flex justify-between items-center h-full gap-8' },
        h('div', { class: 'max-w-2xl' },
          h('div', { class: 'flex items-center gap-3 mb-6' },
            h('span', { class: 'w-8 h-[2px] bg-pink-400 block' }),
            h('p', { class: 'text-[11px] font-bold tracking-[0.2em] text-pink-100 uppercase' }, 'OSAS Overview'),
          ),
          h('h2', { class: 'text-3xl sm:text-[44px] font-extrabold mb-5 leading-[1.1] tracking-tight' }, `${greeting()},`),
          h('p', { class: 'text-[15px] text-gray-200 mb-8 max-w-xl font-light' },
            'Here\'s what\'s happening across campus safety today.'),
          h('p', { class: 'text-[13px] text-pink-100/80' }, new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })),
        ),
        h('div', { class: 'hidden md:block pr-8' },
          h('div', { class: 'w-44 h-44 rounded-full border border-white/10 flex items-center justify-center p-2 bg-black/5 relative' },
            h('div', { class: 'absolute inset-0 rounded-full border border-dashed border-pink-300/30' }),
            h('img', { src: '/assets/logo.png', alt: 'SAAC Seal', class: 'w-32 h-32 object-contain relative z-10' }),
          ),
        ),
      ),
    ),
  );

  const statsWrap = h('div', { class: 'space-y-8' });
  wrap.appendChild(statsWrap);
  el.appendChild(wrap);

  const box = h('div', { class: 'space-y-8' });
  statsWrap.appendChild(box);
  box.appendChild(skeleton(2, 6));

  const refresh = async () => {
    try {
      const s = await api.getDashboardStats();
      drawStats(box, s);
    } catch (e) {
      if (!box.querySelector('.bg-red-50')) {
        box.appendChild(errorBanner(e.message, refresh));
      }
      console.error(e);
    }
  };

  await refresh();
  clearInterval(statsTimer);
  statsTimer = setInterval(refresh, 15000);
}

async function boot() {
  wireShell();
  await auth.restore();
  enterApp();
}

boot();
