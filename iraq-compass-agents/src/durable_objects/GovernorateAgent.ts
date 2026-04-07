import { DurableObjectState } from '@cloudflare/workers-types';
import {
  AgentState,
  AgentStatus,
  PipelineStage,
  SourceType,
  AgentJob,
  CheckpointData,
} from '../types';
import { SupabaseClient } from '@supabase/supabase-js';
import { scrapeFromMultipleSources } from '../pipeline/scraper';
import { enrichRecords } from '../pipeline/enricher';
import { aiVerifyRecords } from '../pipeline/verifier';
import { deduplicateAgainstProduction, pushToProduction } from '../pipeline/deduplicator';

// ============================================
// GovernorateAgent Durable Object
// ============================================
// This runs ON CLOUDFLARE SERVERS, not in browser
// Persists even if laptop sleeps or browser closes

export class GovernorateAgent {
  private state: DurableObjectState;
  private agentState: AgentState;
  private supabase: SupabaseClient;
  private alarmIntervalMs: number = 60000; // 1 minute heartbeats
  private cycleIntervalMs: number = 86400000; // 24 hours between cycles

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.supabase = new SupabaseClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Initialize or restore agent state
    this.agentState = {
      agentId: '',
      governorate: '',
      categories: [],
      sources: [],
      status: 'IDLE',
      currentJobId: null,
      currentStage: null,
      processedRecordIds: [],
      totalRecords: 0,
      lastCheckpoint: null,
    };
  }

  // ============================================
  // Initialization & Recovery
  // ============================================

  async initialize(
    agentId: string,
    governorate: string,
    categories: string[],
    sources: SourceType[]
  ): Promise<void> {
    this.agentState.agentId = agentId;
    this.agentState.governorate = governorate;
    this.agentState.categories = categories;
    this.agentState.sources = sources;

    // Try to resume from last checkpoint
    await this.resumeFromCheckpoint();

    // Schedule first alarm for heartbeat
    await this.state.storage.setAlarm(Date.now() + this.alarmIntervalMs);
  }

  async resumeFromCheckpoint(): Promise<void> {
    try {
      // Fetch last checkpoint from Supabase
      const { data: lastCheckpoint, error } = await this.supabase
        .from('agent_checkpoints')
        .select('*')
        .eq('agent_id', this.agentState.agentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !lastCheckpoint) {
        console.log(`[Agent ${this.agentState.agentId}] No checkpoint found, starting fresh`);
        return;
      }

      // Restore processed record IDs
      this.agentState.processedRecordIds = lastCheckpoint.record_ids || [];
      this.agentState.lastCheckpoint = {
        stage: lastCheckpoint.checkpoint_type as PipelineStage,
        timestamp: new Date(lastCheckpoint.created_at).getTime(),
        recordIds: lastCheckpoint.record_ids || [],
      };

      // Determine next stage
      this.agentState.currentStage = this.getNextStage(lastCheckpoint.checkpoint_type);

      console.log(`[Agent ${this.agentState.agentId}] Resumed from checkpoint: ${lastCheckpoint.checkpoint_type}`);
      console.log(`[Agent ${this.agentState.agentId}] Will continue from stage: ${this.agentState.currentStage}`);

      // Update agent status in database
      await this.supabase
        .from('agents')
        .update({
          current_checkpoint: this.agentState.currentStage || 'IDLE',
          status: 'RUNNING',
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.agentState.agentId);

    } catch (err) {
      console.error(`[Agent ${this.agentState.agentId}] Error resuming from checkpoint:`, err);
      // Continue with fresh start
    }
  }

  private getNextStage(currentStage: string): PipelineStage | null {
    const stageOrder: PipelineStage[] = ['SCRAPED', 'ENRICHED', 'REVIEWED', 'CLEANED', 'READY_FOR_PUSH'];
    const currentIndex = stageOrder.indexOf(currentStage as PipelineStage);

    if (currentIndex === -1 || currentIndex === stageOrder.length - 1) {
      return null; // Completed all stages
    }

    return stageOrder[currentIndex + 1];
  }

  // ============================================
  // Main Agent Loop
  // ============================================

  async run(): Promise<void> {
    // Main agent loop - NEVER STOPS unless manually paused
    while (this.agentState.status !== 'PAUSED') {
      try {
        console.log(`[Agent ${this.agentState.agentId}] Starting processing cycle`);

        for (const category of this.agentState.categories) {
          for (const source of this.agentState.sources) {
            // Create a job for this category-source combination
            const jobId = await this.createJob(category, source);
            this.agentState.currentJobId = jobId;

            // Resume from checkpoint if needed
            if (this.agentState.currentStage && this.agentState.currentStage !== 'SCRAPED') {
              await this.resumeJobFromStage(jobId, this.agentState.currentStage);
            } else {
              // Start fresh with scraping
              await this.scrape(source, category, jobId);
              await this.createCheckpoint(jobId, 'SCRAPED');
            }

            // Continue with remaining stages
            if (!this.agentState.currentStage || this.agentState.currentStage === 'ENRICHED') {
              await this.enrich(jobId);
              await this.createCheckpoint(jobId, 'ENRICHED');
            }

            if (!this.agentState.currentStage || this.agentState.currentStage === 'REVIEWED') {
              await this.review(jobId);
              await this.createCheckpoint(jobId, 'REVIEWED');
            }

            if (!this.agentState.currentStage || this.agentState.currentStage === 'CLEANED') {
              await this.aiVerify(jobId);
              await this.createCheckpoint(jobId, 'CLEANED');
            }

            if (!this.agentState.currentStage || this.agentState.currentStage === 'READY_FOR_PUSH') {
              await this.deduplicate(jobId);
              await this.createCheckpoint(jobId, 'READY_FOR_PUSH');
            }

            // Push to production
            await this.push(jobId);

            // Mark job as completed
            await this.completeJob(jobId);

            // Clear checkpoint for this job
            this.agentState.currentStage = null;
            this.agentState.processedRecordIds = [];
          }
        }

        console.log(`[Agent ${this.agentState.agentId}] Cycle complete. Sleeping for 24 hours...`);

        // Update agent status
        await this.supabase
          .from('agents')
          .update({
            status: 'IDLE',
            current_checkpoint: 'IDLE',
            updated_at: new Date().toISOString(),
          })
          .eq('id', this.agentState.agentId);

        // Wait before next cycle (but check for pause command every minute)
        await this.sleepWithPauseCheck(this.cycleIntervalMs);

      } catch (error) {
        console.error(`[Agent ${this.agentState.agentId}] Error in run loop:`, error);

        // Update agent status to ERROR
        await this.supabase
          .from('agents')
          .update({
            status: 'ERROR',
            updated_at: new Date().toISOString(),
          })
          .eq('id', this.agentState.agentId);

        if (this.agentState.currentJobId) {
          await this.supabase
            .from('agent_jobs')
            .update({
              status: 'FAILED',
              error_message: error instanceof Error ? error.message : 'Unknown error',
              completed_at: new Date().toISOString(),
            })
            .eq('id', this.agentState.currentJobId);
        }

        // Wait before retry
        await this.sleepWithPauseCheck(300000); // 5 minutes
      }
    }
  }

  private async sleepWithPauseCheck(durationMs: number): Promise<void> {
    const checkInterval = 60000; // Check every minute
    const endTime = Date.now() + durationMs;

    while (Date.now() < endTime && this.agentState.status !== 'PAUSED') {
      await new Promise(resolve => setTimeout(resolve, checkInterval));

      // Update heartbeat
      await this.updateHeartbeat();
    }
  }

  private async updateHeartbeat(): Promise<void> {
    await this.supabase
      .from('agents')
      .update({
        last_heartbeat: new Date().toISOString(),
      })
      .eq('id', this.agentState.agentId);
  }

  // ============================================
  // Pipeline Stage Methods
  // ============================================

  private async scrape(source: SourceType, category: string, jobId: string): Promise<void> {
    console.log(`[Agent ${this.agentState.agentId}] Stage: SCRAPING - ${source} - ${category}`);

    // Update job status
    await this.supabase
      .from('agent_jobs')
      .update({
        status: 'RUNNING',
        started_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    // Perform scraping
    const count = await scrapeFromMultipleSources(
      this.supabase,
      this.agentState.governorate,
      category,
      source,
      jobId
    );

    // Update agent stats
    this.agentState.scrape_count = (this.agentState.scrape_count || 0) + count;
    this.agentState.totalRecords += count;

    await this.supabase
      .from('agents')
      .update({
        scrape_count: this.agentState.scrape_count,
        total_records: this.agentState.totalRecords,
      })
      .eq('id', this.agentState.agentId);

    await this.supabase
      .from('agent_jobs')
      .update({
        records_scraped: count,
        progress_pct: 20,
      })
      .eq('id', jobId);
  }

  private async enrich(jobId: string): Promise<void> {
    console.log(`[Agent ${this.agentState.agentId}] Stage: ENRICHING - ${jobId}`);

    await enrichRecords(this.supabase, jobId);

    const { data: enrichedCount } = await this.supabase
      .from('business_records_staging')
      .select('id', { count: 'exact' })
      .eq('job_id', jobId)
      .eq('pipeline_stage', 'ENRICHED');

    await this.supabase
      .from('agent_jobs')
      .update({
        records_enriched: enrichedCount || 0,
        progress_pct: 40,
      })
      .eq('id', jobId);
  }

  private async review(jobId: string): Promise<void> {
    console.log(`[Agent ${this.agentState.agentId}] Stage: REVIEWING - ${jobId}`);

    // Flag low-confidence records for human review
    const { data: needsReview } = await this.supabase
      .from('business_records_staging')
      .select('*')
      .eq('job_id', jobId)
      .eq('pipeline_stage', 'ENRICHED')
      .lt('confidence', 0.7);

    if (needsReview && needsReview.length > 0) {
      console.log(`[Agent ${this.agentState.agentId}] ${needsReview.length} records flagged for human review`);

      // Update records to review status
      await this.supabase
        .from('business_records_staging')
        .update({
          pipeline_stage: 'REVIEWED',
          review_status: 'PENDING',
        })
        .eq('job_id', jobId)
        .eq('pipeline_stage', 'ENRICHED')
        .lt('confidence', 0.7);
    }

    // Auto-approve high-confidence records
    await this.supabase
      .from('business_records_staging')
      .update({
        pipeline_stage: 'REVIEWED',
        review_status: 'APPROVED',
      })
      .eq('job_id', jobId)
      .eq('pipeline_stage', 'ENRICHED')
      .gte('confidence', 0.7);

    const { data: reviewedCount } = await this.supabase
      .from('business_records_staging')
      .select('id', { count: 'exact' })
      .eq('job_id', jobId)
      .eq('pipeline_stage', 'REVIEWED');

    await this.supabase
      .from('agent_jobs')
      .update({
        records_reviewed: reviewedCount || 0,
        progress_pct: 60,
      })
      .eq('id', jobId);
  }

  private async aiVerify(jobId: string): Promise<void> {
    console.log(`[Agent ${this.agentState.agentId}] Stage: AI VERIFYING - ${jobId}`);

    await aiVerifyRecords(this.supabase, jobId);

    const { data: verifiedCount } = await this.supabase
      .from('business_records_staging')
      .select('id', { count: 'exact' })
      .eq('job_id', jobId)
      .eq('pipeline_stage', 'CLEANED')
      .eq('ai_verified', true);

    await this.supabase
      .from('agent_jobs')
      .update({
        progress_pct: 80,
      })
      .eq('id', jobId);
  }

  private async deduplicate(jobId: string): Promise<void> {
    console.log(`[Agent ${this.agentState.agentId}] Stage: DEDUPLICATING - ${jobId}`);

    await deduplicateAgainstProduction(this.supabase, jobId);
  }

  private async push(jobId: string): Promise<void> {
    console.log(`[Agent ${this.agentState.agentId}] Stage: PUSHING - ${jobId}`);

    const result = await pushToProduction(this.supabase, jobId);

    // Update agent push count
    this.agentState.push_count = (this.agentState.push_count || 0) + result.recordsInserted;

    await this.supabase
      .from('agents')
      .update({
        push_count: this.agentState.push_count,
      })
      .eq('id', this.agentState.agentId);

    await this.supabase
      .from('agent_jobs')
      .update({
        records_pushed: result.recordsInserted,
        progress_pct: 100,
      })
      .eq('id', jobId);
  }

  // ============================================
  // Checkpoint System
  // ============================================

  private async createCheckpoint(jobId: string, stage: PipelineStage): Promise<void> {
    console.log(`[Agent ${this.agentState.agentId}] Creating checkpoint: ${stage}`);

    // Get processed record IDs for this stage
    const { data: records } = await this.supabase
      .from('business_records_staging')
      .select('id')
      .eq('job_id', jobId)
      .eq('pipeline_stage', stage);

    const recordIds = records?.map(r => r.id) || [];
    this.agentState.processedRecordIds = recordIds;

    const checkpointData: CheckpointData = {
      stage,
      recordIds,
      timestamp: Date.now(),
      jobState: {
        jobId,
        agentId: this.agentState.agentId,
        governorate: this.agentState.governorate,
        category: this.agentState.categories[0], // Current category
      },
    };

    // Save to Supabase
    await this.supabase.from('agent_checkpoints').upsert({
      agent_id: this.agentState.agentId,
      job_id: jobId,
      checkpoint_type: stage,
      record_ids: recordIds,
      checkpoint_data: checkpointData,
    }, {
      onConflict: 'job_id,checkpoint_type',
    });

    // Update agent current checkpoint
    await this.supabase
      .from('agents')
      .update({
        current_checkpoint: stage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', this.agentState.agentId);

    this.agentState.lastCheckpoint = {
      stage,
      timestamp: Date.now(),
      recordIds,
    };

    console.log(`[Agent ${this.agentState.agentId}] Checkpoint saved: ${stage} (${recordIds.length} records)`);
  }

  private async resumeJobFromStage(jobId: string, stage: PipelineStage): Promise<void> {
    console.log(`[Agent ${this.agentState.agentId}] Resuming job ${jobId} from stage: ${stage}`);

    // Get records from last checkpoint
    const { data: checkpoint } = await this.supabase
      .from('agent_checkpoints')
      .select('*')
      .eq('job_id', jobId)
      .eq('checkpoint_type', stage)
      .single();

    if (checkpoint) {
      this.agentState.processedRecordIds = checkpoint.record_ids || [];
      console.log(`[Agent ${this.agentState.agentId}] Loaded ${this.agentState.processedRecordIds.length} processed records`);
    }
  }

  // ============================================
  // Job Management
  // ============================================

  private async createJob(category: string, source: SourceType): Promise<string> {
    const jobId = `job-${this.agentState.agentId}-${Date.now()}`;

    const job: Partial<AgentJob> = {
      id: jobId,
      agent_id: this.agentState.agentId,
      governorate: this.agentState.governorate,
      category,
      source_type: source,
      status: 'PENDING',
      created_at: new Date().toISOString(),
    };

    await this.supabase.from('agent_jobs').insert(job);

    return jobId;
  }

  private async completeJob(jobId: string): Promise<void> {
    await this.supabase
      .from('agent_jobs')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }

  // ============================================
  // Control Methods
  // ============================================

  async pause(): Promise<void> {
    console.log(`[Agent ${this.agentState.agentId}] Pausing agent`);
    this.agentState.status = 'PAUSED';

    await this.supabase
      .from('agents')
      .update({
        status: 'PAUSED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', this.agentState.agentId);
  }

  async resume(): Promise<void> {
    console.log(`[Agent ${this.agentState.agentId}] Resuming agent`);
    this.agentState.status = 'RUNNING';

    await this.supabase
      .from('agents')
      .update({
        status: 'RUNNING',
        updated_at: new Date().toISOString(),
      })
      .eq('id', this.agentState.agentId);

    // Restart the run loop
    await this.run();
  }

  async getStatus(): Promise<AgentState> {
    return this.agentState;
  }

  // ============================================
  // Alarm Handler (for heartbeats)
  // ============================================

  async alarm(): Promise<void> {
    if (this.agentState.status === 'RUNNING') {
      await this.updateHeartbeat();
    }

    // Schedule next alarm
    await this.state.storage.setAlarm(Date.now() + this.alarmIntervalMs);
  }
}

// ============================================
// Environment Type
// ============================================

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  GOOGLE_MAPS_API_KEY?: string;
  AGENT_DO: DurableObjectNamespace<GovernorateAgent>;
}
