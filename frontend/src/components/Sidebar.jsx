import Icon from './Icons.jsx';
import { sidebarMenu } from '../data/mockData.js';

export default function Sidebar({ open, collapsed, onClose, active, onNavigate }) {
  return (
    <>
      <aside
        data-purpose="sidebar"
        className={`bg-maroon-dark text-gray-300 flex flex-col w-72 h-full overflow-y-auto shrink-0 fixed inset-y-0 left-0 z-50 transition-transform duration-300 lg:static lg:translate-x-0 ${
          collapsed ? 'lg:hidden' : ''
        } ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="p-6 flex items-center gap-3 mt-2">
          <img src="/logo.png" alt="SAAC Logo" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="text-white font-bold text-lg leading-tight tracking-wide">SAAC</h1>
            <p className="text-[11px] text-gray-400">OSAS Dashboard</p>
          </div>
        </div>

        <div className="px-6 py-2">
          <div className="bg-[#2D222A] rounded-xl p-3">
            <p className="text-[9px] uppercase text-gray-400 tracking-wider font-semibold">
              Current Workspace
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
              <span className="text-white text-sm font-semibold">Administrator</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 mt-2">
          <p className="text-[10px] uppercase text-gray-500 font-bold mb-2 ml-4 tracking-wider">
            Menu
          </p>
          <ul className="space-y-0.5">
            {sidebarMenu.map((item) => (
              <li key={item.id}>
                <a
                  href="#!"
                  title={item.label}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(item.id);
                    onClose();
                  }}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${
                    active === item.id
                      ? 'bg-sidebar-active text-white font-medium'
                      : 'text-gray-400 hover:bg-gray-800/50 hover:text-white transition-colors'
                  }`}
                >
                  <Icon name={item.icon} className="w-5 text-center text-sm shrink-0" />
                  <span className="text-[13px]">{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-6 mt-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-pink-600 flex items-center justify-center text-white font-bold shrink-0 text-sm">
              LA
            </div>
            <div>
              <p className="text-white text-sm font-semibold">Local Administrator</p>
              <p className="text-xs text-gray-400">@admin</p>
            </div>
          </div>
          <button className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-gray-600/50 text-gray-300 hover:bg-gray-800 transition-colors cursor-pointer">
            <Icon name="logout" size={14} />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
    </>
  );
}
