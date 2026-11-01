/* Idempotent ledger settlement shared by provider webhooks and NuPay return checks. */
export async function recordGatewaySettlement(sql, payment) {
  if (!payment?.id) throw new Error('payment_id_required');
  const status = String(payment.status || '').toUpperCase();
  if (!['PAID', 'RECEIVED', 'CONFIRMED'].includes(status)) return { settled: false, reason: 'not_paid' };

  const commandId = payment.command_id || null;
  let clientId = payment.client_id || null;
  let command = null;
  if (commandId) {
    const rows = await sql`select id, client_id, total from public.commands where id = ${commandId} limit 1`;
    command = rows[0] || null;
    if (!command) throw new Error('command_not_found_for_payment');
    clientId = clientId || command.client_id || null;
  }

  const metadata = {
    source: 'payment_gateway',
    payment_id: String(payment.id),
    gateway: payment.gateway || null,
    method: payment.method || null,
    external_id: payment.external_id || null,
    idempotency_key: payment.idempotency_key || null
  };
  const description = 'Recebimento da comanda ' + (commandId || 'avulso') + ' via ' + (payment.gateway || 'gateway');
  await sql`
    insert into public.financial_transactions
      (type, direction, command_id, client_id, description, amount, paid_at, status, category, metadata)
    select 'sale', 'in', ${commandId}, ${clientId}, ${description},
      ${Number(payment.amount || 0)}, coalesce(${payment.paid_at || null}::timestamptz, now()),
      'paid', 'Recebimentos de serviços', ${JSON.stringify(metadata)}::jsonb
    where not exists (
      select 1 from public.financial_transactions
      where metadata->>'payment_id' = ${String(payment.id)}
    )
    on conflict ((metadata->>'payment_id')) where (metadata ? 'payment_id') do nothing
  `;

  if (commandId && command) {
    const sums = await sql`
      select coalesce(sum(amount), 0) as total
      from public.payments
      where command_id = ${commandId}
        and upper(status) in ('PAID', 'RECEIVED', 'CONFIRMED')
    `;
    const paidTotal = Number(sums[0]?.total || 0);
    const commandTotal = Number(command.total || 0);
    if (commandTotal > 0 && paidTotal + 0.009 >= commandTotal) {
      await sql`
        update public.commands
        set status = 'closed',
            closed_at = coalesce(closed_at, now()),
            updated_at = now()
        where id = ${commandId} and status <> 'closed'
      `;
    }
  }
  return { settled: true, command_id: commandId };
}
