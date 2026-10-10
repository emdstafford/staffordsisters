import {createClient} from '@supabase/supabase-js';
import webpush from 'web-push';
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).end();
 const secret=process.env.PUSH_SEND_SECRET;
 if(!secret||req.headers.authorization!=='Bearer '+secret)return res.status(401).json({error:'Unauthorized'});
 const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY,VAPID_SUBJECT}=process.env;
 if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY||!VAPID_PUBLIC_KEY||!VAPID_PRIVATE_KEY||!VAPID_SUBJECT)return res.status(503).json({error:'Push setup incomplete'});
 const {userIds,title,body,url='/'}=req.body||{};
 if(!Array.isArray(userIds)||!userIds.length||userIds.length>20||userIds.some(x=>typeof x!=='string'))return res.status(400).json({error:'Invalid recipients'});
 const db=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const {data,error}=await db.from('push_subscriptions').select('endpoint,subscription,user_id').in('user_id',userIds);
 if(error)return res.status(500).json({error:'Could not load subscriptions'});
 webpush.setVapidDetails(VAPID_SUBJECT,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY);
 let sent=0;
 for(const item of data||[]){
  try{await webpush.sendNotification(item.subscription,JSON.stringify({title:String(title||'Stafford Sisters').slice(0,80),body:String(body||'New family update').slice(0,180),url:String(url).startsWith('/')?url:'/'}));sent++}
  catch(e){if(e.statusCode===404||e.statusCode===410)await db.from('push_subscriptions').delete().eq('endpoint',item.endpoint)}
 }
 return res.status(200).json({sent});
}
