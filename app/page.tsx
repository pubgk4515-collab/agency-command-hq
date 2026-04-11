'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toggleStoreFeature } from './actions/agencyActions';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldAlert, Store, Zap, Search, Loader2, 
  Receipt, MessageCircle, Radar, TrendingUp, BarChart3, Users, X
} from 'lucide-react';

export default function SuperAdminDashboard() {
  const [stores, setStores] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStore, setSelectedStore] = useState<any | null>(null); // For the VIP Drawer
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchNetworkData();
  }, []);

  const fetchNetworkData = async () => {
    try {
      // Fetch all stores
      const { data: storesData } = await supabase
        .from('stores')
        .select('*')
        .order('created_at', { ascending: false });
      
      // Fetch all sales for network volume
      const { data: salesData } = await supabase
        .from('sales')
        .select('total_amount');

      if (storesData) setStores(storesData);
      if (salesData) setSales(salesData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (storeId: string, featureColumn: string, currentValue: boolean) => {
    setUpdatingId(`${storeId}-${featureColumn}`);
    try {
      const result = await toggleStoreFeature(storeId, featureColumn, !currentValue);
      if (result.success) {
        // Update local state for immediate UI reaction
        setStores(stores.map(s => s.id === storeId ? { ...s, [featureColumn]: !currentValue } : s));
        if (selectedStore?.id === storeId) {
          setSelectedStore({ ...selectedStore, [featureColumn]: !currentValue });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Analytics Math
  const totalVolume = sales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
  const totalTransactions = sales.length; // Acting as 'Scans/Orders' for now

  const filteredStores = stores.filter(store => 
    store.store_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    store.slug?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /></div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans overflow-x-hidden selection:bg-emerald-500/30">
      
      {/* 👑 HEADER */}
      <header className="bg-[#0A0A0A]/90 backdrop-blur-xl border-b border-white/5 sticky top-0 z-30 px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.15)]">
              <ShieldAlert className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white leading-none">Agency HQ</h1>
              <p className="text-[9px] uppercase tracking-widest font-bold mt-1 text-emerald-500">Live Network</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* 📊 GOD'S EYE ANALYTICS (Top 3 Metrics) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <StatCard 
            icon={<Store className="w-5 h-5 text-blue-400" />}
            title="Active Tenants"
            value={`${stores.length} / 2000`}
            subtitle="Target for 2026"
            glowColor="rgba(96,165,250,0.1)"
          />
          <StatCard 
            icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
            title="Network Volume (All Time)"
            value={`₹${totalVolume.toLocaleString('en-IN')}`}
            subtitle="Total value processed"
            glowColor="rgba(16,185,129,0.1)"
          />
          <StatCard 
            icon={<Radar className="w-5 h-5 text-purple-400" />}
            title="Global Magic Scans"
            value={totalTransactions.toLocaleString('en-IN')}
            subtitle="Successful checkouts"
            glowColor="rgba(192,132,252,0.1)"
          />
        </div>

        {/* 🏢 STORE DIRECTORY */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-black tracking-tight">Tenant Directory</h2>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search 2000+ stores..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#111] border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-sm font-bold focus:outline-none focus:border-white/30 text-white placeholder:text-zinc-600 transition-colors" 
            />
          </div>
        </div>

        {/* LEADERBOARD LIST */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-[2rem] overflow-hidden">
          {filteredStores.map((store, index) => (
            <div key={store.id} className="flex items-center justify-between p-5 border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-xs font-black text-zinc-500 border border-white/5">
                  #{index + 1}
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">{store.store_name || 'Unnamed Store'}</h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">/{store.slug}</p>
                </div>
              </div>
              
              <button 
                onClick={() => setSelectedStore(store)}
                className="bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest py-2 px-4 rounded-full transition-all flex items-center gap-2"
              >
                <Zap className="w-3 h-3 text-emerald-400" /> VIP Controls
              </button>
            </div>
          ))}
        </div>
      </main>

      {/* 🚀 THE APPLE-STYLE SLIDE DRAWER */}
      <AnimatePresence>
        {selectedStore && (
          <>
            {/* Blur Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedStore(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />
            
            {/* Drawer Panel */}
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-[#0A0A0A] border-l border-white/10 z-50 p-6 shadow-2xl overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-black">{selectedStore.store_name}</h2>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Tenant ID: {selectedStore.id.substring(0,8)}</p>
                </div>
                <button onClick={() => setSelectedStore(null)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <FeatureToggle 
                  icon={<Receipt className="w-4 h-4" />} title="Inclusive GST Engine" 
                  isActive={selectedStore.has_gst} isLoading={updatingId === `${selectedStore.id}-has_gst`}
                  onToggle={() => handleToggle(selectedStore.id, 'has_gst', selectedStore.has_gst)} themeColor={selectedStore.theme_color}
                />
                <FeatureToggle 
                  icon={<Radar className="w-4 h-4" />} title="Virtual CCTV (Radar)" 
                  isActive={selectedStore.has_live_radar} isLoading={updatingId === `${selectedStore.id}-has_live_radar`}
                  onToggle={() => handleToggle(selectedStore.id, 'has_live_radar', selectedStore.has_live_radar)} themeColor={selectedStore.theme_color}
                />
                <FeatureToggle 
                  icon={<MessageCircle className="w-4 h-4" />} title="WhatsApp CRM" 
                  isActive={selectedStore.has_whatsapp_crm} isLoading={updatingId === `${selectedStore.id}-has_whatsapp_crm`}
                  onToggle={() => handleToggle(selectedStore.id, 'has_whatsapp_crm', selectedStore.has_whatsapp_crm)} themeColor={selectedStore.theme_color}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}

// Sub-components
function StatCard({ icon, title, value, subtitle, glowColor }: any) {
  return (
    <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-[2rem] relative overflow-hidden group hover:border-white/10 transition-colors">
      <div className="absolute top-0 right-0 w-32 h-32 blur-[50px] transition-all group-hover:scale-150" style={{ backgroundColor: glowColor }} />
      <div className="relative z-10">
        <div className="w-10 h-10 bg-[#111] rounded-xl flex items-center justify-center border border-white/5 mb-4">{icon}</div>
        <p className="text-3xl font-black tracking-tighter text-white">{value}</p>
        <p className="text-xs font-bold text-zinc-300 mt-1">{title}</p>
        <p className="text-[10px] uppercase tracking-widest font-black text-zinc-600 mt-3">{subtitle}</p>
      </div>
    </div>
  );
}

function FeatureToggle({ icon, title, isActive, isLoading, onToggle, themeColor }: any) {
  const activeColor = themeColor || '#10b981';
  return (
    <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${isActive ? 'bg-[#111] border-white/20' : 'bg-[#0A0A0A] border-white/5'}`} onClick={onToggle}>
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isActive ? 'bg-white/10' : 'bg-white/5'}`} style={{ color: isActive ? activeColor : '#71717a' }}>{icon}</div>
        <h4 className={`text-sm font-black ${isActive ? 'text-white' : 'text-zinc-400'}`}>{title}</h4>
      </div>
      {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-zinc-500" /> : (
        <div className={`w-10 h-6 rounded-full p-1 transition-colors ${isActive ? 'bg-emerald-500' : 'bg-zinc-800'}`}>
          <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isActive ? 'translate-x-4' : 'translate-x-0'}`} />
        </div>
      )}
    </div>
  );
}
