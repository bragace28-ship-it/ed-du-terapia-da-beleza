export interface GatewayConfig {
  id: string; name: string; pixFeePercent: number; pixFeeFixed: number;
  cardCreditFeePercent: number; cardCreditFeeFixed: number; installmentsFeePercent: number; active: boolean
}
export interface GatewayRankingResult { gatewayId:string; gatewayName:string; grossAmount:number; feeTotal:number; netAmount:number; isBestOption:boolean }
export const GATEWAYS_CONFIG: GatewayConfig[] = [
  {id:'pagbank',name:'PagBank',pixFeePercent:.99,pixFeeFixed:0,cardCreditFeePercent:3.19,cardCreditFeeFixed:.40,installmentsFeePercent:1.5,active:true},
  {id:'asaas',name:'Asaas',pixFeePercent:.99,pixFeeFixed:0,cardCreditFeePercent:2.99,cardCreditFeeFixed:.49,installmentsFeePercent:1.2,active:true},
  {id:'stripe',name:'Stripe',pixFeePercent:1.19,pixFeeFixed:0,cardCreditFeePercent:3.99,cardCreditFeeFixed:.50,installmentsFeePercent:2,active:true},
  {id:'picpay',name:'PicPay',pixFeePercent:.89,pixFeeFixed:0,cardCreditFeePercent:3.49,cardCreditFeeFixed:0,installmentsFeePercent:1.8,active:true},
  {id:'nubank_link',name:'Nubank (Link/Pix)',pixFeePercent:0,pixFeeFixed:0,cardCreditFeePercent:2.79,cardCreditFeeFixed:0,installmentsFeePercent:1,active:true},
]
export function calculateBestPaymentGateway(grossAmount:number,paymentMethod:'PIX'|'CREDIT_CARD',installments=1,configs=GATEWAYS_CONFIG):GatewayRankingResult[]{
  const amount=Math.max(0,Number(grossAmount)||0), count=Math.max(1,Math.floor(installments))
  const results=configs.filter(g=>g.active).map(g=>{
    let fee=0
    if(paymentMethod==='PIX') fee=amount*(g.pixFeePercent/100)+g.pixFeeFixed
    else fee=amount*((g.cardCreditFeePercent+(count>1?(count-1)*g.installmentsFeePercent:0))/100)+g.cardCreditFeeFixed
    const feeTotal=Number(fee.toFixed(2)); const netAmount=Number((amount-feeTotal).toFixed(2))
    return {gatewayId:g.id,gatewayName:g.name,grossAmount:amount,feeTotal,netAmount,isBestOption:false}
  })
  results.sort((a,b)=>b.netAmount-a.netAmount||a.feeTotal-b.feeTotal); if(results[0]) results[0].isBestOption=true; return results
}
