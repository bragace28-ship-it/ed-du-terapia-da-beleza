import { neon } from '@neondatabase/serverless';
export async function settlePayment({env,provider,eventId,eventType,payload,externalIds=[],reference='',paid,status='PENDING'}){
 if(!env.NEON_DATABASE_URL)throw new Error('NEON_DATABASE_URL_NOT_CONFIGURED');
 const sql=neon(env.NEON_DATABASE_URL);
 const id=String(eventId||reference||externalIds[0]||crypto.randomUUID()).slice(0,240);
 const ids=[...new Set(externalIds.map(String).filter(Boolean))];
 const result=await sql.query(`
 WITH evt AS (
  INSERT INTO public.webhook_events(provider,event_id,event_type,signature_valid,processed,payload)
  VALUES ($1,$2,$3,true,false,$4::jsonb)
  ON CONFLICT(provider,event_id) DO UPDATE SET payload=EXCLUDED.payload,event_type=EXCLUDED.event_type WHERE public.webhook_events.processed=false RETURNING event_id
 ), pay AS (
  UPDATE public.payments p SET status=CASE WHEN upper(p.status) IN ('PAID','RECEIVED','CONFIRMED','PAYED','SETTLED') THEN p.status ELSE $5 END,
   paid_at=CASE WHEN $6 THEN COALESCE(p.paid_at,now()) ELSE p.paid_at END,
   metadata=COALESCE(p.metadata,'{}'::jsonb)||jsonb_build_object('lastWebhook',$4::jsonb,'webhookEventId',$2,'webhookReceivedAt',now()),
   updated_at=now()
  FROM evt e
  WHERE p.gateway=$1 AND (
   (cardinality($7::text[])>0 AND (p.external_id=ANY($7::text[]) OR p.metadata->>'reference'=$8))
   OR ($8<>'' AND p.metadata->>'reference'=$8)
  ) RETURNING p.id,p.command_id,p.client_id,p.amount,p.status
 ), fin_upd AS (
  UPDATE public.financial_transactions f SET status=CASE WHEN $6 THEN 'paid' ELSE f.status END,
   paid_at=CASE WHEN $6 THEN COALESCE(f.paid_at,now()) ELSE f.paid_at END,updated_at=now()
  FROM pay p WHERE f.metadata->>'payment_id'=p.id::text RETURNING f.id
 ), fin_ins AS (
  INSERT INTO public.financial_transactions(type,direction,command_id,client_id,description,amount,status,category,paid_at,metadata)
  SELECT 'receivable','in',p.command_id,p.client_id,'Pagamento '+$1+' — '+p.id::text,p.amount,
   CASE WHEN $6 THEN 'paid' ELSE 'pending' END,'service_payment',
   CASE WHEN $6 THEN now() ELSE NULL END,jsonb_build_object('payment_id',p.id,'gateway',$1)
  FROM pay p WHERE NOT EXISTS(SELECT 1 FROM public.financial_transactions f WHERE f.metadata->>'payment_id'=p.id::text)
  RETURNING id
 ), cmd AS (
  UPDATE public.commands c SET status='paid',closed_at=COALESCE(c.closed_at,now()),updated_at=now()
  FROM pay p WHERE $6 AND c.id=p.command_id AND
   COALESCE((SELECT sum(x.amount) FROM public.payments x WHERE x.command_id=p.command_id AND x.id<>p.id AND upper(x.status) IN ('PAID','RECEIVED','CONFIRMED','PAYED','SETTLED')),0)+p.amount >= c.total
  RETURNING c.id,c.professional_id,c.total
 ), comm AS (
  INSERT INTO public.commissions(professional_id,command_id,base_amount,commission_rate,commission_amount,status)
  SELECT x.professional_id,x.command_id,x.base_amount,x.rate,
   round((x.base_amount*x.rate/100)::numeric,2),'Pendente'
  FROM (
   SELECT COALESCE(ci.professional_id,c.professional_id) AS professional_id,ci.command_id,
    sum(COALESCE(ci.total,ci.quantity*ci.unit_price)) AS base_amount,
    COALESCE(NULLIF(max(ci.commission_percent),0),max(pr.commission_rate),0) AS rate
   FROM public.command_items ci
   JOIN cmd c ON c.id=ci.command_id
   LEFT JOIN public.professionals pr ON pr.id=COALESCE(ci.professional_id,c.professional_id)
   WHERE COALESCE(ci.professional_id,c.professional_id) IS NOT NULL
   GROUP BY COALESCE(ci.professional_id,c.professional_id),ci.command_id
  ) x
  WHERE x.rate>0 AND NOT EXISTS(SELECT 1 FROM public.commissions c WHERE c.command_id=x.command_id AND c.professional_id=x.professional_id)
  RETURNING id
 )
 SELECT (SELECT count(*) FROM pay)::int AS matched,
        (SELECT count(*) FROM cmd)::int AS commands_paid,
        (SELECT count(*) FROM comm)::int AS commissions_created
 `,[provider,id,String(eventType||''),JSON.stringify(payload||{}),String(status||'PENDING').toUpperCase(),!!paid,ids,String(reference||'')]);
 const summary=result[0]||{matched:0,commands_paid:0,commissions_created:0};
 if(Number(summary.matched)>0)await sql`UPDATE public.webhook_events SET processed=true,processed_at=now() WHERE provider=${provider} AND event_id=${id}`;
 return {...summary,event_recorded:Number(summary.matched)>0?1:0};
}
