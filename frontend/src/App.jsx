import { useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import Dashboard from './components/Dashboard.jsx';
import PagePlaceholder from './components/PagePlaceholder.jsx';
import EmergencyContacts from './components/EmergencyContacts.jsx';
import DrillScheduling from './components/DrillScheduling.jsx';
import EvacuationPlans from './components/EvacuationPlans.jsx';
import IncidentLogging from './components/IncidentLogging.jsx';
import SafetyInspections from './components/SafetyInspections.jsx';
import RiskAssessment from './components/RiskAssessment.jsx';
import ParentNotifications from './components/ParentNotifications.jsx';
import ComplianceReports from './components/ComplianceReports.jsx';
import EmergencyRoles from './components/EmergencyRoles.jsx';
import FirstAidSupplies from './components/FirstAidSupplies.jsx';

const MODULES = {
  emergency: EmergencyContacts,
  drills: DrillScheduling,
  evacuation: EvacuationPlans,
  incidents: IncidentLogging,
  inspections: SafetyInspections,
  risk: RiskAssessment,
  notifications: ParentNotifications,
  'safety-reports': ComplianceReports,
  'emergency-roles': EmergencyRoles,
  supplies: FirstAidSupplies,
};

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [view, setView] = useState('dashboard');

  const handleMenu = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setCollapsed((c) => !c);
    } else {
      setSidebarOpen(true);
    }
  };

  const View = view === 'dashboard' ? Dashboard : MODULES[view];

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        collapsed={collapsed}
        onClose={() => setSidebarOpen(false)}
        active={view}
        onNavigate={setView}
      />

      <main data-purpose="main-area" className="flex-1 flex flex-col h-full overflow-hidden">
        <Topbar onMenuClick={handleMenu} />

        <div data-purpose="dashboard-content" className="flex-1 overflow-y-auto px-10 pb-10">
          {View ? <View /> : <PagePlaceholder view={view} />}
        </div>
      </main>
    </div>
  );
}
