import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, Send, FileText } from 'lucide-react';
import InboxIcon from 'lucide-react/dist/esm/icons/inbox';
import Dashboard from './pages/Dashboard';
import Campaigns from './pages/Campaigns';
import MessageQueue from './pages/MessageQueue';
import InboxPage from './pages/Inbox';
import Templates from './pages/Templates';

function App() {
  const location = useLocation();
  
  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/campaigns', icon: MessageSquare, label: 'Campaigns' },
    { path: '/queue', icon: Send, label: 'Queue' },
    { path: '/inbox', icon: InboxIcon, label: 'Inbox' },
    { path: '/templates', icon: FileText, label: 'Templates' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-whatsapp-green flex items-center gap-2">
            <MessageSquare className="w-6 h-6" />
            WhatsApp CRM
          </h1>
        </div>
        
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-whatsapp-green text-white' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
          <div className="text-xs text-gray-500">
            <p className="font-semibold">Status</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span>Connected</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/queue" element={<MessageQueue />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/templates" element={<Templates />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
