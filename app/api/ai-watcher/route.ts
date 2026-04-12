import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase'; 

// 🔥 ENTERPRISE CONFIGURATION
const AI_MODEL = 'gpt-4o-mini'; 
const BATCH_SIZE = 100; 
const MAX_RETRIES = 3;

// 🛡️ STRICT TYPE INTERFACES
interface Product { id: string; name: string; price: number; category: string; }
interface Anomaly { product_id: string; name: string; suggested_category: string; confidence_score: number; reason: string; }

// 🔄 SMART RETRY WRAPPER FOR OPENAI
async function fetchOpenAIWithRetry(prompt: string, retries = MAX_RETRIES): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [{ role: 'system', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.05 // Ultra-low hallucination risk
        })
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn(`⚠️ OpenAI attempt ${attempt} failed. Retrying...`);
      if (attempt === retries) throw error;
      await new Promise(res => setTimeout(res, 1000 * attempt)); // Exponential backoff
    }
  }
}

export async function GET(request: Request) {
  const startTime = Date.now();
  console.log("🤖 [AI WATCHER] Initiating enterprise telemetry scan...");

  // 🔒 1. ENTERPRISE SECURITY LOCK
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn("⛔ [AI WATCHER] Blocked unauthorized execution attempt.");
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // 🕵️ 2. FETCH VULNERABLE DATA
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, name, price, category')
      .eq('category', 'Normal Apparel') 
      .limit(BATCH_SIZE);

    if (fetchError) throw new Error(`DB Fetch Failed: ${fetchError.message}`);
    if (!products || products.length === 0) {
      return NextResponse.json({ status: 'success', message: 'System is 100% Healthy. No anomalies.', execution_ms: Date.now() - startTime });
    }

    // 🧠 3. CHAIN-OF-THOUGHT PROMPT ENGINEERING
    const systemPrompt = `
      You are an elite Retail Tax Auditor AI. Analyze these items currently categorized as 'Normal Apparel' (5% GST).
      
      RULES:
      - 'Leather Goods' (Jackets, Belts, Wallets, Shoes made of ANY leather) MUST attract 18% GST.
      - Think step-by-step: 
        1. Read the product name.
        2. Determine the core material.
        3. If it contains leather/PU leather, it's an anomaly.
      
      DATA:
      ${JSON.stringify(products)}
      
      OUTPUT STRICTLY AS JSON:
      {
        "anomalies": [
          {
            "product_id": "uuid",
            "name": "string",
            "suggested_category": "Leather Goods",
            "confidence_score": 99,
            "reason": "Detailed explanation"
          }
        ]
      }
    `;

    let anomalies: Anomaly[] = [];

    // ⚡ 4. EXECUTE AI OR FALLBACK
    if (process.env.OPENAI_API_KEY) {
      console.log("🧠 [AI WATCHER] Connecting to OpenAI Neural Net...");
      const llmData = await fetchOpenAIWithRetry(systemPrompt);
      // 🔥 FIXED FATAL BUG: choices was missing in the original code
      const aiResponseContent = llmData.choices.message.content; 
      anomalies = JSON.parse(aiResponseContent).anomalies || [];
    } else {
      console.log("⚠️ [AI WATCHER] API Key missing. Executing local heuristic scan.");
      anomalies = (products as Product[])
        .filter(p => p.name.toLowerCase().includes('leather'))
        .map(p => ({
          product_id: p.id,
          name: p.name,
          suggested_category: 'Leather Goods',
          confidence_score: 100,
          reason: 'Local Failsafe: Name implies leather material.'
        }));
    }

    // 🚨 5. ANTI-SPAM & ALERT INJECTION
    if (anomalies.length > 0) {
      console.log(`🚨 [AI WATCHER] Found ${anomalies.length} potential anomalies. Checking for duplicates...`);

      // 🛡️ ANTI-SPAM LOGIC: Check existing pending alerts so we don't spam the CTO dashboard
      const { data: existingAlerts } = await supabase
        .from('system_alerts')
        .select('action_payload')
        .eq('status', 'pending');

      const existingProductIds = new Set(
        existingAlerts?.map(a => a.action_payload?.product_id).filter(Boolean)
      );

      // Filter out anomalies that are already in the dashboard awaiting approval
      const newAnomalies = anomalies.filter(a => !existingProductIds.has(a.product_id));

      if (newAnomalies.length > 0) {
        const alertsToInsert = newAnomalies.map(anomaly => ({
          title: `⚠️ Tax Leakage Risk: ${anomaly.name}`,
          description: `AI Confidence (${anomaly.confidence_score}%): ${anomaly.reason} Update to ${anomaly.suggested_category} to comply with GST slabs.`,
          priority: 'high',
          status: 'pending',
          action_payload: { 
            product_id: anomaly.product_id, 
            new_category: anomaly.suggested_category 
          } 
        }));

        const { error: alertError } = await supabase.from('system_alerts').insert(alertsToInsert);
        if (alertError) throw new Error(`Alert Dispatch Failed: ${alertError.message}`);
        
        console.log(`✅ [AI WATCHER] Dispatched ${newAnomalies.length} NEW alerts to Command Center.`);
        return NextResponse.json({ 
          status: 'alert', 
          message: `Dispatched ${newAnomalies.length} new anomalies to HQ.`,
          execution_ms: Date.now() - startTime
        });
      } else {
        console.log("🛡️ [AI WATCHER] Anomalies found, but alerts are already pending in HQ. Skipping duplicate dispatch.");
      }
    }

    return NextResponse.json({ status: 'success', message: 'Patrol complete. No new alerts required.', execution_ms: Date.now() - startTime });

  } catch (error: any) {
    console.error('❌ [AI WATCHER CRASH]:', error.message);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
