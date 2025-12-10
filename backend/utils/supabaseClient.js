// utils/supabaseClient.js
import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE; // NEVER expose on frontend
if (!supabaseKey) {
  throw new Error("Supabasekey variables missing");
}

if (!supabaseUrl ) {
  throw new Error("Supabaseurl  variables missing");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
