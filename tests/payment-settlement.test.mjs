import test from 'node:test';
import assert from 'node:assert/strict';
import { recordGatewaySettlement } from '../functions/_shared/settle-payment.js';

function mockSql({paidTotal=120}={}) {
  const calls=[];
  const sql=async(strings,...values)=>{
    const statement=strings.reduce((out,part,i)=>out+part+(i<values.length?'?':''),'');
    calls.push({statement,values});
    if(statement.includes('select id, client_id, total from public.commands')) {
      return [{id:'11111111-1111-4111-8111-111111111111',client_id:'22222222-2222-4222-8222-222222222222',total:120}];
    }
    if(statement.includes('select coalesce(sum(amount), 0) as total')) return [{total:paidTotal}];
    return [];
  };
  return {sql,calls};
}

test('confirmed gateway payment writes one idempotent finance-ledger entry and closes fully paid command',async()=>{
  const {sql,calls}=mockSql({paidTotal:120});
  const payment={id:'33333333-3333-4333-8333-333333333333',command_id:'11111111-1111-4111-8111-111111111111',client_id:'22222222-2222-4222-8222-222222222222',amount:120,status:'PAID',gateway:'PagBank',method:'PIX',external_id:'checkout-qa'};
  const result=await recordGatewaySettlement(sql,payment);
  assert.equal(result.settled,true);
  const insert=calls.find(x=>x.statement.includes('insert into public.financial_transactions'));
  assert.ok(insert,'finance transaction insert must be executed');
  assert.match(insert.statement,/payment_id/);
  assert.match(insert.statement,/on conflict/i);
  const close=calls.find(x=>x.statement.includes("status = 'closed'"));
  assert.ok(close,'fully paid command must be closed');
});

test('partial gateway payment writes the receipt but does not close the command',async()=>{
  const {sql,calls}=mockSql({paidTotal:60});
  const payment={id:'44444444-4444-4444-8444-444444444444',command_id:'11111111-1111-4111-8111-111111111111',client_id:'22222222-2222-4222-8222-222222222222',amount:60,status:'RECEIVED',gateway:'Asaas',method:'PIX'};
  await recordGatewaySettlement(sql,payment);
  assert.ok(calls.some(x=>x.statement.includes('insert into public.financial_transactions')));
  assert.ok(!calls.some(x=>x.statement.includes("status = 'closed'")));
});

test('non-paid gateway status never writes finance ledger',async()=>{
  const {sql,calls}=mockSql();
  const result=await recordGatewaySettlement(sql,{id:'55555555-5555-4555-8555-555555555555',status:'PENDING',amount:120});
  assert.deepEqual(result,{settled:false,reason:'not_paid'});
  assert.equal(calls.length,0);
});
