import {randomUUID} from 'node:crypto';
import {adminClient} from '../lib/push-core.js';
import {verifyFamilyMember,membershipError} from '../lib/family-auth.js';

const BUCKET='shorts-media';
const allowed=new Map([
 ['jpg','image/jpeg'],['jpeg','image/jpeg'],['png','image/png'],
 ['webp','image/webp'],['heic','image/heic'],['heif','image/heif'],
 ['mp4','video/mp4'],['mov','video/quicktime'],['webm','video/webm']
]);
const musicChoices=new Set(['none','sunshine','starlight','cozy','sparkle','dance','adventure','chill','funky']);
const PATH_RX=/^[0-9a-f-]{36}\/short-[0-9a-f-]{36}\.(jpg|jpeg|png|webp|heic|heif|mp4|mov|webm)$/i;
const fail=(res,code,message)=>res.status(code).json({error:message});
const arrayOfPaths=raw=>{
 if(!raw||typeof raw!=='string')return [];
 if(raw[0]==='['){try{const p=JSON.parse(raw);return Array.isArray(p)&&p.every(x=>typeof x==='string')?p:[]}catch{return []}}
 return [raw];
};
async function getUser(req,db,res){
 const token=(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1];
 if(!token){fail(res,401,'Sign in to Stafford Sisters first.');return null}
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user){fail(res,401,'Your sign-in expired. Sign in again.');return null}
 const check=await verifyFamilyMember(db,user,token);
 if(!check.ok){membershipError(res,check);return null}
 return user;
}
async function fetchPost(db,id){
 const {data,error}=await db.from('shorts').select('id,user_id,media_path').eq('id',id).maybeSingle();
 if(error)throw error;
 return data;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST'].includes(req.method))return fail(res,405,'Method not allowed.');
 let db;
 try{db=adminClient()}catch{return fail(res,503,'Shorts server is not configured yet.')}
 try{
  const me=await getUser(req,db,res);
  if(!me)return;
  if(req.method==='GET'){
   const {data,error}=await db.from('shorts')
    .select('id,user_id,caption,media_path,media_type,music_track,created_at,shorts_reactions(id,user_id,reaction),shorts_comments(id,user_id,body,created_at)')
    .order('created_at',{ascending:false}).limit(100);
   if(error)throw error;
   const shorts=await Promise.all((data||[]).map(async s=>{
    const paths=arrayOfPaths(s.media_path).slice(0,6);
    const media=await Promise.all(paths.map(async path=>{
     if(!PATH_RX.test(path))return null;
     const {data:link,error:linkError}=await db.storage.from(BUCKET).createSignedUrl(path,3600);
     if(linkError)return null;
     return {url:link.signedUrl,path};
    }));
    return {
     id:s.id,user_id:s.user_id,caption:s.caption,media_type:s.media_type,music_track:s.music_track,created_at:s.created_at,
     media:media.filter(Boolean),
     shorts_reactions:s.shorts_reactions||[],
     shorts_comments:(s.shorts_comments||[]).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))
    };
   }));
   return res.status(200).json({shorts});
  }
  const body=req.body||{},action=body.action;
  if(action==='prepare'){
   const files=body.files;
   if(!Array.isArray(files)||files.length<1||files.length>6)
    return fail(res,400,'Choose one video or up to six pictures.');
   let types=[],total=0;
   for(const file of files){
    const ext=String(file?.name||'').split('.').pop().toLowerCase();
    const mime=allowed.get(ext);
    if(!mime|| !Number.isSafeInteger(file?.size)||file.size<1||file.size>50*1024*1024)
     return fail(res,400,'A file is unsupported or too large (50 MB limit).');
    if(file.type && file.type!=='application/octet-stream'&&file.type!==mime)
     return fail(res,400,'The selected file format does not match its name.');
    total+=file.size;
    types.push(mime.startsWith('video/')?'video':'image');
   }
   if(total>50*1024*1024)return fail(res,400,'Please keep the whole Short under 50 MB.');
   if(types.includes('video')&&(files.length>1||types[0]!=='video'))
    return fail(res,400,'Add one video, or a group of photos—not both.');
   const uploads=[];
   for(const f of files){
    const ext=String(f.name).split('.').pop().toLowerCase();
    const path=me.id+'/short-'+randomUUID()+'.'+ext;
    const {data,error}=await db.storage.from(BUCKET).createSignedUploadUrl(path);
    if(error)throw error;
    uploads.push({path,token:data.token});
   }
   return res.status(200).json({uploads,mediaType:types[0]});
  }
  if(action==='create'){
   const paths=body.paths,mediaType=body.mediaType;
   const caption=String(body.caption||'').trim();
   if(!Array.isArray(paths)||paths.length<1||paths.length>6||
     paths.some(p=>typeof p!=='string'||!PATH_RX.test(p)||!p.startsWith(me.id+'/'))||
     new Set(paths).size!==paths.length||caption.length>1200||
     !['image','video'].includes(mediaType)||
     (mediaType==='video'&&paths.length!==1)||!musicChoices.has(body.track))
    return fail(res,400,'Short details were not valid. Please select the media again.');
   if(paths.some(p=>mediaType==='video'?!/\.(mp4|mov|webm)$/i.test(p):!/\.(jpg|jpeg|png|webp|heic|heif)$/i.test(p)))
    return fail(res,400,'The selected files do not match this Short.');
   const {data,error}=await db.from('shorts').insert({
    user_id:me.id,caption,media_path:paths.length===1?paths[0]:JSON.stringify(paths),
    media_type:mediaType,music_track:body.track
   }).select('id').single();
   if(error)throw error;
   return res.status(201).json({ok:true,id:data.id});
  }
  if(action==='react'){
   const id=String(body.id||''),reaction=body.reaction;
   if(!/^[0-9a-f-]{36}$/i.test(id)||!['like','heart'].includes(reaction))
    return fail(res,400,'Invalid reaction.');
   if(!await fetchPost(db,id))return fail(res,404,'That Short is no longer available.');
   const {data:existing,error:lookErr}=await db.from('shorts_reactions')
    .select('id,reaction').eq('short_id',id).eq('user_id',me.id).maybeSingle();
   if(lookErr)throw lookErr;
   let result;
   if(existing?.reaction===reaction)result=await db.from('shorts_reactions').delete().eq('id',existing.id).eq('user_id',me.id);
   else if(existing)result=await db.from('shorts_reactions').update({reaction}).eq('id',existing.id).eq('user_id',me.id);
   else result=await db.from('shorts_reactions').insert({short_id:id,user_id:me.id,reaction});
   if(result.error)throw result.error;
   return res.status(200).json({ok:true});
  }
  if(action==='comment'){
   const id=String(body.id||''),comment=String(body.comment||'').trim();
   if(!/^[0-9a-f-]{36}$/i.test(id)||!comment||comment.length>1000)
    return fail(res,400,'Please write a shorter comment.');
   if(!await fetchPost(db,id))return fail(res,404,'That Short is no longer available.');
   const {error}=await db.from('shorts_comments').insert({short_id:id,user_id:me.id,body:comment});
   if(error)throw error;
   return res.status(201).json({ok:true});
  }
  if(action==='delete'){
   const id=String(body.id||'');
   if(!/^[0-9a-f-]{36}$/i.test(id))return fail(res,400,'Invalid Short.');
   const post=await fetchPost(db,id);
   if(!post)return fail(res,404,'That Short is already gone.');
   if(post.user_id!==me.id)return fail(res,403,'Only the creator can delete this Short.');
   const {data,error}=await db.from('shorts').delete().eq('id',id).eq('user_id',me.id).select('id');
   if(error)throw error;
   if(!data?.length)return fail(res,403,'Could not delete this Short.');
   const paths=arrayOfPaths(post.media_path).filter(x=>PATH_RX.test(x)&&x.startsWith(me.id+'/'));
   if(paths.length)await db.storage.from(BUCKET).remove(paths);
   return res.status(200).json({ok:true});
  }
  return fail(res,400,'Unrecognized Shorts action.');
 }catch(e){
  console.error('Shorts API issue',e?.code||'unknown',e?.message||'');
  const dbDenied=/permission|row.level|policy/i.test(String(e?.message||''));
  return fail(res,503,dbDenied?'Shorts database permissions still need attention.':'Shorts could not finish the request. Please try again.');
 }
}
