import React, { useState, useRef } from 'react';
import { useGymData } from '../hooks/useGymData';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  writeBatch 
} from 'firebase/firestore';
import { 
  Download, 
  FileJson, 
  FileSpreadsheet, 
  Share2, 
  Database,
  CheckCircle2,
  Upload,
  AlertTriangle,
  Loader2,
  XCircle
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Export() {
  const { students, plans, payments, classes } = useGymData();
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingData, setPendingData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadFile = (content: string, fileName: string, contentType: string) => {
    const a = document.createElement('a');
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
  };

  const exportToJson = () => {
    const data = {
      students,
      plans,
      payments,
      classes,
      exportedAt: new Date().toISOString(),
      source: "Carrasco Fit"
    };
    downloadFile(JSON.stringify(data, null, 2), 'carrasco_fit_data.json', 'application/json');
  };

  const exportToCarrascoFit = () => {
    // Specific format for Carrasco Fit with requested fields: nome, cpf, data de nascimento e celular
    const data = students.map(s => ({
      nome: s.name,
      cpf: s.cpf || 'N/A',
      data_nascimento: s.birthDate || 'N/A',
      celular: s.phone || 'N/A'
    }));
    downloadFile(JSON.stringify(data, null, 2), 'carrasco_fit_treino.json', 'application/json');
  };

  const exportToCsv = () => {
    const headers = ['Nome', 'CPF', 'Data de Nascimento', 'Celular'];
    const rows = students.map(s => [
      s.name,
      s.cpf || 'N/A',
      s.birthDate || 'N/A',
      s.phone || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    downloadFile(csvContent, 'alunos_carrasco_fit.csv', 'text/csv');
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        if (data.source !== "Carrasco Fit") {
          setImportStatus({ type: 'error', message: 'Arquivo de backup inválido ou incompatível.' });
          return;
        }

        setPendingData(data);
        setShowConfirm(true);
      } catch (err) {
        setImportStatus({ type: 'error', message: 'Erro ao processar o arquivo de backup.' });
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processImport = async () => {
    if (!pendingData) return;
    
    setIsImporting(true);
    setShowConfirm(false);
    setImportStatus(null);

    try {
      const collections = ['students', 'plans', 'payments', 'classes'];
      
      for (const coll of collections) {
        const items = pendingData[coll];
        if (!Array.isArray(items)) continue;

        // Process in batches of 500
        for (let i = 0; i < items.length; i += 500) {
          const chunk = items.slice(i, i + 500);
          const batch = writeBatch(db);
          
          chunk.forEach((item: any) => {
            const { id, ...rest } = item;
            if (id) {
              const docRef = doc(db, coll, id);
              batch.set(docRef, rest, { merge: true });
            }
          });

          await batch.commit();
        }
      }

      setImportStatus({ type: 'success', message: 'Dados importados com sucesso!' });
    } catch (error) {
      console.error('Import error:', error);
      setImportStatus({ type: 'error', message: 'Erro ao importar dados para o banco de dados.' });
    } finally {
      setIsImporting(false);
      setPendingData(null);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <header className="text-center space-y-2">
        <h2 className="text-4xl font-black tracking-tighter text-white uppercase italic">Exportação de Dados</h2>
        <p className="text-neutral-500">Exporte os dados da sua academia para outros sistemas ou backup.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Carrasco Fit Export */}
        <div className="bg-yellow-400 p-8 rounded-3xl shadow-xl shadow-yellow-400/20 text-black space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="bg-black/10 p-4 rounded-2xl w-fit">
              <Share2 size={32} />
            </div>
            <div>
              <h3 className="text-2xl font-bold italic uppercase tracking-tight">Carrasco Fit Sync</h3>
              <p className="text-black/60 text-sm mt-2 font-medium">
                Gere o arquivo com os dados essenciais: Nome, CPF, Data de Nascimento e Celular.
              </p>
            </div>
          </div>
          <button 
            onClick={exportToCarrascoFit}
            className="w-full bg-black text-yellow-400 py-4 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-neutral-900 transition-all shadow-lg"
          >
            <Download size={20} />
            Exportar para Carrasco Fit
          </button>
        </div>

        {/* General Export */}
        <div className="bg-black p-8 rounded-3xl shadow-sm border border-neutral-800 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="bg-neutral-900 p-4 rounded-2xl w-fit text-neutral-500">
              <Database size={32} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white italic uppercase tracking-tight">Backup Completo</h3>
              <p className="text-neutral-500 text-sm mt-2">
                Exporte todos os dados do sistema (alunos, planos, pagamentos, aulas) em formato JSON.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={exportToJson}
              className="bg-neutral-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all border border-neutral-800"
            >
              <FileJson size={18} />
              JSON
            </button>
            <button 
              onClick={exportToCsv}
              className="bg-neutral-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all border border-neutral-800"
            >
              <FileSpreadsheet size={18} />
              CSV
            </button>
          </div>
        </div>

        {/* Import Section */}
        <div className="bg-neutral-900 p-8 rounded-3xl shadow-sm border border-neutral-800 space-y-6 flex flex-col justify-between md:col-span-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-4">
              <div className="bg-black p-4 rounded-2xl w-fit text-yellow-400">
                <Upload size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white italic uppercase tracking-tight">Importar Backup</h3>
                <p className="text-neutral-500 text-sm mt-2">
                  Restaure dados de um arquivo JSON exportado anteriormente.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 min-w-[240px]">
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                ref={fileInputRef}
                className="hidden"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="bg-yellow-400 text-black py-4 px-8 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-yellow-300 transition-all shadow-lg disabled:opacity-50"
              >
                {isImporting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Upload size={20} />
                )}
                Selecionar Arquivo
              </button>
              
              {importStatus && (
                <div className={cn(
                  "p-3 rounded-xl text-xs font-bold uppercase tracking-widest text-center animate-in fade-in slide-in-from-top-2",
                  importStatus.type === 'success' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                )}>
                  {importStatus.message}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 w-full max-w-md rounded-3xl border border-neutral-800 p-8 space-y-6 animate-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="bg-red-500/10 p-4 rounded-full text-red-500">
                <AlertTriangle size={48} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tight">Confirmar Importação</h3>
                <p className="text-neutral-500 text-sm">
                  Esta ação irá mesclar os dados do arquivo com o banco de dados atual. 
                  Dados com o mesmo ID serão atualizados. Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setPendingData(null);
                }}
                className="flex-1 py-4 bg-neutral-800 text-white font-bold uppercase tracking-widest rounded-xl hover:bg-neutral-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={processImport}
                className="flex-1 py-4 bg-red-500 text-white font-black uppercase tracking-widest rounded-xl hover:bg-red-400 transition-colors shadow-lg shadow-red-500/20"
              >
                Importar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-neutral-900/50 p-6 rounded-2xl border border-neutral-800 space-y-4">
        <h4 className="font-bold flex items-center gap-2 text-white uppercase tracking-widest text-xs">
          <CheckCircle2 size={18} className="text-yellow-400" />
          O que é exportado?
        </h4>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-neutral-500">
          <li className="flex items-center gap-2">• Cadastro completo de alunos</li>
          <li className="flex items-center gap-2">• Histórico de pagamentos</li>
          <li className="flex items-center gap-2">• Configurações de planos</li>
          <li className="flex items-center gap-2">• Cronograma de aulas</li>
          <li className="flex items-center gap-2">• Logs de acesso da catraca</li>
          <li className="flex items-center gap-2">• Status de inadimplência</li>
        </ul>
      </div>
    </div>
  );
}
