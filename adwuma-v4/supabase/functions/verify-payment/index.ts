// supabase/functions/verify-payment/index.ts
// Deploy with: supabase functions deploy verify-payment

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { reference } = await req.json();
    if (!reference) throw new Error('Missing payment reference');

    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) throw new Error('Paystack secret key not configured');

    // Verify with Paystack API
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${paystackSecretKey}` } }
    );
    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data?.status !== 'success') {
      throw new Error(`Payment verification failed: ${verifyData.message || 'Unknown error'}`);
    }

    const txData = verifyData.data;

    // Init Supabase admin client to write payment record
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get auth user from JWT
    const authHeader = req.headers.get('Authorization');
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader?.replace('Bearer ', '') ?? ''
    );
    if (authError || !user) throw new Error('Unauthorized');

    const meta = txData.metadata || {};
    const applicationId = meta.application_id;
    const agentId = meta.agent_id;

    if (!applicationId) throw new Error('Missing application_id in payment metadata');

    // Get platform fee from settings
    const { data: settingRow } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'platform_fee_pct')
      .single();
    const platformFeePct = parseFloat(settingRow?.value ?? '10');
    const totalAmount = txData.amount / 100; // Convert from kobo
    const platformFee = (totalAmount * platformFeePct) / 100;
    const agentPayout = totalAmount - platformFee;

    // Insert payment record
    const { error: paymentError } = await supabase.from('payments').insert({
      application_id: applicationId,
      seeker_id: user.id,
      agent_id: agentId,
      amount: totalAmount,
      currency: txData.currency,
      paystack_reference: reference,
      paystack_transaction_id: String(txData.id),
      escrow_status: 'holding',
      platform_fee_pct: platformFeePct,
      platform_fee_amount: platformFee,
      agent_payout_amount: agentPayout,
    });
    if (paymentError) throw paymentError;

    // Update application status
    await supabase
      .from('applications')
      .update({ status: 'in_escrow' })
      .eq('id', applicationId);

    // Notify agent
    const { data: appData } = await supabase
      .from('applications')
      .select('jobs(title)')
      .eq('id', applicationId)
      .single();

    await supabase.from('notifications').insert({
      recipient_id: agentId,
      type: 'application_received',
      title: 'New Paid Application',
      body: `A seeker has applied and paid for "${appData?.jobs?.title ?? 'a job listing'}". Review it in your dashboard.`,
      link: `/agent/applications/${applicationId}`,
    });

    return new Response(
      JSON.stringify({ success: true, amount: totalAmount, currency: txData.currency }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
