import React from 'react';
import { AppData } from '../../types';

interface AdminViewProps {
  appData: AppData;
  setAppData: React.Dispatch<React.SetStateAction<AppData>>;
}

export const AdminView: React.FC<AdminViewProps> = ({ appData }) => (
    <div className="bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-md border border-border-light dark:border-border-dark">
      <h2 className="text-2xl font-bold mb-4">Painel Administrativo</h2>
      <p>Esta área é para gerenciamento do sistema.</p>
      <div className="mt-4">
        <h3 className="text-lg font-semibold">Estatísticas Gerais</h3>
        <ul>
          <li>Total de Usuários: {appData.users.length}</li>
          <li>Total de Fontes: {appData.sources.length}</li>
          <li>Total de Mensagens no Chat: {appData.chatMessages.length}</li>
        </ul>
      </div>
    </div>
);
