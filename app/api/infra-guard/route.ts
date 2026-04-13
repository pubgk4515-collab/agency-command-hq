import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase Admin Client (Taaki ye system ka data padh sake)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Dhyan rahe, ye Service Role key hai, anon key nahi
);

export async function GET(req: Request) {
  // 🔐 CRON JOB SECURITY (Bahar ka koi hit nahi kar payega)
  const authHeader = req.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // ==========================================
    // 🧩 LAYER 1: THE INSPECTOR (Basic Checks)
    // ==========================================
    // Yahan hum Supabase DB ka load check kar rahe hain (Example: total orders count as a load metric)
    const { count: dbRows, error: dbError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    if (dbError) throw new Error(dbError.message);

    const DANGER_LIMIT = 50000; // Agar 50,000 orders cross hue toh system heavy ho sakta hai

    // Agar system normal hai, toh Inspector yahi se wapas laut jayega (Paisa aur Token bacha)
    if ((dbRows || 0) < DANGER_LIMIT) {
      return NextResponse.json({ status: 'healthy', message: `Infrastructure stable. Total load: ${dbRows}` });
    }

    // ==========================================
    // 🧠 LAYER 2: DEEP ANALYST (GPT-5.4 Triggered)
    // ==========================================
    // Agar Inspector ne danger pakda, toh Deep Analyst ko call jayegi
    console.log(`[INSPECTOR ALERT] Heavy Load Detected (${dbRows} rows). Waking up Deep Analyst...`);
    
    const analystPrompt = `System has reached ${dbRows} rows. Analyze infrastructure scaling. Provide a strict JSON response with "root_cause" and a safe "suggested_fix" for the CTO.`;
    
    // Call to OpenAI (Yahan hum API fetch lagayenge)
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o", // Aap aage chal kar isko "gpt-5.4" ya latest reasoning model par update kar sakte hain
        messages: [{ role: "system", content: "You are the Deep Analyst API. Output ONLY valid JSON." }, { role: "user", content: analystPrompt }],
        response_format: { type: "json_object" }
      })
    });

    const aiData = await aiResponse.json();
    const deepAnalysis = JSON.parse(aiData.choices.message.content);

    // ==========================================
    // 🔐 LAYER 3: EXECUTOR (Backend Execution)
    // ==========================================
    // RULE APPLIED: AI khud kuch execute nahi karega. Executor check karega aur DB me 'pending_approval' daal dega.
    
    const { error: alertError } = await supabase
      .from('system_alerts')
      .insert({
        type: 'INFRASTRUCTURE_CRITICAL',
        message: `Database overload predicted! Deep Analyst identified: ${deepAnalysis.root_cause}`,
        suggested_fix: deepAnalysis.suggested_fix,
        status: 'REQUIRES_CTO_APPROVAL' // Sirf CTO (Aap) isko dashboard se approve kar sakte hain
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
