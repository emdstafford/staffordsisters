import {createClient} from '@supabase/supabase-js';
const url=process.env.SUPABASE_URL;
const service=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
export default async function handler(req,res){
 if(req.method!=='POST'&&req.method!=='DELETE')return res.status(405).json({error:'Method not allowed'});
 if(!url||!service)return res.status(503).json({error:'Push setup incomplete'});
 const token=(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1];
 if(!token)return res.status(401).json({error:'Sign in required'});
 const db=createClient(url,service,{auth:{persistSession:false}});
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user)return res.status(401).json({error:'Invalid session'});
 const {subscription,endpoint}=req.body||{};
 const target=subscription?.endpoint||endpoint;
 if(typeof target!=='string'||!target.startsWith('https://')||target.length>2048)return res.status(400).json({error:'Invalid subscription'});
 if(req.method==='DELETE'){
  const {error:e}=await db.from('push_subscriptions').delete().eq('user_id',user.id).eq('endpoint',target);
  return e?res.status(500).json({error:'Could not remove subscription'}):res.status(200).json({ok:true});
 }
 if(!subscription?.keys?.auth||!subscription?.keys?.p256dh)return res.status(400).json({error:'Invalid push keys'});
 const {error:e}=await db.from('push_subscriptions').upsert({user_id:user.id,endpoint:target,subscription},{onConflict:'endpoint'});
 return e?res.status(500).json({error:'Could not save subscription'}):res.status(200).json({ok:true});
}
