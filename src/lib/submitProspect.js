import { supabase, supabaseConfigured } from './supabase.js';

/**
 * Single frontend → backend entry for project intake.
 * Notifications live entirely inside the Edge Function —
 * this client never changes for them.
 */
export async function submitProspect(payload) {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Intake is not configured yet.');
  }

  const { data, error } = await supabase.functions.invoke('submit-prospect', {
    body: payload,
  });

  if (error) {
    throw new Error(error.message || 'Could not send request');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}
