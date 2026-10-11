import {adminClient,sendPush} from '../lib/push-core.js';
import {verifyFamilyMember,membershipError} from '../lib/family-auth.js';

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{
  const token=(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1];
  if(!token)return res.status(401).json({error:'Please sign in again.'});
  const db=adminClient();
  const {data:{user},error:authError}=await db.auth.getUser(token);
  if(authError||!user)return res.status(401).json({error:'Please sign in again.'});
  const family=await verifyFamilyMember(db,user,token);
  if(!family.ok)return membershipError(res,family);
  const {count,error:countError}=await db.from('family_notifications')
    .select('id',{head:true,count:'exact'}).eq('recipient_id',user.id).is('read_at',null);
  if(countError)throw countError;
  const result=await sendPush(db,user.id,{
   title:'Stafford Sisters 💕',
   body:'Test notification! Background alerts are connected. 🔔',
   url:'/?notifications=1',
   tag:'stafford-self-test',
   unreadCount:count||0
  });
  if(result.missing)return res.status(409).json({error:'This account has no registered push devices yet. Turn on background alerts first.'});
  if(result.delivered<1)return res.status(502).json({error:'The iPhone subscription is no longer working. Turn alerts off and on again.'});
  return res.status(200).json({ok:true,delivered:result.delivered});
 }catch(e){
  console.error('Family push test failed:',e?.code||e?.message||'unknown');
  return res.status(503).json({error:'Could not send the test notification. Check the push server configuration.'});
 }
}
