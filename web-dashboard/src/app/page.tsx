'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Device, Alert } from '@/lib/types';
import { 
  Fan, 
  Lightbulb, 
  Zap, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  Cpu, 
  Clock,
  TrendingDown,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  X,
  BarChart2
} from 'lucide-react';

// Initialize API Base URL
const apiBase = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:3000';

// Initialize Supabase Client on client-side
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const hasSupabaseEnv = supabaseUrl && supabaseKey;
const supabase = hasSupabaseEnv ? createClient(supabaseUrl, supabaseKey) : null;

// Exact percentage coordinates mapped from the 1536x1024 layout blueprint
const coordinatesMap: Record<string, { left: string; top: string }> = {
  // Drawing Room (DR - Left Room)
  'd1000000-0000-0000-0000-000000000001': { left: '25.24%', top: '20.12%' },  // Fan 1
  'd1000000-0000-0000-0000-000000000002': { left: '25.41%', top: '50.30%' },  // Fan 2
  'd1000000-0000-0000-0000-000000000003': { left: '20.16%', top: '14.24%' },  // Light 1
  'd1000000-0000-0000-0000-000000000004': { left: '31.69%', top: '14.26%' },  // Light 2
  'd1000000-0000-0000-0000-000000000005': { left: '25.39%', top: '62.80%' },  // Light 3

  // Work Room 1 (WR1 - Middle Room)
  'd2000000-0000-0000-0000-000000000001': { left: '49.01%', top: '21.79%' },  // Fan 1
  'd2000000-0000-0000-0000-000000000002': { left: '48.96%', top: '50.49%' },  // Fan 2
  'd2000000-0000-0000-0000-000000000003': { left: '42.10%', top: '14.17%' },  // Light 1
  'd2000000-0000-0000-0000-000000000004': { left: '55.01%', top: '14.17%' },  // Light 2
  'd2000000-0000-0000-0000-000000000005': { left: '48.83%', top: '64.14%' },  // Light 3

  // Work Room 2 (WR2 - Right Room)
  'd3000000-0000-0000-0000-000000000001': { left: '73.39%', top: '21.30%' },  // Fan 1
  'd3000000-0000-0000-0000-000000000002': { left: '73.63%', top: '49.98%' },  // Fan 2
  'd3000000-0000-0000-0000-000000000003': { left: '66.20%', top: '14.18%' },  // Light 1
  'd3000000-0000-0000-0000-000000000004': { left: '80.29%', top: '14.12%' },  // Light 2
  'd3000000-0000-0000-0000-000000000005': { left: '72.85%', top: '62.37%' },  // Light 3
};

const roomNames: Record<string, string> = {
  'drawing-room': 'Drawing Room',
  'work-room-1': 'Work Room 1',
  'work-room-2': 'Work Room 2',
};

export default function Dashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [currentPower, setCurrentPower] = useState<number>(0);
  const [dailyKWh, setDailyKWh] = useState<number>(0);
  const [roomPower, setRoomPower] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [hoveredDeviceId, setHoveredDeviceId] = useState<string | null>(null);
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);

  // Logs & history states
  const [deviceHistory, setDeviceHistory] = useState<any[]>([]);

  // Simulated time & voltage states
  const [voltage, setVoltage] = useState<number>(220);
  const [simulatedTime, setSimulatedTime] = useState<string>('');
  const [simulatedTimeRaw, setSimulatedTimeRaw] = useState<string>('');

  // Alert carousel index
  const [alertIndex, setAlertIndex] = useState<number>(0);

  // Breakdown modal
  const [showBreakdown, setShowBreakdown] = useState<boolean>(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [breakdownData, setBreakdownData] = useState<any>(null);

  // Time tracking states for accurate live ticking
  const [lastFetchTime, setLastFetchTime] = useState<number>(Date.now());
  const [timeSinceUpdate, setTimeSinceUpdate] = useState<number>(0);

  // Helper to fetch all data
  const fetchData = async () => {
    try {
      const [resDevices, resPower, resConsumption, resAlerts, resHistory] = await Promise.all([
        fetch(`${apiBase}/api/devices`).then((r) => r.json()),
        fetch(`${apiBase}/api/power`).then((r) => r.json()),
        fetch(`${apiBase}/api/consumption`).then((r) => r.json()),
        fetch(`${apiBase}/api/alerts`).then((r) => r.json()),
        fetch(`${apiBase}/api/devices/history`).then((r) => r.json()),
      ]);

      if (resDevices.error) throw new Error(resDevices.error);
      if (resPower.error) throw new Error(resPower.error);
      if (resConsumption.error) throw new Error(resConsumption.error);
      if (resAlerts.error) throw new Error(resAlerts.error);
      if (resHistory.error) throw new Error(resHistory.error);

      setDevices(resDevices);
      setCurrentPower(resPower.currentPower);
      setRoomPower(resPower.roomBreakdown || {});
      setVoltage(resPower.voltage ?? 220);
      if (resPower.simulatedTime) {
        setSimulatedTimeRaw(resPower.simulatedTime);
        const st = new Date(resPower.simulatedTime);
        setSimulatedTime(
          st.toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
        );
      }
      setDailyKWh(resConsumption.dailyKWh);
      // Store full breakdown so dashboard card & modal read the same snapshot
      setBreakdownData(resConsumption);
      setDeviceHistory(resHistory || []);
      setAlerts((prev) => {
        // Reset carousel index if alert count drops
        if (resAlerts.length < prev.length) setAlertIndex(0);
        return resAlerts;
      });
      setError(null);
      
      // Update fetch timestamp to reset timer
      setLastFetchTime(Date.now());
      setTimeSinceUpdate(0);
    } catch (err: unknown) {
      console.error('Failed to load dashboard data:', err);
      setError('Connection to backend API failed. Ensure API is running and configured.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    if (!supabase) return;

    // Subscribe to Realtime Updates on devices table
    const devicesSubscription = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'devices' },
        (payload) => {
          console.log('Realtime update on devices:', payload);
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts' },
        (payload) => {
          console.log('Realtime update on alerts:', payload);
          fetch(`${apiBase}/api/alerts`)
            .then((r) => r.json())
            .then((data) => {
              setAlerts(data);
              setLastFetchTime(Date.now());
              setTimeSinceUpdate(0);
            })
            .catch(console.error);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(devicesSubscription);
    };
  }, []);

  // Update relative ticking timer since last update
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSinceUpdate((Date.now() - lastFetchTime) / 1000);
    }, 100);
    return () => clearInterval(timer);
  }, [lastFetchTime]);

  // Poll backend every 3 seconds for realtime updates
  useEffect(() => {
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  // NOTE: No separate breakdown polling needed — fetchData (every 3s) already
  // stores the full consumption response (including rooms) into breakdownData.
  // The modal reads directly from that state, keeping everything in sync.

  if (!hasSupabaseEnv) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-6">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full shadow-2xl text-center">
          <h1 className="text-2xl font-bold text-rose-500 mb-4 font-sans">Setup Required</h1>
          <p className="text-slate-400 mb-6">
            Supabase environment variables are missing! Rename `.env.example` to `.env.local` inside the `backend` folder and add your Supabase credentials.
          </p>
          <div className="text-left bg-slate-950 p-4 rounded-lg font-mono text-xs text-slate-500 border border-slate-900">
            NEXT_PUBLIC_SUPABASE_URL=...<br />
            NEXT_PUBLIC_SUPABASE_ANON_KEY=...
          </div>
        </div>
      </div>
    );
  }

  // Max Power Capacity (15 devices: 6 fans @ 60W, 9 lights @ 15W)
  const maxCapacity = 495;
  const loadPercentage = Math.min((currentPower / maxCapacity) * 100, 100);

  // Devices calculations
  const totalOn = devices.filter((d) => d.status).length;
  const totalOff = devices.length - totalOn;

  // Energy consumption — cost comes from the server (same computation as the modal)
  // so the card and the modal always show identical numbers.
  const yesterdayKWh = 2.1; // Baseline comparison
  const kwhDiff = dailyKWh - yesterdayKWh;
  const pctChange = yesterdayKWh > 0 ? (kwhDiff / yesterdayKWh) * 100 : 0;
  const estCost: number = breakdownData?.totalCostBDT ?? 0;

  // Get top 3 most recently changed devices
  const recentChanges = [...devices]
    .filter((d) => d.last_changed_at)
    .sort((a, b) => new Date(b.last_changed_at).getTime() - new Date(a.last_changed_at).getTime())
    .slice(0, 3);

  // Time formatter — always formatted in Asia/Dhaka (simulated office timezone)
  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const dhakaDate = new Date(date.getTime() + 6 * 60 * 60 * 1000);
      const utcHours = dhakaDate.getUTCHours();
      const utcMinutes = dhakaDate.getUTCMinutes();
      const ampm = utcHours >= 12 ? 'PM' : 'AM';
      const hour12 = utcHours % 12 || 12;
      const minStr = utcMinutes.toString().padStart(2, '0');
      return `${hour12}:${minStr} ${ampm}`;
    } catch (e) {
      return '--:--';
    }
  };

  // Get current simulated date/time (now running on 1x real-world speed)
  const getGetCurrentSimulatedTime = () => {
    if (!simulatedTimeRaw) return new Date();
    const baseDate = new Date(simulatedTimeRaw);
    const elapsedMs = Date.now() - lastFetchTime;
    return new Date(baseDate.getTime() + elapsedMs);
  };

  // Helper for human relative time
  const formatRelativeTime = (dateString: string) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      const currentSimTime = getGetCurrentSimulatedTime();
      const diffMs = currentSimTime.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);

      if (diffSec < 5) return 'Just now';
      if (diffSec < 60) return `${diffSec}s ago`;
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHour < 24) return `${diffHour}h ago`;
      
      const dhakaDate = new Date(date.getTime() + 6 * 60 * 60 * 1000);
      const year = dhakaDate.getUTCFullYear();
      const month = (dhakaDate.getUTCMonth() + 1).toString().padStart(2, '0');
      const day = dhakaDate.getUTCDate().toString().padStart(2, '0');
      return `${month}/${day}/${year}`;
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="lg:h-screen lg:overflow-hidden flex flex-col bg-zinc-50 text-zinc-900 font-sans pb-4 relative selection:bg-zinc-800 selection:text-white">
      <main className="flex-1 min-h-0 max-w-7xl w-full mx-auto px-6 py-6 flex flex-col gap-6 relative z-10">
        
        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-800 p-3 rounded-2xl text-xs font-mono flex items-center gap-3 shrink-0 shadow-sm">
            <AlertTriangle className="h-4 w-4 text-rose-550 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Top Header Row (Inline Branding + Connection Status) */}
        <div className="shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo & Branding */}
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl border border-zinc-200 bg-white flex items-center justify-center shadow-sm">
                <Cpu className="h-4 w-4 text-zinc-900" />
              </div>
              <div>
                <h1 className="text-sm font-black tracking-widest text-zinc-900 uppercase font-mono leading-none">
                  CHRONO OFFICE
                </h1>
                <p className="text-[9px] text-zinc-400 font-mono tracking-wider uppercase mt-1 leading-none">Electricity Monitor</p>
              </div>
            </div>

            {/* Connection Indicator */}
            <div className="flex items-center gap-1.5 bg-emerald-50/50 border border-emerald-250/60 px-2.5 py-1 rounded-full shadow-[0_1px_2px_rgba(16,185,129,0.05)]">
              <span className="relative flex h-2 w-2">
                {loading ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </>
                ) : (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </>
                )}
              </span>
              <span className="text-[10px] font-black font-mono text-emerald-800 tracking-wide uppercase">
                {loading ? 'CONNECTING' : 'LIVE'}
              </span>
              <span className="text-[9px] text-zinc-400 font-mono pl-1 border-l border-emerald-200/50">
                Updated {timeSinceUpdate.toFixed(1)}s ago
              </span>
            </div>

            {/* Voltage Indicator */}
            <div className="flex items-center gap-1.5 bg-blue-50/50 border border-blue-200/60 px-2.5 py-1 rounded-full">
              <Zap className="h-3 w-3 text-blue-500" />
              <span className="text-[10px] font-black font-mono text-blue-700 tracking-wide">
                {voltage.toFixed(1)}V AC
              </span>
            </div>
          </div>
          
          <div className="text-right flex flex-col items-end">
            <span className="text-[10px] font-black text-zinc-450 uppercase tracking-widest font-mono flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-zinc-400" />
              {simulatedTime || '00:00:00 AM'}
            </span>
            <div className="text-[9px] text-zinc-400 font-mono mt-1">Real Office Time</div>
          </div>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
          
          {/* KPI 1: Current Power Load */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-[120px]">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest font-mono">
                Active Office Load
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                currentPower < 150 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                currentPower < 300 ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                'bg-rose-50 text-rose-700 border border-rose-100'
              }`}>
                {loadPercentage.toFixed(0)}% Capacity
              </span>
            </div>
            
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-3xl font-black font-mono tracking-tighter text-zinc-900 leading-none">
                {currentPower}
              </span>
              <span className="text-xs font-black text-zinc-400 font-mono">W</span>
              <span className="text-[10px] text-zinc-450 font-mono pl-2 flex items-center gap-0.5">
                {currentPower < 200 ? (
                  <>
                    <TrendingDown className="h-3 w-3 text-emerald-500 shrink-0" />
                    <span className="text-emerald-600">Optimal Draw</span>
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-3 w-3 text-amber-500 shrink-0" />
                    <span className="text-amber-600">Elevated Draw</span>
                  </>
                )}
              </span>
            </div>

            {/* Per-Room Horizontal Breakdown */}
            <div className="flex gap-4 mt-3 pt-3 border-t border-zinc-100 text-[9px] text-zinc-400 font-mono">
              <div className="flex-1">
                <div className="flex justify-between">
                  <span>DR</span>
                  <span className="font-bold text-zinc-700">{roomPower['drawing-room'] || 0}W</span>
                </div>
                <div className="w-full bg-zinc-100 h-1 rounded-full mt-1 overflow-hidden">
                  <div className="bg-zinc-800 h-full transition-all duration-500" style={{ width: `${Math.min(((roomPower['drawing-room'] || 0) / 165) * 100, 100)}%` }} />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <span>WR1</span>
                  <span className="font-bold text-zinc-700">{roomPower['work-room-1'] || 0}W</span>
                </div>
                <div className="w-full bg-zinc-100 h-1 rounded-full mt-1 overflow-hidden">
                  <div className="bg-zinc-800 h-full transition-all duration-500" style={{ width: `${Math.min(((roomPower['work-room-1'] || 0) / 165) * 100, 100)}%` }} />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <span>WR2</span>
                  <span className="font-bold text-zinc-700">{roomPower['work-room-2'] || 0}W</span>
                </div>
                <div className="w-full bg-zinc-100 h-1 rounded-full mt-1 overflow-hidden">
                  <div className="bg-zinc-800 h-full transition-all duration-500" style={{ width: `${Math.min(((roomPower['work-room-2'] || 0) / 165) * 100, 100)}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* KPI 2: Today's Consumption */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-[120px]">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest font-mono">
                Today's Energy
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono flex items-center gap-0.5 ${
                pctChange <= 0 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                  : 'bg-rose-50 text-rose-700 border border-rose-100'
              }`}>
                {pctChange >= 0 ? `+${pctChange.toFixed(1)}%` : `${pctChange.toFixed(1)}%`} vs. Yesterday
              </span>
            </div>
            
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-3xl font-black font-mono tracking-tighter text-zinc-900 leading-none">
                {dailyKWh}
              </span>
              <span className="text-xs font-black text-zinc-400 font-mono">kWh</span>
              <span className="text-[10px] text-zinc-400 font-mono pl-2">
                Yesterday: {yesterdayKWh} kWh
              </span>
            </div>

            <div className="flex justify-between items-center mt-3 pt-3 border-t border-zinc-100 text-[10px] text-zinc-500 font-mono">
              <span>Est. Cost (BDT)</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-800">৳{estCost.toFixed(2)}</span>
                <button
                  onClick={() => setShowBreakdown(true)}
                  className="text-[8px] font-bold text-indigo-600 hover:text-indigo-700 border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 rounded font-mono transition-colors flex items-center gap-0.5"
                >
                  <BarChart2 className="h-2.5 w-2.5" />
                  Breakdown
                </button>
              </div>
            </div>
          </div>

          {/* KPI 3: Devices ON/OFF */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-[120px]">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest font-mono">
                Active Devices
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono bg-zinc-50 text-zinc-500 border border-zinc-150">
                15 Devices Total
              </span>
            </div>
            
            <div className="flex items-baseline gap-3 mt-2">
              <div>
                <span className="text-3xl font-black font-mono tracking-tighter text-emerald-600 leading-none">
                  {totalOn}
                </span>
                <span className="text-xs font-bold text-emerald-500 font-mono ml-1">ON</span>
              </div>
              <div className="border-l border-zinc-200 h-6"></div>
              <div>
                <span className="text-3xl font-black font-mono tracking-tighter text-zinc-400 leading-none">
                  {totalOff}
                </span>
                <span className="text-xs font-bold text-zinc-400 font-mono ml-1">OFF</span>
              </div>
            </div>

            {/* Room-by-room active counts */}
            <div className="flex justify-between mt-3 pt-3 border-t border-zinc-100 text-[9px] text-zinc-400 font-mono">
              <div>
                DR: <span className="font-bold text-zinc-700">{devices.filter(d => d.room_id === 'drawing-room' && d.status).length}/5</span>
              </div>
              <div>
                WR1: <span className="font-bold text-zinc-700">{devices.filter(d => d.room_id === 'work-room-1' && d.status).length}/5</span>
              </div>
              <div>
                WR2: <span className="font-bold text-zinc-700">{devices.filter(d => d.room_id === 'work-room-2' && d.status).length}/5</span>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Row: Map & Detail Controls */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Frameless Office Map (Floating Blueprint Layout, No surrounding borders/backgrounds) */}
          <div className="lg:col-span-8 flex flex-col min-h-0 justify-center items-center relative select-none">
            
            {/* Layout Blueprint Image Container */}
            <div 
              className="absolute inset-0 m-auto w-auto h-auto max-w-full max-h-full select-none" 
              style={{ aspectRatio: '1536/1024' }}
            >
              
              {/* Floor Plan Background Image - Original Blueprint */}
              <img 
                src="/room%20assets/house%20layout%20without%20light%20and%20fan.png" 
                alt="Office Layout Background" 
                className="w-full h-full opacity-95 select-none"
              />

              {/* Room Hover Triggers */}
              {/* Drawing Room Trigger */}
              <div 
                className="absolute border border-transparent hover:border-zinc-350/20 hover:bg-zinc-800/[0.01] transition-all duration-300 rounded-2xl cursor-pointer z-30"
                style={{ left: '4%', top: '10%', width: '28%', height: '62%' }}
                onMouseEnter={() => setHoveredRoomId('drawing-room')}
                onMouseLeave={() => setHoveredRoomId(null)}
              />
              {/* Work Room 1 Trigger */}
              <div 
                className="absolute border border-transparent hover:border-zinc-350/20 hover:bg-zinc-800/[0.01] transition-all duration-300 rounded-2xl cursor-pointer z-30"
                style={{ left: '33%', top: '10%', width: '30%', height: '62%' }}
                onMouseEnter={() => setHoveredRoomId('work-room-1')}
                onMouseLeave={() => setHoveredRoomId(null)}
              />
              {/* Work Room 2 Trigger */}
              <div 
                className="absolute border border-transparent hover:border-zinc-350/20 hover:bg-zinc-800/[0.01] transition-all duration-300 rounded-2xl cursor-pointer z-30"
                style={{ left: '64%', top: '10%', width: '32%', height: '62%' }}
                onMouseEnter={() => setHoveredRoomId('work-room-2')}
                onMouseLeave={() => setHoveredRoomId(null)}
              />

              {/* Dynamic Devices Overlay */}
              {devices.map((device) => {
                const coords = coordinatesMap[device.id];
                if (!coords) return null;

                const isFan = device.type === 'fan';
                const isActive = device.status;
                const isHovered = hoveredDeviceId === device.id;

                const widthPercent = isFan ? '6.51%' : '3.91%';

                return (
                  <div
                    key={device.id}
                    className="absolute pointer-events-none"
                    style={{
                      left: coords.left,
                      top: coords.top,
                      width: widthPercent,
                      aspectRatio: '1/1',
                      transform: 'translate(-50%, -50%)',
                      zIndex: isHovered ? 40 : 25,
                    }}
                  >
                    <div className="relative w-full h-full">
                      {/* Device Icon PNGs */}
                      {isFan ? (
                        <img 
                          src="/room%20assets/fan.png"
                          alt={device.name}
                          className={`w-full h-full object-contain select-none mix-blend-screen transition-all duration-300 ${
                            isActive ? 'animate-[spin_0.8s_linear_infinite] drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]' : 'opacity-70'
                          }`}
                          style={{
                            transformOrigin: '49.84% 51.36%',
                          }}
                        />
                      ) : (
                        <img 
                          src={isActive ? '/room%20assets/light%20on.png' : '/room%20assets/light%20off.png'}
                          alt={device.name}
                          className={`w-full h-full object-contain select-none transition-all duration-300 ${
                            isActive ? 'drop-shadow-[0_0_14px_rgba(250,204,21,0.8)] scale-105' : 'opacity-70'
                          }`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Room Hover Tooltips */}
              {hoveredRoomId && (
                <div 
                  className="absolute bg-white/95 border border-zinc-200/80 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl pointer-events-none w-56 z-50 text-zinc-900 transition-all duration-200"
                  style={{
                    left: hoveredRoomId === 'drawing-room' ? '18%' : hoveredRoomId === 'work-room-1' ? '48%' : '80%',
                    top: '8%',
                    transform: 'translateX(-50%)',
                  }}
                >
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[9px] font-extrabold text-zinc-400 font-mono tracking-wider uppercase">
                      {hoveredRoomId === 'drawing-room' ? 'DR' : hoveredRoomId === 'work-room-1' ? 'WR 1' : 'WR 2'}
                    </span>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded font-mono ${
                      alerts.some(a => a.room_id === hoveredRoomId && a.active)
                        ? 'bg-rose-50 text-rose-600 border border-rose-100'
                        : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    }`}>
                      {alerts.some(a => a.room_id === hoveredRoomId && a.active) ? 'ALERT' : 'HEALTHY'}
                    </span>
                  </div>
                  
                  <h4 className="text-xs font-black text-zinc-800 tracking-tight leading-none mb-1">
                    {roomNames[hoveredRoomId]}
                  </h4>
                  
                  <div className="border-t border-zinc-100 my-2"></div>
                  
                  <div className="flex justify-between text-[10px] text-zinc-500 font-mono mb-1">
                    <span>Power Draw:</span>
                    <span className="text-zinc-850 font-bold">{roomPower[hoveredRoomId] || 0} W</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500 font-mono mb-1">
                    <span>Devices ON:</span>
                    <span className="text-zinc-850 font-bold">
                      {devices.filter(d => d.room_id === hoveredRoomId && d.status).length} / {devices.filter(d => d.room_id === hoveredRoomId).length}
                    </span>
                  </div>
                  
                  {alerts.filter(a => a.room_id === hoveredRoomId && a.active).map(a => (
                    <div key={a.id} className="mt-2 text-[9px] text-rose-600 font-mono border-t border-rose-100 pt-1.5 flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                      <span className="leading-tight">{a.message}</span>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>

          {/* Right Column: Active Alerts + Room Control Panel */}
          <div className="lg:col-span-4 flex flex-col gap-4 min-h-0">
            
            {/* Active Alerts Card — fixed height, always-visible ← → arrows */}
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-sm shrink-0 h-[110px] flex flex-col justify-between">

              {/* Top row: title + counter + arrows */}
              <div className="flex items-center justify-between">
                {alerts.length === 0 ? (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-[10px] font-black text-zinc-700 uppercase tracking-widest font-mono">
                      Office Healthy
                    </span>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                    <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest font-mono">
                      Active Alert
                    </span>
                  </div>
                )}

                {/* ← counter → always visible */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setAlertIndex((i) => Math.max(0, i - 1))}
                    disabled={alertIndex === 0 || alerts.length === 0}
                    className="p-0.5 rounded hover:bg-zinc-100 disabled:opacity-25 transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 text-zinc-500" />
                  </button>
                  <span className="text-[9px] font-mono text-zinc-400 w-8 text-center">
                    {alerts.length === 0 ? '0 / 0' : `${alertIndex + 1} / ${alerts.length}`}
                  </span>
                  <button
                    onClick={() => setAlertIndex((i) => Math.min(alerts.length - 1, i + 1))}
                    disabled={alertIndex >= alerts.length - 1 || alerts.length === 0}
                    className="p-0.5 rounded hover:bg-zinc-100 disabled:opacity-25 transition-colors"
                  >
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
                  </button>
                </div>
              </div>

              {/* Body: alert content or healthy message */}
              <div className="flex-1 flex items-center mt-2">
                {alerts.length === 0 ? (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-400 font-medium">No active alerts</span>
                    <span className="text-[9px] text-zinc-400 font-mono mt-0.5">All systems nominal</span>
                  </div>
                ) : alerts[alertIndex] ? (
                  <div className="w-full bg-rose-50/40 border border-rose-100 px-2.5 py-2 rounded-xl flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="mt-0.5 text-rose-600 bg-rose-100/50 p-1 rounded shrink-0 border border-rose-200/50">
                        <AlertTriangle className="h-3 w-3" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold text-rose-800 leading-none">
                          {alerts[alertIndex].room_id === 'drawing-room'
                            ? 'Drawing Room'
                            : alerts[alertIndex].room_id === 'work-room-1'
                            ? 'Work Room 1'
                            : 'Work Room 2'}
                        </span>
                        <p className="text-[9px] text-rose-700 leading-normal mt-0.5 font-medium truncate max-w-[260px]">
                          {alerts[alertIndex].message}
                        </p>
                      </div>
                    </div>
                    <span className="text-[8px] font-extrabold text-rose-500 font-mono shrink-0 whitespace-nowrap pt-0.5">
                      {formatTime(alerts[alertIndex].triggered_at)}
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Dot indicators at bottom */}
              {alerts.length > 1 && (
                <div className="flex justify-center gap-1 pt-1.5">
                  {alerts.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setAlertIndex(i)}
                      className={`h-1 rounded-full transition-all duration-200 ${
                        i === alertIndex ? 'w-3 bg-rose-500' : 'w-1 bg-rose-200 hover:bg-rose-300'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>


            {/* Devices & Controls Card (Wraps segmented tab and scrollable room list) */}
            <div className="flex-1 bg-white border border-zinc-200/80 rounded-2xl p-4 flex flex-col min-h-0 shadow-sm">

              {/* Card header: title + breakdown button */}
              <div className="flex items-center justify-between mb-2 shrink-0">
                <span className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-widest font-mono">Device Controls</span>
                <button
                  onClick={() => setShowBreakdown(true)}
                  className="flex items-center gap-1 text-[8px] font-bold text-indigo-600 hover:text-indigo-700 border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 rounded font-mono transition-colors"
                >
                  <BarChart2 className="h-2.5 w-2.5" />
                  Energy Breakdown
                </button>
              </div>

              {/* Segmented Tab Controls */}
              <div className="bg-zinc-100/80 border border-zinc-200/40 p-1 rounded-xl flex gap-1 w-full shrink-0">
                {[
                  { id: 'all', name: 'All Areas' },
                  { id: 'drawing-room', name: 'Drawing' },
                  { id: 'work-room-1', name: 'Work 1' },
                  { id: 'work-room-2', name: 'Work 2' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 text-[9px] font-black font-mono py-1.5 rounded-lg transition-all text-center leading-none ${
                      activeTab === tab.id
                        ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200/30 font-black'
                        : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/30 border border-transparent'
                    }`}
                  >
                    {tab.name}
                  </button>
                ))}
              </div>

              {/* Scrollable list of Rooms & Recent Activity inside the card */}
              <div className="flex-1 min-h-0 overflow-y-auto mt-4 pr-1 flex flex-col gap-4">
                
                {/* Rooms List */}
                <div className="flex flex-col gap-4">
                  {[
                    { id: 'drawing-room', name: 'Drawing Room' },
                    { id: 'work-room-1', name: 'Work Room 1' },
                    { id: 'work-room-2', name: 'Work Room 2' },
                  ]
                    .filter((room) => activeTab === 'all' || activeTab === room.id)
                    .map((room) => {
                      const roomDevices = devices.filter((d) => d.room_id === room.id);
                      const roomPowerSum = roomDevices.reduce((sum, d) => sum + (d.status ? d.wattage : 0), 0);
                      const activeCount = roomDevices.filter(d => d.status).length;
                      const roomHasAlert = alerts.some(a => a.room_id === room.id && a.active);

                      const roomFans = roomDevices.filter(d => d.type === 'fan');
                      const roomLights = roomDevices.filter(d => d.type === 'light');

                      return (
                        <div 
                          key={room.id} 
                          className="bg-zinc-50/50 border border-zinc-200/40 rounded-xl p-3 flex flex-col gap-3"
                        >
                          {/* Room Header */}
                          <div className="flex justify-between items-start pb-2 border-b border-zinc-200/40">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <h3 className="text-xs font-black text-zinc-800 tracking-tight leading-none">
                                  {room.name}
                                </h3>
                                <span className={`h-1.5 w-1.5 rounded-full ${
                                  roomHasAlert 
                                    ? 'bg-rose-500 animate-pulse' 
                                    : activeCount > 0 
                                      ? 'bg-emerald-500' 
                                      : 'bg-zinc-300'
                                }`} />
                              </div>
                              <span className="text-[9px] text-zinc-400 font-mono mt-1 leading-none">
                                {activeCount} ON • {roomDevices.length - activeCount} OFF
                              </span>
                            </div>
                            
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-black font-mono text-zinc-900 leading-none">
                                {roomPowerSum} W
                              </span>
                              <span className="text-[8px] text-zinc-400 font-mono mt-1 leading-none">
                                Draw
                              </span>
                            </div>
                          </div>
                          
                          {/* Compact Device List */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                            {/* Fans Column */}
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[8px] font-extrabold text-zinc-400 uppercase tracking-widest font-mono mb-0.5">
                                Fans
                              </span>
                              {roomFans.map((device) => (
                                <div 
                                  key={device.id} 
                                  className="flex items-center justify-between text-xs py-0.5 group hover:bg-zinc-150/40 rounded px-1 -mx-1 transition-colors"
                                  onMouseEnter={() => setHoveredDeviceId(device.id)}
                                  onMouseLeave={() => setHoveredDeviceId(null)}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Fan className={`h-3 w-3 shrink-0 ${device.status ? 'text-emerald-500 animate-[spin_0.8s_linear_infinite]' : 'text-zinc-300'}`} />
                                    <span className={`truncate text-[10px] ${device.status ? 'font-semibold text-zinc-700' : 'text-zinc-500'}`}>{device.name}</span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {device.last_changed_at && (
                                      <span 
                                        title={new Date(device.last_changed_at).toLocaleString()}
                                        className="text-[8px] text-zinc-400 font-mono cursor-help"
                                      >
                                        {formatTime(device.last_changed_at)}
                                      </span>
                                    )}
                                    <span 
                                      title={device.last_changed_at ? new Date(device.last_changed_at).toLocaleString() : undefined}
                                      className={`text-[8px] font-bold px-1.5 py-0.5 rounded font-mono cursor-help ${
                                        device.status 
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/50' 
                                          : 'bg-zinc-100/55 text-zinc-400 border border-zinc-200/50'
                                      }`}
                                    >
                                      {device.status ? 'ON' : 'OFF'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            
                            {/* Lights Column */}
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[8px] font-extrabold text-zinc-400 uppercase tracking-widest font-mono mb-0.5">
                                Lights
                              </span>
                              {roomLights.map((device) => (
                                <div 
                                  key={device.id} 
                                  className="flex items-center justify-between text-xs py-0.5 group hover:bg-zinc-150/40 rounded px-1 -mx-1 transition-colors"
                                  onMouseEnter={() => setHoveredDeviceId(device.id)}
                                  onMouseLeave={() => setHoveredDeviceId(null)}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Lightbulb className={`h-3 w-3 shrink-0 ${device.status ? 'text-amber-500' : 'text-zinc-300'}`} />
                                    <span className={`truncate text-[10px] ${device.status ? 'font-semibold text-zinc-700' : 'text-zinc-500'}`}>{device.name}</span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {device.last_changed_at && (
                                      <span 
                                        title={new Date(device.last_changed_at).toLocaleString()}
                                        className="text-[8px] text-zinc-400 font-mono cursor-help"
                                      >
                                        {formatTime(device.last_changed_at)}
                                      </span>
                                    )}
                                    <span 
                                      title={device.last_changed_at ? new Date(device.last_changed_at).toLocaleString() : undefined}
                                      className={`text-[8px] font-bold px-1.5 py-0.5 rounded font-mono cursor-help ${
                                        device.status 
                                          ? 'bg-amber-50 text-amber-700 border border-amber-100/50' 
                                          : 'bg-zinc-100/55 text-zinc-400 border border-zinc-200/50'
                                      }`}
                                    >
                                      {device.status ? 'ON' : 'OFF'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                      {/* Recent Activity Card */}
                <div className="bg-zinc-50/50 border border-zinc-200/40 rounded-xl p-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-zinc-200/40 pb-2">
                    <h2 className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-zinc-400" />
                      RECENT ACTIVITY
                    </h2>
                  </div>
                  
                  <div className="flex flex-col gap-2.5 pr-0.5">
                    {deviceHistory.length === 0 ? (
                      <span className="text-[10px] text-zinc-400 font-mono text-center py-2">No device events recorded</span>
                    ) : (
                      deviceHistory.map((hist) => (
                        <div key={hist.id} className="flex items-center justify-between py-1 border-b border-zinc-200/10 last:border-0 last:pb-0 pb-2 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {/* Green dot for active status, hidden/transparent for inactive */}
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${hist.new_status ? 'bg-emerald-500' : 'bg-transparent'}`} />
                            <div className="flex flex-col min-w-0">
                              <span className="text-[11px] font-black text-zinc-800 leading-tight truncate">
                                {hist.devices?.name || 'Device'}
                              </span>
                              <span className="text-[9px] text-zinc-400 font-semibold mt-0.5 leading-none">
                                {roomNames[hist.devices?.room_id] || hist.devices?.room_id || 'Unknown Room'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0">
                            <span 
                              title={hist.changed_at ? new Date(hist.changed_at).toLocaleString() : undefined}
                              className={`text-[8px] font-bold px-1.5 py-0.5 rounded font-mono cursor-help ${
                                hist.new_status 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/50' 
                                  : 'bg-zinc-100/55 text-zinc-450 border border-zinc-200/50'
                              }`}
                            >
                              {hist.new_status ? 'ON' : 'OFF'}
                            </span>
                            <span 
                              title={hist.changed_at ? new Date(hist.changed_at).toLocaleString() : undefined}
                              className="text-[10px] text-zinc-500 font-medium whitespace-nowrap cursor-help"
                            >
                              {formatTime(hist.changed_at)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>            </div>

              </div>
            </div>

          </div>
        </div>
      </main>

      {/* ── Energy Breakdown Modal ─────────────────────────────────── */}
      {showBreakdown && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowBreakdown(false)}
        >
          {/* 
            KEY FIX: use an explicit height so the inner flex-col has a bounded container.
            max-h alone doesn't give flex children a height reference in a fixed overlay.
          */}
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col border border-zinc-200/80"
            style={{ height: 'min(82vh, 680px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 shrink-0">
              <div>
                <h2 className="text-[13px] font-black text-zinc-900 font-mono uppercase tracking-widest flex items-center gap-2">
                  <BarChart2 className="h-3.5 w-3.5 text-indigo-500" />
                  Energy Breakdown
                </h2>
                <p className="text-[9px] text-zinc-400 font-mono mt-0.5">
                  {"Today's consumption · \u09F313.01 / kWh · Realtime"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBreakdown(false)}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* ── Totals strip ── */}
            {breakdownData && (
              <div className="grid grid-cols-3 divide-x divide-zinc-100 bg-zinc-50/60 border-b border-zinc-100 shrink-0">
                <div className="px-5 py-3">
                  <div className="text-[8px] text-zinc-400 font-mono uppercase tracking-widest mb-1">Total kWh Today</div>
                  <div className="text-[22px] font-black font-mono text-zinc-900 leading-none tabular-nums">
                    {breakdownData.totalKWh?.toFixed(4)}
                  </div>
                </div>
                <div className="px-5 py-3">
                  <div className="text-[8px] text-zinc-400 font-mono uppercase tracking-widest mb-1">Total Cost</div>
                  <div className="text-[22px] font-black font-mono text-indigo-700 leading-none tabular-nums">
                    <span className="text-base mr-0.5">{'\u09F3'}</span>{breakdownData.totalCostBDT?.toFixed(2)}
                  </div>
                </div>
                <div className="px-5 py-3">
                  <div className="text-[8px] text-zinc-400 font-mono uppercase tracking-widest mb-1">Sim Time</div>
                  <div className="text-[13px] font-black font-mono text-zinc-700 leading-none tabular-nums mt-1">
                    {breakdownData.simulatedTime
                      ? new Date(breakdownData.simulatedTime).toLocaleTimeString([], {
                          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
                        })
                      : '--:--:--'}
                  </div>
                  <div className="text-[8px] text-zinc-400 font-mono mt-1">Office Clock</div>
                </div>
              </div>
            )}

            {/* ── Scrollable room list (flex-1 now has a bounded parent height) ── */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {!breakdownData && (
                <div className="flex items-center justify-center h-full text-zinc-400 text-xs font-mono">
                  Loading…
                </div>
              )}

              {breakdownData?.rooms?.map((room: {
                roomId: string; roomName: string; kwh: number; costBDT: number;
                devices: { id: string; name: string; type: string; status: boolean; kwh: number; costBDT: number }[];
              }) => {
                const sharePercent = breakdownData.totalKWh > 0
                  ? Math.round((room.kwh / breakdownData.totalKWh) * 100)
                  : 0;
                const onCount = room.devices.filter((d: { status: boolean }) => d.status).length;

                return (
                  <div key={room.roomId} className="border-b border-zinc-100 last:border-0">
                    {/* Room header row */}
                    <div className="flex items-center justify-between px-5 py-2.5 bg-zinc-50/80 sticky top-0 z-10 border-b border-zinc-100">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-zinc-800 uppercase tracking-widest font-mono leading-none">
                            {room.roomName}
                          </span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`h-1.5 w-1.5 rounded-full ${onCount > 0 ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                            <span className="text-[8px] font-mono text-zinc-400">
                              {onCount}/{room.devices.length} ON
                            </span>
                          </div>
                        </div>
                        {/* Share bar */}
                        <div className="flex items-center gap-1.5 ml-2">
                          <div className="w-20 h-1 bg-zinc-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-400 rounded-full transition-all duration-500"
                              style={{ width: `${sharePercent}%` }}
                            />
                          </div>
                          <span className="text-[8px] font-mono text-zinc-400">{sharePercent}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-mono text-zinc-400 tabular-nums">{room.kwh.toFixed(4)} kWh</span>
                        <span className="text-[10px] font-black font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg tabular-nums">
                          {'\u09F3'}{room.costBDT.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Device rows */}
                    {room.devices.map((device, idx) => (
                      <div
                        key={device.id}
                        className={`flex items-center justify-between px-5 py-2.5 transition-colors hover:bg-indigo-50/30 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30'
                        }`}
                      >
                        {/* Left: icon + name + status badge */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`p-1 rounded-md shrink-0 ${
                            device.status
                              ? device.type === 'fan' ? 'bg-emerald-50' : 'bg-amber-50'
                              : 'bg-zinc-100'
                          }`}>
                            {device.type === 'fan' ? (
                              <Fan className={`h-3 w-3 ${device.status ? 'text-emerald-500 animate-[spin_1.5s_linear_infinite]' : 'text-zinc-300'}`} />
                            ) : (
                              <Lightbulb className={`h-3 w-3 ${device.status ? 'text-amber-500' : 'text-zinc-300'}`} />
                            )}
                          </div>
                          <span className={`text-[10px] font-semibold truncate ${device.status ? 'text-zinc-700' : 'text-zinc-400'}`}>
                            {device.name}
                          </span>
                          <span className={`shrink-0 text-[7px] font-black px-1.5 py-0.5 rounded font-mono tracking-wide ${
                            device.status
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : 'bg-zinc-100 text-zinc-400 border border-zinc-200'
                          }`}>
                            {device.status ? 'ON' : 'OFF'}
                          </span>
                        </div>
                        {/* Right: kWh + cost */}
                        <div className="flex items-center gap-5 shrink-0">
                          <span className="text-[9px] font-mono text-zinc-400 tabular-nums w-24 text-right">
                            {device.kwh.toFixed(4)} kWh
                          </span>
                          <span className="text-[10px] font-black font-mono text-zinc-700 tabular-nums w-16 text-right">
                            {'\u09F3'}{device.costBDT.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* ── Sticky footer ── */}
            {breakdownData && (
              <div className="flex items-center justify-between px-5 py-2.5 border-t border-zinc-100 bg-zinc-50/60 shrink-0">
                <span className="text-[8px] text-zinc-400 font-mono uppercase tracking-widest">
                  {'\u09F3'}13.01 per kWh · BDT · Chrono Office
                </span>
                <div className="flex items-center gap-1 text-[8px] font-mono text-zinc-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Auto-refreshing every 3s
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>

  );
}
