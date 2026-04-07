/**
 * Real-Time Message Pipeline Monitor
 * 
 * This script monitors the message pipeline in real-time,
 * tracking status changes and providing live updates.
 */

import { supabase } from '../server/services/supabase';

interface MessageStatus {
  id: string;
  business_name: string;
  phone: string;
  status: string;
  nabda_message_id?: string;
  error_message?: string;
  sent_at?: string;
  created_at: string;
  updated_at: string;
}

class PipelineMonitor {
  private isRunning = false;
  private lastStatusCheck: Map<string, string> = new Map();
  private statusCounts: Record<string, number> = {
    pending: 0,
    sent: 0,
    failed: 0,
    delivered: 0,
    read: 0
  };

  async startMonitoring(campaignId?: string, intervalMs: number = 5000) {
    if (this.isRunning) {
      console.log('Monitor is already running');
      return;
    }

    this.isRunning = true;
    console.log(`Starting pipeline monitoring${campaignId ? ` for campaign ${campaignId}` : ''}`);
    console.log(`Check interval: ${intervalMs}ms`);

    while (this.isRunning) {
      try {
        await this.checkMessageStatus(campaignId);
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      } catch (error) {
        console.error('Monitoring error:', error);
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
  }

  stopMonitoring() {
    this.isRunning = false;
    console.log('Pipeline monitoring stopped');
  }

  private async checkMessageStatus(campaignId?: string) {
    let query = supabase
      .from('messages')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(20);

    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    if (!messages || messages.length === 0) {
      if (this.lastStatusCheck.size > 0) {
        console.log('No messages found');
        this.lastStatusCheck.clear();
      }
      return;
    }

    // Check for status changes
    const changes: Array<{id: string, business_name: string, oldStatus: string, newStatus: string, timestamp: string}> = [];
    
    messages.forEach((message: MessageStatus) => {
      const lastStatus = this.lastStatusCheck.get(message.id);
      
      if (lastStatus !== message.status) {
        changes.push({
          id: message.id,
          business_name: message.business_name,
          oldStatus: lastStatus || 'unknown',
          newStatus: message.status,
          timestamp: message.updated_at
        });
        
        this.lastStatusCheck.set(message.id, message.status);
      }
    });

    // Update status counts
    const newCounts = messages.reduce((acc, msg) => {
      acc[msg.status] = (acc[msg.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Check if counts changed
    const countsChanged = Object.keys(newCounts).some(status => 
      newCounts[status] !== this.statusCounts[status]
    );

    if (countsChanged) {
      const oldCounts = { ...this.statusCounts };
      this.statusCounts = newCounts;
      
      console.log(`\n=== Status Update ===`);
      console.log(`Timestamp: ${new Date().toISOString()}`);
      
      Object.keys(newCounts).forEach(status => {
        const oldCount = oldCounts[status] || 0;
        const newCount = newCounts[status];
        const change = newCount - oldCount;
        
        if (change !== 0) {
          const direction = change > 0 ? '+' : '';
          console.log(`${status.toUpperCase()}: ${newCount} (${direction}${change})`);
        }
      });
    }

    // Log status changes
    changes.forEach(change => {
      const icon = this.getStatusIcon(change.newStatus);
      console.log(`${icon} ${change.business_name}: ${change.oldStatus} -> ${change.newStatus} (${change.timestamp})`);
      
      if (change.newStatus === 'sent') {
        console.log(`   Nabda ID: ${messages.find(m => m.id === change.id)?.nabda_message_id}`);
      }
      
      if (change.newStatus === 'failed') {
        const errorMsg = messages.find(m => m.id === change.id)?.error_message;
        console.log(`   Error: ${errorMsg}`);
      }
    });

    // Show recent activity summary
    if (changes.length > 0) {
      console.log(`Recent activity: ${changes.length} status changes`);
      console.log(`Current queue: ${this.statusCounts.pending} pending, ${this.statusCounts.sent} sent, ${this.statusCounts.failed} failed`);
    }
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'pending': return '   ';
      case 'sent': return '   ';
      case 'failed': return '   ';
      case 'delivered': return '   ';
      case 'read': return '   ';
      default: return '   ';
    }
  }

  async getStatusSummary(campaignId?: string) {
    let query = supabase
      .from('messages')
      .select('status', { count: 'exact' });

    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }

    const { count, error } = await query;

    if (error) {
      console.error('Error getting status summary:', error);
      return null;
    }

    return count;
  }

  async getRecentActivity(limit: number = 10) {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error getting recent activity:', error);
      return [];
    }

    return messages as MessageStatus[];
  }
}

// CLI interface for manual monitoring
async function runInteractiveMonitor() {
  const monitor = new PipelineMonitor();
  
  console.log('CRM Pipeline Monitor');
  console.log('==================');
  console.log('Commands:');
  console.log('  start [campaign_id] - Start monitoring');
  console.log('  stop - Stop monitoring');
  console.log('  status [campaign_id] - Get status summary');
  console.log('  recent [limit] - Show recent activity');
  console.log('  quit - Exit');
  console.log('');

  // Simple CLI simulation (in real use, this would be a proper CLI interface)
  console.log('Starting automatic monitoring for 60 seconds...');
  
  // Start monitoring for 60 seconds
  monitor.startMonitoring(undefined, 3000);
  
  setTimeout(() => {
    monitor.stopMonitoring();
    console.log('\nMonitoring session completed');
    process.exit(0);
  }, 60000);
}

// Export for use in other scripts
export { PipelineMonitor };

// Run if called directly
if (require.main === module) {
  runInteractiveMonitor().catch(console.error);
}
