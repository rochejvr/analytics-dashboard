import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const searchParams = request.nextUrl.searchParams;
  const hours = parseInt(searchParams.get('hours') || '168'); // default 7 days
  const appId = searchParams.get('app') || null;
  const category = searchParams.get('category') || null;
  const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 1000);

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('activity_events')
    .select('*')
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (appId) query = query.eq('app_id', appId);
  if (category) query = query.eq('category', category);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data || [], count: data?.length || 0 });
}
