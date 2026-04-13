export const maxDuration = 60; // 🔥 Vercel Timeout Bypass (60 seconds)

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase Admin Client (Taaki ye system ka data padh sake)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Dhyan rahe, ye Service Role key hai, anon key nahi
);

export async function GET(req: Request) {
  // 🔒 1. ENTERPRISE SECURITY LOCK (With CTO Override)
  const url = new URL(req.url);
  const isManual = url.searchParams.get('manual') === 'true'; // Override key
  const authHeader = req.headers.get('authorization');

  // Agar production me hai, aur manual override true nahi hai, aur password bhi galat hai, tabhi block karo
  if (process.env.NODE_ENV === 'production' && !isManual && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn("⛔ Blocked unauthorized execution attempt.");
    return NextResponse.json({ status: 'error', message: 'Unauthorized Execution' }, { status: 401 }); 
  }

  try {
    // ==========================================
    // 🧩 LAYER 1: THE INSPECTOR (Basic Checks)
    // ==========================================
    const { count: dbRows, error: dbError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    if (dbError) throw new Error(dbError.message);

    const DANGER_LIMIT = 50000; 

    if ((dbRows || 0) < DANGER_LIMIT) {
      return NextResponse.json({ status: 'healthy', message: `Infrastructure stable. Total load: ${dbRows}` });
    }

    // ==========================================
    // 🧠 LAYER 2: DEEP ANALYST (GPT-5.4 Triggered)
    // ==========================================
    console.log(`[INSPECTOR ALERT] Heavy Load Detected (${dbRows} rows). Waking up Deep Analyst...`);
    
    const analystPrompt = `System has reached ${dbRows} rows. Analyze infrastructure scaling. Provide a strict JSON response with "root_cause" and a safe "suggested_fix" for the CTO.`;
    
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o", 
        messages: [{ role: "system", content: "You are the Deep Analyst API. Output ONLY valid JSON." }, { role: "user", content: analystPrompt }],
        response_format: { type: "json_object" }
      })
    });

    const aiData = await aiResponse.json();
    // 🔥 FIXED: Added here
    const deepAnalysis = JSON.parse(aiData.choices[0].message.content);

    // ==========================================
    // 🔐 LAYER 3: EXECUTOR (Backend Execution)
    // ==========================================
    const { error: alertError } = await supabase
      .from('system_alerts')
      .insert({
        type: 'INFRASTRUCTURE_CRITICAL',
        message: `Database overload predicted! Deep Analyst identified: ${deepAnalysis.root_cause}`,
        suggested_fix: deepAnalysis.suggested_fix,
        status: 'REQUIRES_CTO_APPROVAL' 
      });

    if (alertError) throw new Error(alertError.message);

    return NextResponse.json({ 
      status: 'alert', 
      message: 'Deep Analyst dispatched scaling instructions to HQ.' 
    });

  } catch (error: any) {
    console.error('❌ [EXECUTOR CRASH]:', error.message);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
