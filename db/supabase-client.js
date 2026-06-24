const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_KEY are required in .env');
}

// Use service role key for server-side DB operations (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseKey);

// Insert a single row into a table
async function insertRow(tableName, data) {
    const { data: result, error } = await supabase
        .from(tableName)
        .insert([data])
        .select();

    if (error) {
        console.error(`Supabase insert error on ${tableName}:`, error);
        throw error;
    }
    return result;
}

// Read all rows from a table
async function getAllRowsAsObjects(tableName) {
    const { data, error } = await supabase
        .from(tableName)
        .select('*');

    if (error) {
        console.error(`Supabase select error on ${tableName}:`, error);
        throw error;
    }
    return data || [];
}

module.exports = { supabase, insertRow, getAllRowsAsObjects };
