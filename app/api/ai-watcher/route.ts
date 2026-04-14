export const maxDuration = 60; // 🔥 Vercel Timeout Bypass (60 seconds)

import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase'; 

// 🔥 ENTERPRISE MULTI-AGENT CONFIGURATION
const INSPECTOR_MODEL = 'gpt-4o-mini'; 
const ANALYST_MODEL = 'gpt-5.4';       
const BATCH_SIZE = 100; 
const MAX_RETRIES = 3;

interface Product { id: string; name: string; price: number; category: string; }
interface Anomaly { product_id: string; name: string; suggested_category: string; confidence_score: number; root_cause: string; suggested_fix: string; }

async function fetchOpenAIWithRetry(prompt: string, model: string, retries = MAX_RETRIES): Promise<any> {
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
          model: model, 
          messages: [{ role: 'system', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.05 
        })
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn(`⚠️ OpenAI attempt ${attempt} failed for ${model}. Retrying...`);
      if (attempt === retries) throw error;
      await new Promise(res => setTimeout(res, 1000 * attempt)); 
    }
  }
}

export async function GET(request: Request) {
  const startTime = Date.now();
  console.log("🤖 [HIERARCHICAL SWARM] Initiating network telemetry scan...");

  // 🔒 1. ENTERPRISE SECURITY LOCK (With CTO Override)
  const url = new URL(request.url);
  const isManual = url.searchParams.get('manual') === 'true'; 
  const authHeader = request.headers.get('authorization');

  if (process.env.NODE_ENV === 'production' && !isManual && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn("⛔ Blocked unauthorized execution attempt.");
    return NextResponse.json({ status: 'error', message: 'Unauthorized Execution' }, { status: 401 }); 
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

    // ==========================================
    // 🧩 LAYER 1: THE INSPECTOR (GPT-4o-mini)
    // ==========================================
    console.log(`🛡️ [INSPECTOR] Scanning ${products.length} items for suspicious keywords...`);
    
    const inspectorPrompt = `
      You are the Level 1 Guard. Review these products. 
      Flag ANY product that might be made of premium materials like Leather, Silk, or Fur, but is categorized as 'Normal Apparel'.
      
      DATA: ${JSON.stringify(products)}
      
      OUTPUT STRICTLY AS JSON:
      { "suspicious_ids": ["uuid-1", "uuid-2"] }
    `;

    let suspiciousIds: string[] = [];
    if (process.env.OPENAI_API_KEY) {
      const inspectorData = await fetchOpenAIWithRetry(inspectorPrompt, INSPECTOR_MODEL);
      // 🔥 FIXED: Added here
      suspiciousIds = JSON.parse(inspectorData.choices[0].message.content).suspicious_ids || [];
    }

    if (suspiciousIds.length === 0) {
      console.log("✅ [INSPECTOR] Cleared. No suspicious items found.");
      return NextResponse.json({ status: 'success', message: 'Patrol complete. Area clear.', execution_ms: Date.now() - startTime });
    }

    // ==========================================
    // 🧠 LAYER 2: DEEP ANALYST (GPT-5.4)
    // ==========================================
    console.log(`🧠 [DEEP ANALYST] Escalated ${suspiciousIds.length} items. Waking up GPT-5.4 for deep inspection...`);
    
    const flaggedProducts = products.filter(p => suspiciousIds.includes(p.id));
    
    const analystPrompt = `
      You are an elite Retail Tax Auditor and Deep Analyst. 
      The Level 1 Inspector flagged these items. Analyze them deeply against Indian GST Rules.
      
      RULES:
      - 'Leather Goods' MUST attract 18% GST.
      - Explain the 'root_cause' in simple language for the CTO.
      - Provide a 'suggested_fix' outlining the exact action required.
      
      DATA: ${JSON.stringify(flaggedProducts)}
      
      OUTPUT STRICTLY AS JSON:
      {
        "anomalies": [
          {
            "product_id": "uuid",
            "name": "string",
            "suggested_category": "Leather Goods",
            "confidence_score": 99,
            "root_cause": "Detailed simple explanation of why this is wrong",
            "suggested_fix": "Change category to X to comply with 18% slab"
          }
        ]
      }
    `;

    let anomalies: Anomaly[] = [];
    if (process.env.OPENAI_API_KEY) {
      const analystData = await fetchOpenAIWithRetry(analystPrompt, ANALYST_MODEL);
      // 🔥 FIXED: Added here
      anomalies = JSON.parse(analystData.choices[0].message.content).anomalies || [];
    }

    // ==========================================
    // 🔐 LAYER 3: THE EXECUTOR (Backend Logic)
    // ==========================================
    if (anomalies.length > 0) {
      console.log(`🚨 [EXECUTOR] Received ${anomalies.length} fixes from Deep Analyst. Verifying safety...`);

      const { data: existingAlerts } = await supabase
        .from('system_alerts')
        .select('action_payload')
        .in('status', ['pending', 'REQUIRES_CTO_APPROVAL']);

      const existingProductIds = new Set(
        existingAlerts?.map(a => a.action_payload?.product_id).filter(Boolean)
      );

      const newAnomalies = anomalies.filter(a => !existingProductIds.has(a.product_id));

      if (newAnomalies.length > 0) {
        const alertsToInsert = newAnomalies.map(anomaly => ({
          title: `⚠️ Tax Leakage Risk: ${anomaly.name}`,
          message: anomaly.root_cause,           
          suggested_fix: anomaly.suggested_fix,  
          priority: 'high',
          status: 'REQUIRES_CTO_APPROVAL',       
          action_payload: { 
            product_id: anomaly.product_id, 
            new_category: anomaly.suggested_category 
          } 
        }));

        const { error: alertError } = await supabase.from('system_alerts').insert(alertsToInsert);
        if (alertError) throw new Error(`Alert Dispatch Failed: ${alertError.message}`);
        
        console.log(`✅ [EXECUTOR] Safely dispatched ${newAnomalies.length} NEW alerts to CTO Command Center.`);
        return NextResponse.json({ 
          status: 'alert', 
          message: `Deep Analyst identified and dispatched ${newAnomalies.length} critical issues.`,
          execution_ms: Date.now() - startTime
        });
      } else {
        console.log("🛡️ [EXECUTOR] Issues identified, but already pending in HQ. Blocked duplicate dispatch.");
      }
    }

    return NextResponse.json({ status: 'success', message: 'Patrol complete. No new alerts required.', execution_ms: Date.now() - startTime });

  } catch (error: any) {
    console.error('❌ [SWARM CRASH]:', error.message);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
