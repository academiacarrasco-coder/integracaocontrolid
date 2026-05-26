import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Save, Image as ImageIcon, Building, CheckCircle2, Loader2, Shield, Eye, EyeOff, Cpu, AlertCircle, ExternalLink } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showSecurityPassword, setShowSecurityPassword] = useState(false);
  const [showMyPassword, setShowMyPassword] = useState(false);
  const [formData, setFormData] = useState({
    gymName: '',
    logoUrl: '',
    securityPassword: '',
    myPassword: '',
    webhookUrl: '',
    turnstileUrl: 'https://push.idsecure.com.br/api',
    cloudId: '',
    equipmentId: '0',
    cloudUser: '',
    cloudPassword: ''
  });

  const { profile } = useAuth();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'global');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData(prev => ({
            ...prev,
            gymName: data.gymName || '',
            logoUrl: data.logoUrl || '',
            securityPassword: data.securityPassword || '',
            webhookUrl: data.webhookUrl || '',
            turnstileUrl: data.turnstileUrl || '',
            cloudId: data.cloudId || '',
            equipmentId: data.equipmentId || '0',
            cloudUser: data.cloudUser || '',
            cloudPassword: data.cloudPassword || ''
          }));
        }

        if (profile) {
          setFormData(prev => ({
            ...prev,
            myPassword: profile.password || ''
          }));
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [profile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) { // 500KB limit for base64 in Firestore
        alert('A imagem é muito grande. Por favor, escolha uma imagem com menos de 500KB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    try {
      // Save global settings
      await setDoc(doc(db, 'settings', 'global'), {
        gymName: formData.gymName,
        logoUrl: formData.logoUrl,
        securityPassword: formData.securityPassword,
        webhookUrl: formData.webhookUrl,
        turnstileUrl: formData.turnstileUrl,
        cloudId: formData.cloudId,
        equipmentId: formData.equipmentId,
        cloudUser: formData.cloudUser,
        cloudPassword: formData.cloudPassword,
        updatedAt: serverTimestamp()
      });
      
      // Update current user's password in their document
      if (profile?.uid) {
        await setDoc(doc(db, 'users', profile.uid), {
          password: formData.myPassword
        }, { merge: true });
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-yellow-400" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header>
        <h2 className="text-3xl font-bold tracking-tight text-white">Configurações</h2>
        <p className="text-neutral-500">Personalize a identidade visual do sistema.</p>
      </header>

      <form onSubmit={handleSubmit} className="bg-black border-2 border-neutral-600 rounded-3xl p-8 space-y-8 shadow-2xl">
        <div className="space-y-6">
           <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
              <Building size={14} /> Nome da Academia
            </label>
            <input
              type="text"
              placeholder="Ex: Carrasco Fit"
              className="w-full px-6 py-4 bg-neutral-900 border-2 border-neutral-600 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white font-bold"
              value={formData.gymName}
              onChange={(e) => setFormData({ ...formData, gymName: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
              <Shield size={14} className="text-yellow-400" /> Minha Senha de Acesso
            </label>
            <div className="relative group">
              <input
                type={showMyPassword ? "text" : "password"}
                placeholder="Sua senha pessoal"
                className="w-full px-6 py-4 bg-neutral-900 border-2 border-neutral-600 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white font-bold pr-14"
                value={formData.myPassword}
                onChange={(e) => setFormData({ ...formData, myPassword: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowMyPassword(!showMyPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-neutral-500 hover:text-yellow-400 transition-colors"
              >
                {showMyPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-[10px] text-neutral-500 uppercase font-bold px-2">
              Esta é a sua senha pessoal que será solicitada em cada acesso ao sistema.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
              <Save size={14} className="text-blue-400" /> Integração App de Treino (Webhook URL)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://seu-app-de-treino.com/api/sync"
                className="flex-1 px-6 py-4 bg-neutral-900 border-2 border-neutral-600 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400 transition-all text-white font-bold"
                value={formData.webhookUrl}
                onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
              />
              <button
                type="button"
                onClick={async () => {
                  if (!formData.webhookUrl) return alert('Insira uma URL primeiro.');
                  try {
                    await fetch(formData.webhookUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ test: true, message: 'Teste de conexão Carrasco Fit' }),
                      mode: 'no-cors'
                    });
                    alert('Teste enviado! Verifique seu app de treino.');
                  } catch (err) {
                    alert('Erro ao enviar teste: ' + (err as Error).message);
                  }
                }}
                className="px-6 bg-neutral-800 text-white rounded-2xl font-bold hover:bg-neutral-700 transition-all border-2 border-neutral-600"
              >
                Testar
              </button>
            </div>
            <p className="text-[10px] text-neutral-500 uppercase font-bold px-2">
              Sempre que um aluno for cadastrado ou atualizado, os dados serão enviados para esta URL.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
              <Save size={14} /> Senha de Segurança (para exclusões)
            </label>
            <div className="relative group">
              <input
                type={showSecurityPassword ? "text" : "password"}
                placeholder="Digite a senha para confirmar exclusões"
                className="w-full px-6 py-4 bg-neutral-900 border-2 border-neutral-600 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white font-bold pr-14"
                value={formData.securityPassword}
                onChange={(e) => setFormData({ ...formData, securityPassword: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowSecurityPassword(!showSecurityPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-neutral-500 hover:text-yellow-400 transition-colors"
              >
                {showSecurityPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-[10px] text-neutral-500 uppercase font-bold px-2">
              Esta senha será solicitada ao excluir planos ou turmas de um aluno.
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t-2 border-neutral-600">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Cpu size={16} className="text-yellow-400" /> Configurações da Catraca (iDCloud / Push)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-neutral-500 uppercase">URL iDCloud Ativo</label>
                    <button 
                      type="button"
                      onClick={() => setFormData({ ...formData, turnstileUrl: window.location.origin })}
                      className="text-[10px] font-black text-yellow-400 uppercase hover:underline"
                    >
                      Usar Link Atual
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="https://push.idsecure.com.br/api"
                    className="w-full px-4 py-3 bg-neutral-900 border-2 border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white text-sm"
                    value={formData.turnstileUrl}
                    onChange={(e) => setFormData({ ...formData, turnstileUrl: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase">Código ID Cloud</label>
                <input
                  type="text"
                  placeholder="Ex: 45428515"
                  className="w-full px-4 py-3 bg-neutral-900 border-2 border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white text-sm"
                  value={formData.cloudId}
                  onChange={(e) => setFormData({ ...formData, cloudId: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase">Usuário iDCloud</label>
                <input
                  type="text"
                  placeholder="E-mail de acesso ao iDCloud"
                  className="w-full px-4 py-3 bg-neutral-900 border-2 border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white text-sm"
                  value={formData.cloudUser}
                  onChange={(e) => setFormData({ ...formData, cloudUser: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase">Senha iDCloud</label>
                <div className="relative">
                  <input
                    type={showSecurityPassword ? "text" : "password"}
                    placeholder="Senha do portal iDCloud"
                    className="w-full px-4 py-3 bg-neutral-900 border-2 border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white text-sm pr-10"
                    value={formData.cloudPassword}
                    onChange={(e) => setFormData({ ...formData, cloudPassword: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecurityPassword(!showSecurityPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                  >
                    {showSecurityPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase">ID do Equipamento</label>
                <select
                  className="w-full px-4 py-3 bg-neutral-900 border-2 border-neutral-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all text-white text-sm appearance-none"
                  value={formData.equipmentId}
                  onChange={(e) => setFormData({ ...formData, equipmentId: e.target.value })}
                >
                  <option value="0">0</option>
                  <option value="1">1</option>
                </select>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-yellow-400 uppercase">Configuração da Catraca (Servidor Direto)</label>
                  <div className="relative">
                    <input
                      readOnly
                      type="text"
                      className="w-full px-4 py-3 bg-neutral-800 border-2 border-yellow-400/50 rounded-xl text-yellow-400 text-xs font-mono font-bold"
                      value="carrasco-fit-607856914066.us-east1.run.app"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText("carrasco-fit-607856914066.us-east1.run.app");
                        alert('DOMÍNIO COPIADO!\n\nUse este endereço (SEM HTTPS) no campo "Servidor" da sua catraca.');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-yellow-400 text-black text-[10px] font-black rounded-lg hover:bg-yellow-300 shadow-lg"
                    >
                      COPIAR DOMÍNIO
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-neutral-800/50 border border-neutral-700 rounded-xl">
                    <p className="text-[10px] font-black text-white uppercase mb-1">Opção A (Porta 443)</p>
                    <p className="text-[9px] text-neutral-400 leading-tight">SSL/Cripto: <span className="text-yellow-400 font-bold">LIGADO (ON)</span></p>
                  </div>
                  <div className="p-3 bg-neutral-800/50 border border-yellow-400/20 rounded-xl">
                    <p className="text-[10px] font-black text-yellow-400 uppercase mb-1">Opção B (Porta 80)</p>
                    <p className="text-[9px] text-neutral-400 leading-tight">SSL/Cripto: <span className="text-white font-bold">DESLIGADO (OFF)</span></p>
                  </div>
                </div>
                
                <p className="text-[10px] text-neutral-500 font-bold uppercase leading-tight">
                  ESTE É O SEU SERVIDOR DIRETO. USE PARA CONFIGURAR O IDCLOUD DA CATRACA.
                </p>
              </div>
            </div>
            <p className="text-[10px] text-neutral-500 uppercase font-bold">
              Para usar o modo online, configure a URL de Push acima no menu da sua catraca (Rede {'>'} Servidor Externo).
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
              <ImageIcon size={14} /> Logo da Academia (JPG/PNG)
            </label>
            <div className="relative group">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="logo-upload"
              />
              <label 
                htmlFor="logo-upload"
                className="w-full px-6 py-8 bg-neutral-900 border-2 border-dashed border-neutral-600 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-yellow-400/50 hover:bg-neutral-800/50 transition-all group"
              >
                <div className="w-12 h-12 bg-neutral-800 rounded-xl flex items-center justify-center text-neutral-500 group-hover:text-yellow-400 transition-colors">
                  <ImageIcon size={24} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-white uppercase tracking-tight">Clique para carregar foto</p>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">JPG, PNG ou SVG (Máx. 500KB)</p>
                </div>
              </label>
            </div>
          </div>

          {formData.logoUrl && (
            <div className="p-6 bg-neutral-900 rounded-2xl border-2 border-neutral-600 flex flex-col items-center gap-4 relative group">
              <button 
                type="button"
                onClick={() => setFormData({ ...formData, logoUrl: '' })}
                className="absolute top-4 right-4 p-2 bg-red-500/10 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
              >
                <Save size={14} className="rotate-45" /> {/* Using Save as a placeholder for an X icon if needed, but I'll use a better one if available */}
              </button>
              <p className="text-[10px] font-bold text-neutral-500 uppercase">Pré-visualização do Logo</p>
              <img 
                src={formData.logoUrl} 
                alt="Preview" 
                className="h-24 w-auto object-contain"
                onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/150?text=Erro+no+Logo')}
              />
            </div>
          )}
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-yellow-400 text-black py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-yellow-300 transition-all shadow-xl shadow-yellow-400/10 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" /> : success ? <CheckCircle2 /> : <Save />}
            {saving ? 'Salvando...' : success ? 'Configurações Salvas!' : 'Salvar Alterações'}
          </button>
        </div>
      </form>

      <div className="bg-yellow-400/5 border-2 border-yellow-400/20 p-6 rounded-2xl space-y-2">
        <h4 className="text-sm font-bold text-yellow-400 flex items-center gap-2 uppercase">
          <CheckCircle2 size={16} /> Dica de Design
        </h4>
        <p className="text-xs text-neutral-400 leading-relaxed">
          Para melhores resultados, use um logo com fundo transparente (PNG ou SVG) e cores que contrastem bem com o fundo preto da barra lateral.
        </p>
      </div>
    </div>
  );
}
