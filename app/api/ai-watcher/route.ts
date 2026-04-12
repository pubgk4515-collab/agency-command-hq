import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase'; 

// 🔥 THE SYSTEM ARCHITECT CONFIGURATION
const AI_MODEL = 'gpt-4o-mini'; 
const BATCH_SIZE = 100; // Ek baar me kitne products scan karega

export async function GET(request: Request) {
  console.log("🤖 [AI WATCHER] Waking up for routine patrol...");

  // 🔒 1. ENTERPRISE SECURITY LOCK
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV === 'production') {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.warn("⚠️ [AI WATCHER] Unauthorized access attempt blocked.");
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }

  try {
    // 🕵️ 2. FETCHING VULNERABLE DATA (Hunting for anomalies)
    console.log(`🔍 [AI WATCHER] Scanning up to ${BATCH_SIZE} items categorized as 'Normal Apparel'...`);
    
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, name, price, category')
      .eq('category', 'Normal Apparel') 
      .limit(BATCH_SIZE);

    if (fetchError) throw new Error(`Database Fetch Failed: ${fetchError.message}`);

    if (!products || products.length === 0) {
      console.log("✅ [AI WATCHER] System is clean. No anomalies found.");
      return NextResponse.json({ 
        status: 'success', 
        message: 'System is 100% Healthy. No suspicious items.' 
      });
    }

    // 🧠 3. ADVANCED PROMPT ENGINEERING (Teaching the Agent the exact laws)
    const systemPrompt = `
      You are the elite AI Database Auditor for an Indian retail system. 
      Your job is to find categorization errors that cause GST leakage.
      
      RULES:
      1. 'Normal Apparel' attracts 5% GST (default).
      2. 'Leather Goods' (Jackets, Belts, Shoes made of leather) MUST attract 18% GST.
      3. Look at the product name. If it implies it is made of Leather, it MUST be categorized as 'Leather Goods'.
      4. Ignore items that are clearly cotton, denim, or regular apparel.
      
      DATA TO AUDIT:
      ${JSON.stringify(products)}
      
      OUTPUT FORMAT:
      You MUST return ONLY a valid JSON object. Do not include markdown formatting or explanations outside the JSON.
      {
        "anomalies": [
          {
            "product_id": "uuid-here",
            "name": "product name",
            "suggested_category": "Leather Goods",
            "confidence_score": 95,
            "reason": "Contains word 'leather', must be 18% slab."
          }
        ]
      }
    `;

    console.log("🧠 [AI WATCHER] Calling LLM API for deep analysis...");

    // ⚡ 4. THE AI ENGINE EXECUTION (Robust OpenAI Call)
    const apiKey = process.env.OPENAI_API_KEY;
    let anomalies = [];

    if (apiKey) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [{ role: 'system', content: systemPrompt }],
          response_format: { type: 'json_object' },
          temperature: 0.1 // Low temperature for maximum analytical accuracy
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(`OpenAI API Error: ${errData.error?.message || 'Unknown error'}`);
      }

      const llmData = await response.json();
      const aiResponseContent = llmData.choices.message.content;
      
      try {
        const parsedData = JSON.parse(aiResponseContent);
        anomalies = parsedData.anomalies || [];
      } catch (parseErr) {
        console.error("❌ [AI WATCHER] Failed to parse AI JSON response:", aiResponseContent);
        throw new Error("AI returned invalid JSON format.");
      }

    } else {
      // 🛡️ ZERO-COST FAILSAFE FALLBACK (If API Key is missing or quota exhausted)
      console.log("⚠️ [AI WATCHER] OPENAI_API_KEY missing. Using local algorithmic fallback.");
      anomalies = products
        .filter(p => p.name.toLowerCase().includes('leather'))
        .map(p => ({
          product_id: p.id,
          name: p.name,
          suggested_category: 'Leather Goods',
          reason: 'Failsafe local check: Item name contains "leather".'
        }));
    }

    // 🚨 5. INJECTING ACTIONABLE ALERTS TO COMMAND CENTER
    if (anomalies.length > 0) {
      console.log(`🚨 [AI WATCHER] Detected ${anomalies.length} anomalies. Generating action payloads...`);
      
      const alertsToInsert = anomalies.map((anomaly: any) => ({
        title: '⚠️ Tax Slab Anomaly Detected',
        description: `AI Watcher found '${anomaly.name}' incorrectly mapped. Reason: ${anomaly.reason}. Update required to prevent GST leakage.`,
        priority: 'high',
        status: 'pending',
        // 🔥 THE MAGIC BULLET: Self-healing payload
        action_payload: { 
          product_id: anomaly.product_id, 
          new_category: anomaly.suggested_category 
        } 
      }));

      const { error: alertError } = await supabase.from('system_alerts').insert(alertsToInsert);
      
      if (alertError) throw new Error(`Failed to dispatch alerts: ${alertError.message}`);

      return NextResponse.json({ 
        status: 'alert', 
        message: `Dispatched ${anomalies.length} anomalies to Agency HQ.` 
      });
    }

    console.log("✅ [AI WATCHER] Patrol complete. No actions needed.");
    return NextResponse.json({ status: 'success', message: 'Patrol complete. System is flawless.' });

  } catch (error: any) {
    console.error('❌ [AI WATCHER CRITICAL FAILURE]:', error.message);
    return NextResponse.json(
      { status: 'error', message: error.message }, 
      { status: 500 }
    );
  }
}
