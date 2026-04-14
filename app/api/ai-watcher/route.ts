export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase'; 

const INSPECTOR_MODEL = 'gpt-4o-mini'; 
const ANALYST_MODEL = 'gpt-4o'; // ✅ safe + available
const BATCH_SIZE = 100; 
const MAX_RETRIES = 3;

interface Product { id: string; name: string; price: number; category: string; }
interface Anomaly { product_id: string; name: string; suggested_category: string; confidence_score: number; root_cause: string; suggested_fix: string; }

// ✅ SAFE JSON PARSER
function safeParse(content: string | null) {
  try {
    return content ? JSON.parse(content) : {};
  } catch (e) {
    console.error("❌ JSON Parse Failed:", content);
    return {};
  }
}

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
          model,
          messages: [
            { role: 'system', content: 'You are a strict JSON generator. Always return valid JSON only.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.05
        })
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn(`⚠️ Attempt ${attempt} failed for ${model}`);
      if (attempt === retries) throw error;
      await new Promise(res => setTimeout(res, 2 ** attempt * 500)); // ✅ exponential backoff
    }
  }
}

export async function GET(request: Request) {
  const startTime = Date.now();

  const url = new URL(request.url);
  const isManual = url.searchParams.get('manual') === 'true'; 
  const authHeader = request.headers.get('authorization');

  if (process.env.NODE_ENV === 'production' && !isManual && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized Execution' }, { status: 401 }); 
  }

  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, price, category')
      .eq('category', 'Normal Apparel') 
      .limit(BATCH_SIZE);

    if (error) throw new Error(error.message);
    if (!products?.length) {
      return NextResponse.json({ status: 'success', message: 'No anomalies', execution_ms: Date.now() - startTime });
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
    const inspectorContent = inspectorRes?.choices?.[0]?.message?.content;

    const parsedInspector = safeParse(inspectorContent);
    const suspiciousIds: string[] = parsedInspector.suspicious_ids || [];

    if (!suspiciousIds.length) {
      return NextResponse.json({ status: 'success', message: 'All clean', execution_ms: Date.now() - startTime });
    }

    // ================= ANALYST =================
    const flaggedProducts = products.filter(p => suspiciousIds.includes(p.id));

    const analystPrompt = `
      Analyze GST mismatch.

      RULE:
      Leather Goods = 18%

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
    const analystContent = analystRes?.choices?.[0]?.message?.content;

    const parsedAnalyst = safeParse(analystContent);
    let anomalies: Anomaly[] = parsedAnalyst.anomalies || [];

    // ✅ confidence filter
    anomalies = anomalies.filter(a => a.confidence_score > 85);

    if (!anomalies.length) {
      return NextResponse.json({ status: 'success', message: 'No high-confidence issues', execution_ms: Date.now() - startTime });
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
      return NextResponse.json({ status: 'success', message: 'No new alerts', execution_ms: Date.now() - startTime });
    }

    const alerts = newAnomalies.map(a => ({
      title: `⚠️ Tax Leakage: ${a.name}`,
      message: a.root_cause,
      suggested_fix: a.suggested_fix,
      priority: 'high',
      status: 'REQUIRES_CTO_APPROVAL',
      action_payload: {
        product_id: a.product_id,
        new_category: a.suggested_category
      }
    }));

    const { error: insertError } = await supabase.from('system_alerts').insert(alerts);
    if (insertError) throw new Error(insertError.message);

    return NextResponse.json({
      status: 'alert',
      message: `${alerts.length} issues detected`,
      execution_ms: Date.now() - startTime
    });

  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}