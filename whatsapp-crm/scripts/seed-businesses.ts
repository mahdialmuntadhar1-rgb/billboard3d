/**
 * Seed Businesses Data
 * 
 * This script creates sample businesses for testing the CRM system.
 * Run this script to populate the businesses table with realistic data.
 */

import { supabase } from '../server/services/supabase';

const SAMPLE_BUSINESSES = [
  {
    business_name: 'Al-Mansour Restaurant',
    phone_1: '+9647701234567',
    phone_2: '+9647501234567',
    whatsapp: '+9647701234567',
    governorate: 'Baghdad',
    city: 'Baghdad',
    category: 'Restaurant',
    status: 'approved'
  },
  {
    business_name: 'Tech Solutions Iraq',
    phone_1: '+9647707654321',
    phone_2: '+9647507654321',
    whatsapp: '+9647707654321',
    governorate: 'Baghdad',
    city: 'Baghdad',
    category: 'Technology',
    status: 'approved'
  },
  {
    business_name: 'Al-Rasheed Pharmacy',
    phone_1: '+9647709876543',
    phone_2: null,
    whatsapp: '+9647709876543',
    governorate: 'Baghdad',
    city: 'Baghdad',
    category: 'Healthcare',
    status: 'approved'
  },
  {
    business_name: 'Basra Electronics',
    phone_1: '+9647801112222',
    phone_2: '+9647501112222',
    whatsapp: '+9647801112222',
    governorate: 'Basra',
    city: 'Basra',
    category: 'Electronics',
    status: 'approved'
  },
  {
    business_name: 'Mosul General Hospital',
    phone_1: '+9647703334444',
    phone_2: '+9647503334444',
    whatsapp: '+9647703334444',
    governorate: 'Nineveh',
    city: 'Mosul',
    category: 'Healthcare',
    status: 'approved'
  },
  {
    business_name: 'Erbil Construction Co',
    phone_1: '+9647505556666',
    phone_2: null,
    whatsapp: '+9647505556666',
    governorate: 'Erbil',
    city: 'Erbil',
    category: 'Construction',
    status: 'approved'
  },
  {
    business_name: 'Karbala Textiles',
    phone_1: '+9647807778888',
    phone_2: '+9647507778888',
    whatsapp: null,
    governorate: 'Karbala',
    city: 'Karbala',
    category: 'Textiles',
    status: 'approved'
  },
  {
    business_name: 'Najaf Auto Parts',
    phone_1: '+9647709990000',
    phone_2: null,
    whatsapp: '+9647709990000',
    governorate: 'Najaf',
    city: 'Najaf',
    category: 'Automotive',
    status: 'approved'
  },
  {
    business_name: 'Sulaymaniyah Cafe',
    phone_1: '+9647501113333',
    phone_2: '+9647801113333',
    whatsapp: '+9647501113333',
    governorate: 'Sulaymaniyah',
    city: 'Sulaymaniyah',
    category: 'Cafe',
    status: 'approved'
  },
  {
    business_name: 'Dhi Qar Agriculture',
    phone_1: '+9647702224444',
    phone_2: '+9647502224444',
    whatsapp: '+9647702224444',
    governorate: 'Dhi Qar',
    city: 'Nasiriyah',
    category: 'Agriculture',
    status: 'approved'
  },
  {
    business_name: 'Babil Software Solutions',
    phone_1: '+9647803335555',
    phone_2: null,
    whatsapp: '+9647803335555',
    governorate: 'Babil',
    city: 'Hilla',
    category: 'Technology',
    status: 'approved'
  },
  {
    business_name: 'Anbar Logistics',
    phone_1: '+9647504446666',
    phone_2: '+9647704446666',
    whatsapp: '+9647504446666',
    governorate: 'Anbar',
    city: 'Ramadi',
    category: 'Logistics',
    status: 'approved'
  },
  {
    business_name: 'Maysan Oil Services',
    phone_1: '+9647705557777',
    phone_2: '+9647505557777',
    whatsapp: '+9647705557777',
    governorate: 'Maysan',
    city: 'Amarah',
    category: 'Oil & Gas',
    status: 'approved'
  },
  {
    business_name: 'Wasit Manufacturing',
    phone_1: '+9647806668888',
    phone_2: null,
    whatsapp: '+9647806668888',
    governorate: 'Wasit',
    city: 'Kut',
    category: 'Manufacturing',
    status: 'approved'
  },
  {
    business_name: 'Diyala Retail Store',
    phone_1: '+9647507779999',
    phone_2: '+9647707779999',
    whatsapp: '+9647507779999',
    governorate: 'Diyala',
    city: 'Ba'quba',
    category: 'Retail',
    status: 'approved'
  },
  // Add some businesses without valid phones for testing
  {
    business_name: 'Invalid Phone Business',
    phone_1: '12345',
    phone_2: null,
    whatsapp: null,
    governorate: 'Baghdad',
    city: 'Baghdad',
    category: 'Other',
    status: 'approved'
  },
  {
    business_name: 'No Phone Business',
    phone_1: null,
    phone_2: null,
    whatsapp: null,
    governorate: 'Baghdad',
    city: 'Baghdad',
    category: 'Other',
    status: 'approved'
  }
];

async function seedBusinesses() {
  try {
    console.log('[seed] Starting to seed businesses...');

    // Check if businesses already exist
    const { count: existingCount } = await supabase
      .from('businesses')
      .select('*', { count: 'exact', head: true });

    if (existingCount && existingCount > 0) {
      console.log(`[seed] Found ${existingCount} existing businesses. Skipping seed.`);
      return;
    }

    console.log(`[seed] Inserting ${SAMPLE_BUSINESSES.length} sample businesses...`);

    const { data, error } = await supabase
      .from('businesses')
      .insert(SAMPLE_BUSINESSES)
      .select();

    if (error) {
      console.error('[seed] Error inserting businesses:', error);
      throw error;
    }

    console.log(`[seed] Successfully seeded ${data?.length || 0} businesses!`);

    // Verify the data
    const { count: finalCount } = await supabase
      .from('businesses')
      .select('*', { count: 'exact', head: true });

    console.log(`[seed] Total businesses in database: ${finalCount || 0}`);

    // Show phone validation stats
    const { data: allBusinesses } = await supabase
      .from('businesses')
      .select('phone_1, phone_2, whatsapp');

    let validPhones = 0;
    let invalidPhones = 0;

    for (const business of allBusinesses || []) {
      const hasPhone = business.phone_1 || business.phone_2 || business.whatsapp;
      if (hasPhone) {
        validPhones++;
      } else {
        invalidPhones++;
      }
    }

    console.log(`[seed] Phone validation stats: ${validPhones} with phones, ${invalidPhones} without phones`);

  } catch (error) {
    console.error('[seed] Seeding failed:', error);
    throw error;
  }
}

// Run the seeding function
seedBusinesses().catch(console.error);
