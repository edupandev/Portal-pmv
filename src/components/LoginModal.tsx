import React, { useState, useEffect } from 'react';
import { mqttService } from '../services/mqttService';
import { Lock, User, KeyRound, Server, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { BrokerOption } from '../types/pmv';

interface LoginModalProps {
  currentBroker: BrokerOption;
  onSuccess: (user: string) => void;
  onOpenBrokerSettings: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  currentBroker,
  onSuccess,
  onOpenBrokerSettings,
}) => {
  const [user, setUser] = useState('geral3');
  const [pass, setPass] = useState('123');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = mqttService.onAuth((res) => {
      if (res.status === 'success') {
        setIsAuthenticating(false);
        setStatusMsg('Autenticado com sucesso!');
        setTimeout(() => {
          onSuccess(user);
        }, 400);
      } else {
        setIsAuthenticating(false);
        setErrorMsg(res.reason || 'Usuário ou senha incorretos.');
      }
    });

    return unsub;
  }, [user, onSuccess]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.trim() || !pass.trim()) {
      setErrorMsg('Preencha os campos de Usuário e Senha');
      return;
    }

    setErrorMsg(null);
    setIsAuthenticating(true);
    setStatusMsg(`Autenticando via MQTT (${currentBroker.name})...`);

    mqttService.sendAuthRequest(user.trim(), pass.trim());

    // Timeout fallback after 5s
    setTimeout(() => {
      if (isAuthenticating) {
        setIsAuthenticating(false);
        setErrorMsg('Sem resposta do broker ou painel no tempo limite. Verifique as configurações de rede.');
      }
    }, 5000);
  };

  return (
    <div className="fixed inset-0 z-[4000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Subtle decorative background tints */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-100 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-100 rounded-full blur-3xl pointer-events-none" />

        {/* Title */}
        <div className="text-center mb-6 relative">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-wider">
            SACC <strong className="text-blue-600">LOGIN</strong>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Sistema de Controle de Painéis PMV</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4 relative">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" /> USUÁRIO
            </label>
            <input
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="ex: geral3"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono transition shadow-xs"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-blue-600" /> SENHA
            </label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="ex: 123"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono transition shadow-xs"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2 shadow-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {statusMsg && !errorMsg && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs flex items-start gap-2 shadow-xs">
              <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0 mt-0.5" />
              <span>{statusMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isAuthenticating}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50 text-sm"
          >
            {isAuthenticating ? 'AUTENTICANDO...' : 'ENTRAR NO SISTEMA'}
            {!isAuthenticating && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        {/* Footer info */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <button
            onClick={onOpenBrokerSettings}
            className="hover:text-blue-600 flex items-center gap-1 transition underline decoration-dotted"
          >
            <Server className="w-3.5 h-3.5" /> Broker: {currentBroker.name.split(' ')[0]}
          </button>
          <span className="font-mono text-[11px] text-slate-400">SACC v2.4</span>
        </div>
      </div>
    </div>
  );
};
