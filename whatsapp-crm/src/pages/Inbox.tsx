import { useEffect, useState, useRef } from 'react';
import { Search, Send, Check, Sparkles, MessageCircle } from 'lucide-react';
import { inboxApi } from '../services/api';
import { Conversation, ConversationMessage } from '../types';

export default function Inbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [suggestion, setSuggestion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.phone);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversations = async () => {
    try {
      const res = await inboxApi.list({ limit: 50 });
      setConversations(res.conversations);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (phone: string) => {
    try {
      const res = await inboxApi.getConversation(phone);
      setMessages(res.messages);
      
      // Check for suggestion on last inbound message
      const lastInbound = res.messages
        .filter(m => m.direction === 'inbound')
        .pop();
      
      if (lastInbound) {
        const suggestRes = await inboxApi.suggest(lastInbound.content);
        setSuggestion(suggestRes.has_match ? suggestRes.suggestion : null);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSendReply = async () => {
    if (!selectedConversation || !replyText.trim()) return;

    try {
      await inboxApi.reply(selectedConversation.phone, replyText);
      setReplyText('');
      loadMessages(selectedConversation.phone);
      loadConversations();
    } catch (error) {
      console.error('Failed to send reply:', error);
      alert('Failed to send reply');
    }
  };

  const handleUseSuggestion = () => {
    if (suggestion) {
      setReplyText(suggestion.faq.answer);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const filteredConversations = conversations.filter(conv =>
    conv.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.phone.includes(searchQuery)
  );

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
            <p className="text-gray-600 mt-1">
              {conversations.reduce((sum, c) => sum + c.unread_count, 0)} unread messages
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation List */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          {/* Search */}
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-auto chat-scrollbar">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No conversations yet</p>
              </div>
            ) : (
              filteredConversations.map(conv => (
                <button
                  key={conv.phone}
                  onClick={() => setSelectedConversation(conv)}
                  className={`w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedConversation?.phone === conv.phone ? 'bg-green-50 border-l-4 border-l-whatsapp-green' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-medium text-gray-900 truncate">
                      {conv.business_name || conv.phone}
                    </h3>
                    {conv.unread_count > 0 && (
                      <span className="bg-whatsapp-green text-white text-xs px-2 py-0.5 rounded-full">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">{conv.last_message.content}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(conv.last_message.created_at).toLocaleTimeString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-whatsapp-green rounded-full flex items-center justify-center text-white font-semibold">
                    {(selectedConversation.business_name || selectedConversation.phone).charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {selectedConversation.business_name || selectedConversation.phone}
                    </h3>
                    <p className="text-sm text-gray-500">{selectedConversation.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {messages.filter(m => m.direction === 'outbound').length} sent
                  </span>
                  <span className="text-xs text-gray-500">
                    {messages.filter(m => m.direction === 'inbound').length} received
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-auto chat-scrollbar p-4 space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-md p-3 rounded-lg ${
                        msg.direction === 'outbound'
                          ? 'bg-green-100 text-gray-900 message-bubble-out'
                          : 'bg-white text-gray-900 message-bubble-in'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </span>
                        {msg.direction === 'outbound' && (
                          <Check className="w-3 h-3 text-gray-400" />
                        )}
                        {msg.is_auto_reply && (
                          <span className="text-xs text-blue-500">Auto</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggestion Banner */}
              {suggestion && (
                <div className="px-4 py-2 bg-blue-50 border-t border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-500" />
                      <span className="text-sm text-blue-700">
                        Suggested reply: "{suggestion.faq.answer.substring(0, 50)}..."
                      </span>
                    </div>
                    <button
                      onClick={handleUseSuggestion}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Use suggestion
                    </button>
                  </div>
                </div>
              )}

              {/* Reply Input */}
              <div className="p-4 bg-white border-t border-gray-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendReply()}
                    placeholder="Type your reply..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={!replyText.trim()}
                    className="px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 mx-auto mb-4" />
                <p>Select a conversation to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
