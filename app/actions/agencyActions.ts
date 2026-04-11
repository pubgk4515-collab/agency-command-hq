'use server';

// 🔥 FIX: Ab ye naye secure file se import kar raha hai
import { supabaseAdmin } from '../../lib/supabaseAdmin'; 
import { revalidatePath } from 'next/cache';

export async function toggleStoreFeature(storeId: string, featureColumn: string, newValue: boolean) {
  try {
    const { error } = await supabaseAdmin
      .from('stores')
      .update({ [featureColumn]: newValue })
      .eq('id', storeId);

    if (error) throw error;

    revalidatePath('/'); 
    return { success: true };
  } catch (error: any) {
    console.error("Action error:", error.message);
    return { success: false, error: error.message };
  }
}
