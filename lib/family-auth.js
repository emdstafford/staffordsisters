import {createClient} from '@supabase/supabase-js';

// Membership stays tied to a signed-in Supabase user with a real family_profiles
// row. The fallback checks the same row with that user's own JWT, which avoids
// false "not family" errors when an administrator lookup is unavailable.
export async function verifyFamilyMember(admin,user,token){
 if(!user?.id||!token)return {ok:false,reason:'sign_in'};
 const primary=await admin.from('family_profiles')
  .select('user_id').eq('user_id',user.id).maybeSingle();
 if(primary.data?.user_id===user.id)return {ok:true};

 const url=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_PUBLISHABLE_KEY;
 let fallback=null;
 if(url&&key){
  const memberDb=createClient(url,key,{
   auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
   global:{headers:{Authorization:'Bearer '+token}}
  });
  fallback=await memberDb.from('family_profiles')
   .select('user_id').eq('user_id',user.id).maybeSingle();
  if(fallback.data?.user_id===user.id)return {ok:true};
 }
 if(primary.error||fallback?.error){
  console.error('Family membership lookup failed',{
   adminCode:primary.error?.code||null,
   memberCode:fallback?.error?.code||null
  });
  return {ok:false,reason:'lookup',code:primary.error?.code||fallback?.error?.code||'unknown'};
 }
 return {ok:false,reason:'profile_missing'};
}

export function membershipError(reply,result){
 if(result.reason==='sign_in')return reply.status(401).json({error:'Your sign-in has expired. Please sign in again.'});
 if(result.reason==='profile_missing')return reply.status(403).json({
  error:'Your login is valid, but your family profile is missing. Ask Mama to check this account in Stafford Sisters.'
 });
 return reply.status(503).json({
  error:'Your account signed in successfully, but the family profile lookup failed. Please ask Mama to check the Supabase profile permissions.',
  code:String(result.code||'unknown').slice(0,25)
 });
}
