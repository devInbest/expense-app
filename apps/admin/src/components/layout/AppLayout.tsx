import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useMe } from '../../hooks/useAuth';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Refresh the signed-in admin once the shell mounts (role changes, deactivation).
  useMe();

  return (
    <div className="app-layout flex h-screen overflow-hidden bg-gray-50">
      <Sidebar isOpen={sidebarOpen} />
      <div className="app-layout__column">
        <Navbar sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
