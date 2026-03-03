import React from "react";
import { LayoutDashboard, Upload, FileText } from "lucide-react";

export default function Sidebar({
  currentTab,
  setCurrentTab,
}: {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "upload", label: "Data Upload", icon: Upload },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col h-full shrink-0">
      <div className="p-6 flex items-center space-x-3">
        <FileText className="w-8 h-8 text-indigo-400" />
        <span className="text-xl font-bold tracking-tight">RFP Pro</span>
      </div>
      <nav className="flex-1 px-4 space-y-2 mt-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentTab(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${
              currentTab === item.id
                ? "bg-indigo-600 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
