const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration. Please check your .env file.');
}

// Use service role key for server operations (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Also provide anon client for public operations
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

// Job tracking functions
async function createJob(governorate, category) {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        governorate,
        category,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Create job error:', error);
    throw error;
  }
}

async function getRunningJobs() {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get running jobs error:', error);
    return [];
  }
}

async function updateJobStatus(jobId, status, progress = null, businessesFound = null, businessesSaved = null, errorMessage = null) {
  try {
    const updateData = { status };
    
    if (progress !== null) updateData.progress = progress;
    if (businessesFound !== null) updateData.businesses_found = businessesFound;
    if (businessesSaved !== null) updateData.businesses_saved = businessesSaved;
    if (errorMessage !== null) updateData.error_message = errorMessage;
    
    if (status === 'done' || status === 'failed') {
      updateData.completed_at = new Date().toISOString();
    }
    
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('id', jobId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Update job error:', error);
    throw error;
  }
}

async function saveStagingBusiness(business, jobId) {
  try {
    const { data, error } = await supabase
      .from('staging_businesses')
      .insert({
        job_id: jobId,
        name: business.name,
        category: business.category,
        city: business.city,
        phone: business.phone,
        governorate: business.governorate,
        requested_category: business.requestedCategory,
        confidence: business.confidence,
        status: 'validated'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Save staging business error:', error);
    throw error;
  }
}

async function markStagingBusinessDuplicate(stagingId) {
  try {
    const { data, error } = await supabase
      .from('staging_businesses')
      .update({ status: 'duplicate' })
      .eq('id', stagingId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Mark staging duplicate error:', error);
    throw error;
  }
}

async function promoteStagingToBusiness(stagingId) {
  try {
    // Get staging business
    const { data: staging, error: fetchError } = await supabase
      .from('staging_businesses')
      .select('*')
      .eq('id', stagingId)
      .single();

    if (fetchError) throw fetchError;

    // Insert into businesses table
    const { data: business, error: insertError } = await supabase
      .from('businesses')
      .insert({
        name: staging.name,
        category: staging.category,
        city: staging.city,
        phone: staging.phone,
        governorate: staging.governorate,
        requested_category: staging.requested_category,
        confidence: staging.confidence,
        job_id: staging.job_id,
        staging_id: staging.id
      })
      .select()
      .single();

    if (insertError) throw insertError;
    return business;
  } catch (error) {
    console.error('Promote staging to business error:', error);
    throw error;
  }
}

async function checkExistingBusinesses(name, phone) {
  try {
    let query = supabase.from('businesses').select('*');
    
    if (phone) {
      query = query.eq('phone', phone);
    } else {
      query = query.eq('name', name);
    }
    
    const { data, error } = await query.limit(1);
    
    if (error) {
      console.error('Database check error:', error);
      return false;
    }
    
    return data && data.length > 0;
  } catch (error) {
    console.error('Existing business check error:', error);
    return false;
  }
}

module.exports = {
  supabase,
  supabaseAnon,
  createJob,
  getRunningJobs,
  updateJobStatus,
  saveStagingBusiness,
  markStagingBusinessDuplicate,
  promoteStagingToBusiness,
  checkExistingBusinesses
};
