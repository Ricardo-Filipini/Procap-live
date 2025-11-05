import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div 
        className="bg-card-light dark:bg-card-dark rounded-lg shadow-xl p-6 w-full max-w-lg relative border border-border-light dark:border-border-dark max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b border-border-light dark:border-border-dark pb-3 mb-4 flex-shrink-0">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
