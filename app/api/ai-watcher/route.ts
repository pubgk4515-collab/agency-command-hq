export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase'; 

// 🔥 MODELS
const INSPECTOR_MODEL = 'gpt-5.4-mini'; 
const ANALYST_MODEL = 'gpt-5.4';

const BATCH_SIZE = 100; 
const MAX_RETRIES = 3;

interface Product { id: string; name: string; price: number; category: string; }
interface Anomaly { product_id: string; name: string; suggested_category: string; confidence_score: number; root_cause: string; suggested_fix: string; }

// ✅ SAFE PARSE
function safeParse(content: string | null) {
  try {
    return content ? JSON.parse(content) : {};
  } catch (e) {
    console.error("❌ JSON Parse Failed:", content);
    return {};
  }
}

// ✅ OPENAI CALL
async function fetchOpenAIWithRetry(prompt: string, model: string, retries = MAX_RETRIES): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          input: [
            {
              role: "system",
              content: "You are a strict JSON generator. Always return valid JSON only."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.05,
          text: { format: { type: "json_object" } }
        })
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`API Error ${res.status}: ${err}`);
      }

      const data = await res.json();
      const content = data?.output?.[0]?.content?.[0]?.text;

      return { content };

    } catch (err) {
      console.warn(`⚠️ Attempt ${attempt} failed (${model})`);
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 2 ** attempt * 500));
    }
  }
}

// ================= MAIN =================
export async function GET(request: Request) {
  const startTime = Date.now();

  const url = new URL(request.url);
  const isManual = url.searchParams.get('manual') === 'true'; 
  const authHeader = request.headers.get('authorization');

  if (process.env.NODE_ENV === 'production' && !isManual && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized Execution' }, { status: 401 }); 
  }

  try {
    // ================= FETCH =================
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, price, category')
      .eq('category', 'Normal Apparel')
      .limit(BATCH_SIZE);

    if (error) throw new Error(error.message);

    if (!products?.length) {
      return NextResponse.json({ status: 'success', message: 'No data' });
    }

    // ================= INSPECTOR =================
    const inspectorPrompt = `
Flag ANY product even slightly indicating premium materials 
(leather, silk, fur, suede, hide, etc).
Prefer false positives.

DATA: ${JSON.stringify(products)}

OUTPUT:
{ "suspicious_ids": [] }
`;

    const inspectorRes = await fetchOpenAIWithRetry(inspectorPrompt, INSPECTOR_MODEL);
    const parsedInspector = safeParse(inspectorRes?.content);

    console.log("🧠 Inspector:", parsedInspector);

    const suspiciousIds: string[] = parsedInspector.suspicious_ids || [];

    if (!suspiciousIds.length) {
      return NextResponse.json({ status: 'success', message: 'All clean' });
    }

    // ================= ANALYST =================
    const flaggedProducts = products.filter(p => suspiciousIds.includes(p.id));

    console.log("🚩 Flagged:", flaggedProducts);

    const analystPrompt = `
STRICT RULE:
If product contains leather → MUST NOT be "Normal Apparel"
It MUST be categorized as "Leather Goods"

DATA: ${JSON.stringify(flaggedProducts)}

OUTPUT:
{
  "anomalies": [
    {
      "product_id": "",
      "name": "",
      "suggested_category": "",
      "confidence_score": 0,
      "root_cause": "",
      "suggested_fix": ""
    }
  ]
}
`;

    const analystRes = await fetchOpenAIWithRetry(analystPrompt, ANALYST_MODEL);
    const parsedAnalyst = safeParse(analystRes?.content);

    console.log("🧠 Analyst:", parsedAnalyst);

    let anomalies: Anomaly[] = parsedAnalyst.anomalies || [];

    // 🔥 SMART CONFIDENCE FILTER (Handles 0.99 and 99 automatically)
    anomalies = anomalies.filter(a => {
      let score = Number(a.confidence_score) || 0;
      if (score <= 1 && score > 0) score = score * 100; // 0.99 becomes 99
      return score >= 75; // 75% se upar wale pass
    });

    if (!anomalies.length) {
      return NextResponse.json({ status: 'success', message: 'No high-confidence issues' });
    }

    // ================= EXECUTOR =================
    const { data: existingAlerts } = await supabase
      .from('system_alerts')
      .select('action_payload')
      .in('status', ['pending', 'REQUIRES_CTO_APPROVAL']);

    const existingIds = new Set(
      existingAlerts?.map(a => a.action_payload?.product_id).filter(Boolean)
    );

    const newAnomalies = anomalies.filter(a => !existingIds.has(a.product_id));

    if (!newAnomalies.length) {
      return NextResponse.json({ status: 'success', message: 'No new alerts' });
    }

    // ✅ FIXED FORMAT FOR UI DRAWER & RADAR
    const alerts = newAnomalies.map(a => {
      let score = Number(a.confidence_score) || 0;
      if (score <= 1 && score > 0) score = score * 100; // Math fix for description display

      return {
        title: `⚠️ Tax Leakage Risk: ${a.name}`,
        description: `AI Confidence (${Math.round(score)}%): ${a.root_cause}`,
        priority: 'high',
        status: 'REQUIRES_CTO_APPROVAL', // 🔥 Radar ko jagane ke liye wapas CTO approval pe daal diya
        action_payload: {
          product_id: a.product_id,
          new_category: a.suggested_category,
          suggested_fix: a.suggested_fix,
          confidence: Math.round(score)
        }
      };
    });

    const { error: insertError } = await supabase
      .from('system_alerts')
      .insert(alerts);

    if (insertError) throw new Error(insertError.message);

    return NextResponse.json({
      status: 'alert',
      count: alerts.length,
      execution_ms: Date.now() - startTime
    });

  } catch (err: any) {
    console.error("🔥 FINAL ERROR:", err.message);

    return NextResponse.json({
      status: 'error',
      message: err.message
    }, { status: 500 });
  }
}
