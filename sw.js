/* Stafford Sisters PWA: notification and badge handling. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{}}catch{data={title:'Stafford Sisters',body:event.data?.text()||'New family update'}}
 event.waitUntil((async()=>{
  if(Number.isFinite(Number(data.unreadCount))&&data.unreadCount!==undefined){
   const count=Math.max(0,Number(data.unreadCount));
   try{if(count&&self.navigator?.setAppBadge)await self.navigator.setAppBadge(count);else if(self.navigator?.clearAppBadge)await self.navigator.clearAppBadge()}catch{}
  }
  await self.registration.showNotification(data.title||'Stafford Sisters 💕',{
   body:data.body||'There is something new in The Loop.',
   icon:'/stafford-sisters-icon.png',
   badge:'/stafford-sisters-icon.png',
   tag:data.tag||'stafford-sisters-update',
   data:{url:data.url||'/'}
  });
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const url=new URL(event.notification.data?.url||'/',self.location.origin);
  if(url.origin!==self.location.origin)return;
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=clients.find(c=>new URL(c.url).origin===url.origin);
  if(existing){await existing.focus();existing.navigate(url.href);return}
  await self.clients.openWindow(url.href);
 })());
});
