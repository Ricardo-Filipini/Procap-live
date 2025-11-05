import React from 'react';
import { User, View } from '../types';
import { VIEWS } from '../constants';
import { ArrowLeftOnRectangleIcon, Bars3Icon } from './Icons';

interface SidebarProps {
  currentUser: User;
  activeView: View;
  setActiveView: (view: View) => void;
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentUser, activeView, setActiveView, isCollapsed, setIsCollapsed, onLogout }) => {
  const availableViews = VIEWS.filter(view => !view.adminOnly || (view.adminOnly && currentUser.pseudonym === 'admin'));
  
  return (
    <aside
      className={`fixed top-0 left-0 h-full bg-card-light dark:bg-card-dark border-r border-border-light dark:border-border-dark flex flex-col transition-all duration-300 z-10 ${
        isCollapsed ? 'w-14' : 'w-64'
      }`}
    >
      <div className={`flex items-center border-b border-border-light dark:border-border-dark p-4 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed && <h1 className="text-xl font-bold text-primary-light dark:text-primary-dark">Procap - G200</h1>}
        <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
            <Bars3Icon className="w-6 h-6" />
        </button>
      </div>
      <nav className="flex-1 mt-4">
        <ul>
          {availableViews.map((view) => (
            <li key={view.name} className={`${isCollapsed ? 'px-1' : 'px-4'}`}>
              <button
                onClick={() => setActiveView(view)}
                className={`w-full flex items-center p-2 my-1 rounded-md transition-colors duration-200 ${
                  activeView.name === view.name
                    ? 'bg-primary-light/10 dark:bg-primary-dark/20 text-primary-light dark:text-primary-dark'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                } ${isCollapsed ? 'justify-center' : ''}`}
              >
                <view.icon className={`transition-all duration-300 ${isCollapsed ? 'w-8 h-8' : 'w-6 h-6'}`} />
                {!isCollapsed && <span className="ml-4 font-medium">{view.name}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className={`border-t border-border-light dark:border-border-dark transition-all duration-300 ${isCollapsed ? 'px-1 py-4' : 'p-4'}`}>
          <button 
            onClick={onLogout}
            className={`w-full flex items-center p-2 rounded-md transition-colors duration-200 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 ${isCollapsed ? 'justify-center' : ''}`}>
              <ArrowLeftOnRectangleIcon className={`transition-all duration-300 ${isCollapsed ? 'w-8 h-8' : 'w-6 h-6'}`}/>
              {!isCollapsed && <span className="ml-4 font-medium">Sair</span>}
          </button>
      </div>
    </aside>
  );
};