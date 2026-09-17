import {describe,expect,it} from 'vitest'
import {calculateBestPaymentGateway} from '../src/lib/paymentEngine'
describe('payment engine',()=>{it('ranks PIX by highest net',()=>{const r=calculateBestPaymentGateway(1000,'PIX');expect(r[0].gatewayId).toBe('nubank_link');expect(r[0].isBestOption).toBe(true);expect(r[0].netAmount).toBe(1000)});it('applies installment fees',()=>{const r=calculateBestPaymentGateway(1000,'CREDIT_CARD',3);expect(r).toHaveLength(5);expect(r[0].netAmount).toBeGreaterThanOrEqual(r.at(-1)!.netAmount)})})
