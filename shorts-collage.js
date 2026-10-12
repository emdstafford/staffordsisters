// Stafford Sisters Collage Wall: private gallery of existing Loop and photo Shorts.
// No extra tables or public media endpoints; signed photo URLs come from existing auth.
export function initShortsCollage({supabase,getMe,profileFor,signedUrl,stopShorts,onShowShorts}){
 const el=id=>document.getElementById(id);
 const root=el('shorts'),panel=el('shorts-collage-panel'),toggle=el('shorts-collage-toggle');
 if(!root||!panel||!toggle)return {isOpen:()=>false,show:()=>{},close:()=>{}};
 const wall=el('collage-wall'),status=el('collage-status'),note=el('collage-note'),count=el('collage-count');
 const more=el('collage-more'),viewer=el('collage-viewer'),viewerImg=el('collage-viewer-img');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const PAGE_SIZE=100;
 let open=false,photos=[],source='all',loopOffset=0,hasMoreLoop=true,loadingLoop=false,
  loadingShorts=false,shortsUnavailable=false,shortsLoaded=false,loaded=false,lastLoaded=0,loadEpoch=0,activeIndex=-1;
 function labelFor(userId){
  const p=profileFor(userId);
  return p?.display_name||'Family';
 }
 function addPhotos(arr){
  const existing=new Set(photos.map(p=>p.key));
  for(const p of arr){if(!existing.has(p.key)&&p.url){photos.push(p);existing.add(p.key)}}
  photos.sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0));
  render();
 }
 function visiblePhotos(){return source==='all'?photos:photos.filter(p=>p.source===source)}
 function render(){
  const visible=visiblePhotos();
  count.textContent=visible.length+' '+(visible.length===1?'photo':'photos');
  el('collage-source-filters').querySelectorAll('button[data-collage-source]').forEach(b=>{
   const selected=b.dataset.collageSource===source;
   b.classList.toggle('selected',selected);
   b.setAttribute('aria-pressed',String(selected));
  });
  wall.innerHTML=visible.length?visible.map((p,i)=>
   '<button class="collage-tile collage-tile-'+(i%7)+'" data-collage-photo="'+esc(p.key)+'" type="button" aria-label="View photo from '+esc(p.author)+'">'+
    '<img src="'+esc(p.url)+'" alt="'+esc((p.caption||'Family photo').slice(0,100))+'" loading="lazy" referrerpolicy="no-referrer">'+
    '<span class="collage-photo-tag">'+(p.source==='shorts'?'🎬 Short':'💕 Loop')+'</span>'+
   '</button>'
  ).join(''):'<div class="collage-empty">📷<strong>'+(
   loadingLoop||loadingShorts?'Gathering family memories…':
   source==='shorts'&&shortsUnavailable?'Shorts photos will show here when Shorts permissions are fixed.':
   source==='shorts'?'No photo Shorts posted yet.':
   source==='loop'?'No Loop pictures found yet.':
   'Your family collage is waiting for its first picture!')+
   '</strong><span>Photos already shared with the family will appear here automatically.</span></div>';
  more.hidden=!hasMoreLoop||source==='shorts';
  more.disabled=loadingLoop;
  more.textContent=loadingLoop?'Loading older pictures…':'＋ Load older Loop pictures';
  if(loadingLoop||loadingShorts){
   status.textContent='✨ Putting your collage together…';
  }else{
   status.textContent=photos.length?'A little wall of family memories 💕':'';
  }
  note.textContent=shortsUnavailable?
   '💜 Loop photos are ready! Shorts photos will join them once Mama finishes fixing Shorts permissions.':
   shortsLoaded?'🔒 Only family members who are signed in can see these pictures.':
   '🔒 Family-only pictures. Your collage shows photos from The Loop.';
 }
 async function loadLoopPage(epoch){
  if(loadingLoop||!hasMoreLoop||!getMe())return;
  loadingLoop=true;render();
  try{
   const {data,error}=await supabase.from('loop_posts')
    .select('id,user_id,body,image_path,created_at')
    .not('image_path','is',null)
    .order('created_at',{ascending:false})
    .range(loopOffset,loopOffset+PAGE_SIZE-1);
   if(epoch!==loadEpoch)return;
   if(error)throw error;
   const rows=(data||[]).filter(p=>p.image_path);
   loopOffset+=(data||[]).length;
   hasMoreLoop=(data||[]).length===PAGE_SIZE;
   const signed=[];
   // Limit concurrent signed-link requests to keep loading gentle on phones.
   for(let i=0;i<rows.length;i+=10){
    const batch=await Promise.all(rows.slice(i,i+10).map(async p=>{
     try{
      const url=await signedUrl('loop-photos',p.image_path);
      if(!url)return null;
      return {key:'loop:'+p.id,url,source:'loop',user_id:p.user_id,
       author:labelFor(p.user_id),caption:p.body||'',created_at:p.created_at};
     }catch{return null}
    }));
    if(epoch!==loadEpoch)return;
    signed.push(...batch.filter(Boolean));
   }
   if(epoch!==loadEpoch)return;
   addPhotos(signed);
  }catch(err){
   if(epoch!==loadEpoch)return;
   hasMoreLoop=false;
   note.textContent='The Loop photos could not load right now. Try Refresh.';
  }finally{
   if(epoch===loadEpoch){loadingLoop=false;render()}
  }
 }
 async function loadShortsPhotos(epoch){
  if(loadingShorts||!getMe())return;
  loadingShorts=true;render();
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session)throw Error('Please sign in again.');
   const response=await fetch('/api/shorts',{cache:'no-store',
    headers:{Authorization:'Bearer '+session.access_token}});
   if(!response.ok)throw Error('Shorts unavailable');
   const result=await response.json();
   if(epoch!==loadEpoch)return;
   const incoming=[];
   for(const p of result.shorts||[]){
    if(p.media_type!=='image'||!Array.isArray(p.media))continue;
    p.media.forEach((m,i)=>{
     if(!m||typeof m.url!=='string')return;
     incoming.push({key:'shorts:'+p.id+':'+i,url:m.url,source:'shorts',
      user_id:p.user_id,author:labelFor(p.user_id),caption:p.caption||'',created_at:p.created_at});
    });
   }
   shortsLoaded=true;shortsUnavailable=false;addPhotos(incoming);
  }catch{
   if(epoch!==loadEpoch)return;
   shortsUnavailable=true;shortsLoaded=false;
  }finally{
   if(epoch===loadEpoch){loadingShorts=false;render()}
  }
 }
 async function refresh(){
  if(!getMe())return;
  loadEpoch++;
  const epoch=loadEpoch;
  photos=[];loopOffset=0;hasMoreLoop=true;loadingLoop=false;loadingShorts=false;
  shortsUnavailable=false;shortsLoaded=false;loaded=true;lastLoaded=Date.now();
  render();
  // Each source works independently; the Shorts database can still be unavailable.
  await Promise.allSettled([loadLoopPage(epoch),loadShortsPhotos(epoch)]);
 }
 function show(){
  if(!getMe())return;
  open=true;
  root.classList.add('collage-open');
  panel.hidden=false;
  toggle.textContent='🎬 Shorts';
  toggle.setAttribute('aria-pressed','true');
  stopShorts?.();
  if(!loaded||Date.now()-lastLoaded>50*60*1000)refresh();
  else render();
 }
 function close(){
  open=false;closeViewer();
  root.classList.remove('collage-open');
  panel.hidden=true;
  toggle.textContent='🖼️ Collage';
  toggle.setAttribute('aria-pressed','false');
  onShowShorts?.();
 }
 function closeViewer(){
  viewer.hidden=true;
  viewerImg.removeAttribute('src');
  activeIndex=-1;
 }
 function updateViewer(){
  const available=visiblePhotos();
  if(activeIndex<0||activeIndex>=available.length){closeViewer();return}
  const p=available[activeIndex];
  viewerImg.src=p.url;
  viewerImg.alt=(p.caption||'Family photo')+' by '+p.author;
  el('collage-viewer-caption').textContent=p.caption||'💕 A family memory';
  el('collage-viewer-meta').textContent=p.author+' · '+(p.source==='shorts'?'Shorts':'The Loop')+
   (p.created_at?' · '+new Date(p.created_at).toLocaleDateString():'');
  el('collage-viewer-counter').textContent=(activeIndex+1)+' of '+available.length;
  el('collage-viewer-prev').disabled=activeIndex===0;
  el('collage-viewer-next').disabled=activeIndex===available.length-1;
 }
 function openViewer(key){
  const available=visiblePhotos();
  const i=available.findIndex(p=>p.key===key);
  if(i<0)return;
  activeIndex=i;viewer.hidden=false;updateViewer();
  el('collage-viewer-close').focus();
 }
 toggle.onclick=()=>open?close():show();
 el('collage-refresh').onclick=refresh;
 el('collage-source-filters').onclick=e=>{
  const b=e.target.closest('[data-collage-source]');
  if(!b)return;
  source=b.dataset.collageSource;
  closeViewer();render();
 };
 more.onclick=()=>loadLoopPage(loadEpoch);
 wall.onclick=e=>{
  const tile=e.target.closest('[data-collage-photo]');
  if(tile)openViewer(tile.dataset.collagePhoto);
 };
 el('collage-viewer-close').onclick=closeViewer;
 el('collage-viewer-prev').onclick=()=>{activeIndex--;updateViewer()};
 el('collage-viewer-next').onclick=()=>{activeIndex++;updateViewer()};
 viewer.addEventListener('click',e=>{if(e.target===viewer)closeViewer()});
 document.addEventListener('keydown',e=>{
  if(!open||viewer.hidden)return;
  if(e.key==='Escape')closeViewer();
  else if(e.key==='ArrowLeft'&&activeIndex>0){activeIndex--;updateViewer()}
  else if(e.key==='ArrowRight'&&activeIndex<visiblePhotos().length-1){activeIndex++;updateViewer()}
 });
 render();
 return {show,close,isOpen:()=>open,onEnter:()=>{if(open&&Date.now()-lastLoaded>50*60*1000)refresh()}};
}
