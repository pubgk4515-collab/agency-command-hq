import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase'; 

export async function GET(request: Request) {
  // 🔒 1. Security Lock: Taki koi bahar wala is API ko hit na kar sake (Sirf Vercel Cron karega)
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized access', { status: 401 });
  }

  try {
    // 🕵️ 2. The Data Fetch: Agent check karega ki kis product pe default category lagi hai
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, price, category')
      .eq('category', 'Normal Apparel') // Sirf unhe check karo jo default par hain
      .limit(50); // Ek baar me 50 items padhega taki API sasti rahe

    if (error || !products || products.length === 0) {
      return NextResponse.json({ status: 'System is 100% Healthy. No suspicious items.' });
    }

    // 🧠 3. The LLM Prompt (The Brain)
    const prompt = `
      You are a precise Tax & Inventory AI Auditor for Rampurhat Garments.
      Review the following clothing items currently categorized as 'Normal Apparel' (which carries 5% GST).
      If an item is made of Leather (like jackets, belts) or falls under an 18% GST slab, it is an ANOMALY.
      
      Items to check: ${JSON.stringify(products)}
      
      Return a JSON array ONLY in this format: 
      { "anomalies": [ {"id": "123", "name": "...", "suggested_category": "Leather Goods", "reason": "..."} ] }
      If there are no anomalies, return { "anomalies": [] }.
    `;

    // ⚡ 4. The API Call (Using GPT-4o-mini as an ultra-fast, cheap brain)
    // Make sure to add OPENAI_API_KEY in your .env.local file
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}` // Fallback handle
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: prompt }],
        response_format: { type: 'json_object' } 
      })
    });

    const llmData = await response.json();
    
    // Fallback: Agar API key nahi hai, toh Agent khud ek simple keyword check lagayega (No API cost)
    let anomalies = [];
    if (!process.env.OPENAI_API_KEY) {
      anomalies = products
        .filter(p => p.name.toLowerCase().includes('leather'))
        .map(p => ({
          id: p.id,
          name: p.name,
          suggested_category: 'Leather Goods',
          reason: 'Hardcoded fallback: Word "leather" found in name.'
        }));
    } else {
      const content = JSON.parse(llmData.choices.message.content);
      anomalies = content.anomalies || [];
    }

    // 🚨 5. The Alert System (Reporting to the CTO)
    if (anomalies.length > 0) {
      for (const anomaly of anomalies) {
        await supabase.from('system_alerts').insert({
          title: '⚠️ Tax Slab Anomaly Detected',
          description: `AI Watcher found '${anomaly.name}' categorized incorrectly as Normal Apparel. Reason: ${anomaly.reason}. Suggesting update to ${anomaly.suggested_category}.`,
          priority: 'high',
          status: 'pending'
        });
      }
      return NextResponse.json({ status: `🚨 Alert! Found ${anomalies.length} anomalies. Check Agency HQ.` });
    }

    return NextResponse.json({ status: 'Scan complete. System is flawless.' });

  } catch (error: any) {
    console.error('AI Watcher Engine Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
