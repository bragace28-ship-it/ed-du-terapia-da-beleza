type NeonClient=any

declare global {
  interface Window {
    __EDDU_NEON_READY?: Promise<NeonClient>
    __EDDU_SB?: NeonClient
  }
}

const ready=async():Promise<NeonClient>=>{
  if(window.__EDDU_SB)return window.__EDDU_SB
  if(window.__EDDU_NEON_READY)return await window.__EDDU_NEON_READY
  throw new Error('Neon production bridge não inicializado.')
}

function query(table:string){
  const calls:Array<[string,any[]]>=[]
  const chain:any={}
  chain.then=(resolve:any,reject?:any)=>ready()
    .then((client:any)=>{
      let q:any=client.from(table)
      for(const [method,args] of calls) q=q[method](...args)
      return q
    })
    .then(resolve,reject)
  chain.catch=(reject:any)=>chain.then((v:any)=>v,reject)
  chain.finally=(fn:any)=>chain.then((v:any)=>{fn?.();return v},(e:any)=>{fn?.();throw e})
  return new Proxy(chain,{
    get(target,prop:string|symbol){
      if(prop in target)return target[prop as keyof typeof target]
      if(typeof prop!=='string')return undefined
      return (...args:any[])=>{calls.push([prop,args]);return chain}
    },
  })
}

const auth={
  getSession:()=>ready().then((c:any)=>c.auth.getSession()),
  getUser:()=>ready().then((c:any)=>c.auth.getUser()),
  signInWithPassword:(args:any)=>ready().then((c:any)=>c.auth.signInWithPassword(args)),
  signUp:(args:any)=>ready().then((c:any)=>c.auth.signUp(args)),
  signOut:()=>ready().then((c:any)=>c.auth.signOut()),
  onAuthStateChange:(callback:any)=>{
    let active=true
    let subscription:any=null
    ready().then((c:any)=>{
      if(!active)return
      const result=c.auth.onAuthStateChange(callback)
      subscription=result?.data?.subscription||result?.subscription||result
    }).catch(()=>{})
    return {data:{subscription:{unsubscribe:()=>{active=false;try{subscription?.unsubscribe?.()}catch{}}}}}
  },
}

export const supabase:any={
  auth,
  from:(table:string)=>query(table),
  rpc:(name:string,args?:any)=>ready().then((c:any)=>c.rpc(name,args||{})),
}
