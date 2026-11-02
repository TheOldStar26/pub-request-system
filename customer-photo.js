/* Personal phone page only: no kiosk credential, no inactivity reset, no persistent photo storage. */
(function () {
 'use strict';
 let photo=null,stream=null,attempt=0;
 const enabled=window.OLDSTAR_PHONE?.selfiesEnabled===true;
 const $=id=>document.getElementById(id),status=text=>{$('selfie-status').textContent=text;};
 function stop(){attempt++;if(stream){stream.getTracks().forEach(track=>track.stop());stream=null;}$('selfie-video').srcObject=null;$('selfie-video').hidden=true;$('selfie-capture').hidden=true;}
 function remove(){stop();photo=null;$('selfie-preview').removeAttribute('src');$('selfie-preview').hidden=true;$('selfie-remove').hidden=true;$('selfie-retake').hidden=true;$('selfie-take').hidden=false;status('No photo attached.');}
 async function take(){
  if(!enabled)return;
  stop();const current=attempt;status('Allow camera access if prompted.');
  if(!navigator.mediaDevices?.getUserMedia){status('Camera capture is unavailable. You can still send a request without a selfie.');return;}
  try{
   const candidate=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});
   if(current!==attempt){candidate.getTracks().forEach(track=>track.stop());return;}
   stream=candidate;$('selfie-video').srcObject=stream;$('selfie-video').hidden=false;$('selfie-preview').hidden=true;$('selfie-capture').hidden=false;$('selfie-take').hidden=true;
   await $('selfie-video').play();status('Tap Capture selfie when ready.');
  }catch{status('Camera unavailable or permission denied. Skip the selfie and send your request normally.');}
 }
 $('selfie-take').onclick=take;$('selfie-retake').onclick=()=>{remove();take();};$('selfie-remove').onclick=remove;
 $('selfie-capture').onclick=()=>{
  if(!enabled)return;
  const video=$('selfie-video');if(!video.videoWidth)return;
  const canvas=document.createElement('canvas'),scale=Math.min(1,640/Math.max(video.videoWidth,video.videoHeight));
  canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
  const candidate=canvas.toDataURL('image/jpeg',0.72);canvas.width=canvas.height=1;
  if(!candidate.startsWith('data:image/jpeg;base64,') || candidate.length>350000){status('Photo is too large. Retake it or skip the selfie.');stop();return;}
  stop();photo=candidate;$('selfie-preview').src=photo;$('selfie-preview').hidden=false;$('selfie-remove').hidden=false;$('selfie-retake').hidden=false;$('selfie-take').hidden=true;status('Selfie ready. Only authorised DJ staff can view it.');
 };
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',remove);
 if(!enabled)$('selfie-heading').parentElement.hidden=true;
 window.OldstarPhonePhoto={get:()=>photo,clear:remove,stop,lock:locked=>{stop();for(const id of ['selfie-take','selfie-capture','selfie-retake','selfie-remove'])$(id).disabled=locked;}};
}());
