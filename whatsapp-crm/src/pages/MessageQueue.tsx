import { useEffect, useState, useCallback } from 'react';
import { Play, RotateCw, CheckCircle, XCircle, Clock, Send, AlertCircle } from 'lucide-react';
import { messagesApi, campaignsApi } from '../services/api';
import { Campaign } from '../types';

interface QueueStats {
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

export default function MessageQueue() {
  const [stats, setStats] = useState<QueueStats>({
    total: 0,
    pending: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
  });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, failed: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const addLog = (message: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev].slice(0, 50));
  };

  const loadData = useCallback(async () => {
    try {
      const [statusRes, campaignsRes] = await Promise.all([
        messagesApi.getStatus(),
        campaignsApi.list(),
      ]);
      
      setStats(statusRes.stats || {
        total: 0, pending: 0, sent: 0, delivered: 0, read: 0, failed: 0,
      });
      setCampaigns(campaignsRes.campaigns);
    } catch (error) {
      console.error('Failed to load queue data:', error);
      addLog('Error loading queue data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleSendBatch = async () => {
    if (isSending) return;
    
    setIsSending(true);
    setSendProgress({ sent: 0, failed: 0 });
    addLog('Starting message sending...');

    try {
      const campaignId = selectedCampaign || undefined;
      
      while (true) {
        const result = await messagesApi.send(5, campaignId);
        
        setSendProgress(prev => ({
          sent: prev.sent + result.sent,
          failed: prev.failed + result.failed,
        }));

        if (result.sent > 0) {
          addLog(`Sent ${result.sent} messages successfully`);
        }
        if (result.failed > 0) {
          addLog(`Failed to send ${result.failed} messages`);
        }

        // Stop if no more pending messages
        if (result.sent === 0 && result.failed === 0) {
          addLog('No more pending messages');
          break;
        }

        // Wait between batches (rate limiting)
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      addLog('Batch sending completed');
      loadData();
    } catch (error) {
      console.error('Failed to send messages:', error);
      addLog('Error during sending');
    } finally {
      setIsSending(false);
    }
  };

  const getProgressPercentage = () => {
    if (stats.total === 0) return 0;
    return Math.round(((stats.sent + stats.delivered + stats.read + stats.failed) / stats.total) * 100);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Message Queue</h1>
        <p className="text-gray-600 mt-1">Monitor and send queued messages</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard icon={Clock} label="Pending" value={stats.pending} color="text-yellow-600 bg-yellow-50" />
        <StatCard icon={Send} label="Sent" value={stats.sent} color="text-blue-600 bg-blue-50" />
        <StatCard icon={CheckCircle} label="Delivered" value={stats.delivered} color="text-green-600 bg-green-50" />
        <StatCard icon={CheckCircle} label="Read" value={stats.read} color="text-whatsapp-dark bg-green-50" />
        <StatCard icon={XCircle} label="Failed" value={stats.failed} color="text-red-600 bg-red-50" />
        <StatCard icon={RotateCw} label="Total" value={stats.total} color="text-gray-600 bg-gray-50" />
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="font-medium text-gray-700">Overall Progress</span>
          <span className="text-sm text-gray-500">{getProgressPercentage()}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className="bg-whatsapp-green h-3 rounded-full transition-all duration-500"
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>{stats.pending} pending</span>
          <span>{stats.total} total</span>
        </div>
      </div>

      {/* Send Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Send Controls</h2>
        
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
          >
            <option value="">All Campaigns</option>
            {campaigns.map(campaign => (
              <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
            ))}
          </select>

          <button
            onClick={handleSendBatch}
            disabled={isSending || stats.pending === 0}
            className="flex items-center gap-2 px-6 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Sending
              </>
            )}
          </button>

          {isSending && (
            <div className="text-sm text-gray-600">
              Sent: {sendProgress.sent} | Failed: {sendProgress.failed}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <AlertCircle className="w-4 h-4" />
          <span>Rate limit: ~15 messages/minute (4000ms delay between messages)</span>
        </div>
      </div>

      {/* Logs */}
      <div className="bg-gray-900 rounded-xl p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-white font-medium">Activity Log</h3>
          <button
            onClick={() => setLogs([])}
            className="text-xs text-gray-400 hover:text-white"
          >
            Clear
          </button>
        </div>
        <div className="h-64 overflow-auto chat-scrollbar font-mono text-sm">
          {logs.length === 0 ? (
            <p className="text-gray-500 italic">No activity yet...</p>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="text-gray-300 py-0.5 border-b border-gray-800">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number; 
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-600">{label}</p>
    </div>
  );
}
