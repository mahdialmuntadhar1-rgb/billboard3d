import { useEffect, useState } from 'react';
import { MessageSquare, Send, Inbox, FileText, TrendingUp } from 'lucide-react';
import { campaignsApi, messagesApi, inboxApi, templatesApi } from '../services/api';

export default function Dashboard() {
  const [stats, setStats] = useState({
    campaigns: 0,
    templates: 0,
    messagesSent: 0,
    unreadMessages: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [campaignsRes, templatesRes, messagesRes, inboxRes] = await Promise.all([
        campaignsApi.list(),
        templatesApi.list(),
        messagesApi.getStatus(),
        inboxApi.getUnreadCount(),
      ]);

      setStats({
        campaigns: campaignsRes.campaigns.length,
        templates: templatesRes.templates.length,
        messagesSent: messagesRes.stats?.sent || 0,
        unreadMessages: inboxRes.unread || 0,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { 
      label: 'Total Campaigns', 
      value: stats.campaigns, 
      icon: MessageSquare, 
      color: 'bg-blue-500',
      link: '/campaigns'
    },
    { 
      label: 'Message Templates', 
      value: stats.templates, 
      icon: FileText, 
      color: 'bg-purple-500',
      link: '/templates'
    },
    { 
      label: 'Messages Sent', 
      value: stats.messagesSent, 
      icon: Send, 
      color: 'bg-green-500',
      link: '/queue'
    },
    { 
      label: 'Unread Messages', 
      value: stats.unreadMessages, 
      icon: Inbox, 
      color: stats.unreadMessages > 0 ? 'bg-red-500' : 'bg-gray-500',
      link: '/inbox'
    },
  ];

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of your WhatsApp CRM</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <a
              key={stat.label}
              href={stat.link}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.color} text-white p-3 rounded-lg`}>
                  <Icon className="w-6 h-6" />
                </div>
                <TrendingUp className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-gray-600 mt-1">{stat.label}</p>
            </a>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-4">
          <a
            href="/campaigns"
            className="inline-flex items-center gap-2 px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Create Campaign
          </a>
          <a
            href="/templates"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Manage Templates
          </a>
          <a
            href="/inbox"
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              stats.unreadMessages > 0 
                ? 'bg-red-600 text-white hover:bg-red-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Inbox className="w-4 h-4" />
            Check Inbox
            {stats.unreadMessages > 0 && (
              <span className="bg-white text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                {stats.unreadMessages}
              </span>
            )}
          </a>
        </div>
      </div>
    </div>
  );
}
