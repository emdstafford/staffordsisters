import {adminClient,sendPush} from '../lib/push-core.js';
import {verifyFamilyMember,membershipError} from '../lib/family-auth.js';

// A test push does not require a readable notification history. Background
// delivery still requires the server-only push_subscriptions table grants.
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{
  const token=(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1];
  if(!token)return res.status(401).json({error:'Please sign in again.'});
  const db=adminClient();
  const auth=await db.auth.getUser(token);
  const user=auth?.data?.user;
  if(auth?.error||!user)return res.status(401).json({error:'Please sign in again.'});
  const family=await verifyFamilyMember(db,user,token);
  if(!family.ok)return membershipError(res,family);

  let unreadCount=0;
  try{
   const {count,error}=await db.from('family_notifications')
    .select('id',{head:true,count:'exact'}).eq('recipient_id',user.id).is('read_at',null);
   if(error){
    console.warn('Push test unread count unavailable',error.code||'unknown');
   }else unreadCount=count||0;
  }catch(error){
   console.warn('Push test unread count could not be checked',error?.code||'unknown');
  }
  const result=await sendPush(db,user.id,{
   title:'Stafford Sisters 💕',
   body:'Test notification! Background alerts are connected. 🔔',
   url:'/?notifications=1',
   tag:'stafford-self-test',
   unreadCount
  });
  if(result.missing)return res.status(409).json({error:'This account has no registered push devices yet. Turn on background alerts first.'});
  if(result.delivered<1)return res.status(502).json({error:'The phone could not receive the alert. Try turning background alerts off and on again, then send another test.'});
  return res.status(200).json({ok:true,delivered:result.delivered});
 }catch(e){
  const code=typeof e?.code==='string'?e.code:'unknown';
  const reason=String(e?.message||'').slice(0,180);
  console.error('Family push test failed',{code,reason:reason||'(no error message)',kind:typeof e});
  if(code==='42501'||/permission denied/i.test(reason))
   return res.status(503).json({error:'Push database permissions need a fix by Mama. Background phone alerts cannot send until that is done.'});
  if(/VAPID|missing.*key|configuration/i.test(reason))
   return res.status(503).json({error:'The phone notification server keys need to be checked by Mama.'});
  return res.status(503).json({error:'The phone notification server could not finish the test. Ask Mama to check the notification setup.'});
 }
}
