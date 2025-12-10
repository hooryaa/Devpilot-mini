import { 
  FolderOpen, 
  Search, 
  GitBranch, 
  Bug, 
  Package, 
  Settings,
  Files,
  Code,
  Database,
  Zap
} from 'lucide-react';

export function VSCodeSidebar() {
  const sidebarItems = [
    { icon: Files, label: 'Explorer', color: 'text-pink-400' },
    { icon: Search, label: 'Search', color: 'text-yellow-400' },
    { icon: GitBranch, label: 'Source Control', color: 'text-orange-400' },
    { icon: Bug, label: 'Run and Debug', color: 'text-green-400' },
    { icon: Package, label: 'Extensions', color: 'text-pink-400' },
    { icon: Code, label: 'DevPilot', color: 'text-purple-400' },
    { icon: Database, label: 'Database', color: 'text-yellow-400' },
    { icon: Zap, label: 'AI Assistant', color: 'text-orange-400' },
  ];

  return (
    <div className="w-12 bg-gray-900 border-r border-gray-700 flex flex-col items-center py-2">
      {sidebarItems.map((item, index) => (
        <div
          key={index}
          className="p-2 hover:bg-gray-800 rounded-lg cursor-pointer transition-all duration-200 group relative mb-1"
        >
          <item.icon className={`w-5 h-5 ${item.color} group-hover:scale-110 transition-transform`} />
          <div className="absolute left-12 top-1/2 -translate-y-1/2 bg-gray-800 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            {item.label}
          </div>
        </div>
      ))}
      
      <div className="mt-auto p-2 hover:bg-gray-800 rounded-lg cursor-pointer transition-all duration-200 group">
        <Settings className="w-5 h-5 text-gray-400 group-hover:text-purple-400 group-hover:scale-110 transition-all" />
      </div>
    </div>
  );
}