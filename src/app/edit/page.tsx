// app/edit/page.tsx
'use client';

import React from 'react';
import { Shield } from 'lucide-react';
import DataEditor from '@/edit/DataEditor';

export default function EditPage() {
  return (
    <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6 bg-gradient-to-r from-green-600 to-green-800 text-white p-4 rounded-lg shadow-lg">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6" />
          <div>
            <h1 className="text-xl font-bold">🔐 Editor de Datos</h1>
            <p className="text-green-100 text-sm">Panel de administración del sistema</p>
          </div>
        </div>
      </div>

      {/* Componente del Editor de Datos */}
      <DataEditor />
    </main>
  );
}
