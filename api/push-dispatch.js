import {timingSafeEqual} from 'node:crypto';
import {adminClient,dispatchPending,dailyMaintenance} from '../lib/push-core.js';
import {verifyFamilyMember,membershipError} from '../lib/family-auth.js';

const safeEqual=(a,b)=>{
 const x=Buffer.from(a||''),y=Buffer.from(b||'');
 return x.length===y.length&&timingSafeEqual(x,y);
};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'&&req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 let db;
 try{db=adminClient()}catch(e){return res.status(503).json({error:'Push server database connection not configured'})}
 try{
  if(req.method==='GET'){
   const secret=process.env.CRON_SECRET;
   const token=(req.headers.authorization||'').match(/^Bearer (.*)$/)?.[1];
   if(!secret||!token||!safeEqual(token,secret))return res.status(401).json({error:'Unauthorized'});
   const push=await dispatchPending(db,{limit:50});
   const maintenance=await dailyMaintenance(db);
   return res.status(200).json({ok:true,push,maintenance});
  }
  const token=(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1];
  if(!token)return res.status(401).json({error:'Sign in required'});
  const {data:{user},error}=await db.auth.getUser(token);
  if(error||!user)return res.status(401).json({error:'Invalid session'});
  const family=await verifyFamilyMember(db,user,token);
  if(!family.ok)return membershipError(res,family);
  const push=await dispatchPending(db,{actorId:user.id,limit:30});
  return res.status(200).json({ok:true,push});
 }catch(e){
  console.error('Push dispatch failed:',e?.code||e?.message||'unknown');
  return res.status(500).json({error:'Could not process family push alerts'});
 }
}
