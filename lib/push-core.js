import {createClient} from '@supabase/supabase-js';
import webpush from 'web-push';

export function adminClient(){
 const url=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error('Server configuration missing SUPABASE_SECRET_KEY');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

export function configurePush(){
 const key=process.env.VAPID_PUBLIC_KEY,privateKey=process.env.VAPID_PRIVATE_KEY;
 if(!key||!privateKey)throw new Error('Server configuration missing VAPID keys');
 webpush.setVapidDetails('https://stafford-sisters.vercel.app',key,privateKey);
}

const asDate=x=>new Date(x).toISOString();
function noSecretError(err){console.error('push delivery error',err?.statusCode||err?.code||err?.message||err)}

export async function sendPush(db,recipient,payload){
 const {data:subs,error}=await db.from('push_subscriptions').select('id,endpoint,subscription')
   .eq('user_id',recipient).limit(20);
 if(error)throw error;
 if(!subs?.length)return {delivered:0,missing:true};
 configurePush();
 let delivered=0;
 await Promise.all(subs.map(async s=>{
  try{
   await webpush.sendNotification(s.subscription,JSON.stringify(payload),{TTL:86400});
   delivered++;
  }catch(e){
   if(e?.statusCode===404||e?.statusCode===410){
    await db.from('push_subscriptions').delete().eq('endpoint',s.endpoint).eq('user_id',recipient);
   }else noSecretError(e);
  }
 }));
 return {delivered,missing:false};
}
async function unreadCounts(db,recipient){
 const {count,error}=await db.from('family_notifications').select('id',{head:true,count:'exact'})
  .eq('recipient_id',recipient).is('read_at',null);
 if(error)throw error;
 return count||0;
}
export async function dispatchPending(db,{actorId=null,limit=35}={}){
 let query=db.from('family_notifications')
  .select('id,recipient_id,actor_id,category,item_id,message,created_at')
  .is('push_sent_at',null)
  .order('created_at',{ascending:true})
  .limit(limit);
 if(actorId)query=query.eq('actor_id',actorId).gte('created_at',new Date(Date.now()-10*60000).toISOString());
 const {data:events,error}=await query;
 if(error)throw error;
 let attempted=0,sent=0;
 const countCache=new Map();
 for(const event of events||[]){
  attempted++;
  try{
   if(!countCache.has(event.recipient_id))countCache.set(event.recipient_id,await unreadCounts(db,event.recipient_id));
   const count=countCache.get(event.recipient_id);
   const payload={
    title:'Stafford Sisters 💕',
    body:event.message,
    url:'/?notification='+encodeURIComponent(event.id),
    tag:'stafford-'+event.id,
    unreadCount:count
   };
   const result=await sendPush(db,event.recipient_id,payload);
   if(result.delivered||result.missing){
    await db.from('family_notifications').update({push_sent_at:new Date().toISOString()}).eq('id',event.id);
    sent+=result.delivered>0?1:0;
   }
  }catch(e){noSecretError(e)}
 }
 return {attempted,deliveredEvents:sent};
}
export async function dailyMaintenance(db){
 const cutoff=new Date(Date.now()-7*86400000).toISOString();
 // A read item disappears 7 days after creation, not 7 days after reading.
 const {error:cleanupError}=await db.from('family_notifications').delete()
  .not('read_at','is',null).lt('created_at',cutoff);
 if(cleanupError)throw cleanupError;
 const {data:overdue,error}=await db.from('family_notifications')
  .select('id,recipient_id').is('read_at',null).is('reminder_sent_at',null)
  .lt('created_at',cutoff).limit(500);
 if(error)throw error;
 const byRecipient=new Map();
 for(const n of overdue||[])byRecipient.set(n.recipient_id,[...(byRecipient.get(n.recipient_id)||[]),n.id]);
 let reminders=0;
 for(const [recipient,ids] of byRecipient){
  try{
   const count=await unreadCounts(db,recipient);
   const result=await sendPush(db,recipient,{
    title:'Stafford Sisters 💕',
    body:"Don't forget to read your notifications!",
    url:'/?notifications=1',
    tag:'stafford-overdue-'+recipient,
    unreadCount:count
   });
   if(result.delivered){
    const {error:updateError}=await db.from('family_notifications')
      .update({reminder_sent_at:new Date().toISOString()}).in('id',ids).eq('recipient_id',recipient);
    if(updateError)throw updateError;
    reminders++;
   }
  }catch(e){noSecretError(e)}
 }
 return {reminders,overdueItems:(overdue||[]).length};
}
