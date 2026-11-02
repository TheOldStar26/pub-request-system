/* Deliberately ES5: Chrome 36 / Android 4.4. No customer data is persisted. */
(function () {
  'use strict';
  var config = window.OLDSTAR_KIOSK || {}, token = '', type = 'song', photo = null;
  var stream = null, videoURL = null, epoch = 0, xhr = null, pending = null;
  var idle = null, successTimer = null, lastActivity = new Date().getTime(), active = 'welcome', cameraTimer = null;
  var cameraAttempt = 0, imageAttempt = 0;
  var URLapi = window.URL || window.webkitURL;
  function $(id) { return document.getElementById(id); }
  function text(id, value) { $(id).textContent = value; }
  function visible(id, yes) { if (config.selfiesEnabled !== true && /^(take|capture|retake|remove|file-button|camera-box)$/.test(id)) { yes = false; } $(id).style.display = yes ? 'block' : 'none'; }
  function show(screen) {
    var screens = ['welcome', 'details', 'photo', 'thanks'], i;
    for (i = 0; i < screens.length; i++) { visible(screens[i], screens[i] === screen); }
    active = screen; window.scrollTo(0, 0); lastActivity = new Date().getTime();
  }
  function stop(s) {
    var tracks, i;
    if (!s) { return; }
    if (s.getTracks) { tracks = s.getTracks(); for (i = 0; i < tracks.length; i++) { tracks[i].stop(); } }
    else if (s.stop) { s.stop(); }
  }
  function stopCamera() {
    cameraAttempt++; clearTimeout(cameraTimer); stop(stream); stream = null;
    $('video').pause(); $('video').src = '';
    if ('srcObject' in $('video')) { $('video').srcObject = null; }
    if (videoURL && URLapi) { URLapi.revokeObjectURL(videoURL); videoURL = null; }
    visible('video', false); visible('capture', false);
  }
  function removePhoto() {
    imageAttempt++; photo = null; $('preview').removeAttribute('src'); $('file').value = '';
    visible('preview', false); visible('placeholder', true); visible('remove', false); visible('retake', false);
    text('send', config.selfiesEnabled === true ? 'Skip selfie & send request →' : 'Send request →'); visible('take', true);
  }
  function reset() {
    epoch++; if (xhr) { xhr.abort(); xhr = null; }
    clearTimeout(successTimer); stopCamera(); removePhoto(); pending = null;
    $('request-form').reset(); text('validation', ''); text('submission', ''); text('camera-status', '');
    $('back').disabled = false; $('send').disabled = false; visible('file-button', false); show('welcome');
  }
  function id() {
    var c = window.crypto || window.msCrypto, a = new Uint8Array(16), out = '', i;
    if (!c || !c.getRandomValues) { throw new Error('Secure random IDs are unavailable. Please ask staff.'); }
    c.getRandomValues(a); a[6] = (a[6] & 15) | 64; a[8] = (a[8] & 63) | 128;
    for (i = 0; i < 16; i++) { if (i === 4 || i === 6 || i === 8 || i === 10) { out += '-'; } out += ('0' + a[i].toString(16)).slice(-2); }
    return out;
  }
  function acceptPhoto(data) {
    if (config.selfiesEnabled !== true) { return; }
    if (!/^data:image\/jpeg;base64,/.test(data) || data.length > 350000) { throw new Error('Photo is too large. Retake it or skip the selfie.'); }
    photo = data; stopCamera(); $('preview').src = photo;
    visible('preview', true); visible('placeholder', false); visible('take', false); visible('retake', true); visible('remove', true);
    text('send', 'Send request with selfie →'); text('camera-status', 'Check your preview. Retake or remove it whenever you like.');
  }
  function encodeImage(image, width, height) {
    var scale = Math.min(1, 640 / Math.max(width, height)), canvas = document.createElement('canvas'), result;
    canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    result = canvas.toDataURL('image/jpeg', 0.72); canvas.width = 1; canvas.height = 1; return result;
  }
  function fallback() {
    stopCamera(); visible('take', true); text('camera-status', config.fileCapture ? 'Live camera unavailable. Try Open tablet camera, or skip the selfie.' : 'Live camera unavailable. You can skip the selfie and still send your request.');
    visible('file-button', !!config.fileCapture);
  }
  function take() {
    if (config.selfiesEnabled !== true) { return; }
    var e = epoch, attempt, gum = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    stopCamera(); attempt = cameraAttempt; text('camera-status', 'Allow the camera if prompted. Choose the front camera if offered.');
    function ok(s) {
      if (e !== epoch || attempt !== cameraAttempt || active !== 'photo' || pending) { stop(s); return; }
      clearTimeout(cameraTimer); stream = s;
      if ('srcObject' in $('video')) { $('video').srcObject = s; }
      else { videoURL = URLapi.createObjectURL(s); $('video').src = videoURL; }
      visible('video', true); visible('placeholder', false); visible('preview', false); visible('take', false); visible('capture', true);
      $('video').play(); text('camera-status', 'Smile, then tap Use this photo.');
    }
    function fail() { if (e === epoch && attempt === cameraAttempt) { fallback(); } }
    cameraTimer = setTimeout(function () { if (e === epoch && attempt === cameraAttempt) { fallback(); } }, 20000);
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({video: {facingMode: 'user', width: {ideal: 640}, height: {ideal: 480}}, audio: false}).then(ok, fail);
    } else if (gum) {
      /* Chrome 36 sourceId is needed to select a front camera reliably. */
      if (window.MediaStreamTrack && window.MediaStreamTrack.getSources) {
        window.MediaStreamTrack.getSources(function (sources) {
          var source = null, i;
          if (e !== epoch || attempt !== cameraAttempt) { return; }
          for (i = 0; i < sources.length; i++) { if (sources[i].kind === 'video' && sources[i].facing === 'user') { source = sources[i].id; break; } }
          gum.call(navigator, {video: source ? {optional: [{sourceId: source}], mandatory: {maxWidth: 640, maxHeight: 480}} : true, audio: false}, ok, fail);
        });
      } else { gum.call(navigator, {video: true, audio: false}, ok, fail); }
    } else { fail(); }
  }
  function send() {
    var e = epoch, data, requestId;
    if (xhr) { return; }
    if (!config.endpoint || (!token && !config.demo && !config.localGateway)) { text('submission', 'This kiosk needs staff setup. Your request has not been sent.'); return; }
    stopCamera();
    if (!pending) {
      data = {type: type, name: $('name').value.replace(/^\s+|\s+$/g, ''), title: $('title').value.replace(/^\s+|\s+$/g, ''), artist: $('artist').value.replace(/^\s+|\s+$/g, '') || null, message: $('message').value.replace(/^\s+|\s+$/g, '') || null};
      if (!data.name || !data.title) { show('details'); text('validation', 'Please enter your name and song title.'); return; }
      try { requestId = id(); } catch (error) { text('submission', error.message); return; }
      pending = JSON.stringify({action: 'submit', submissionId: requestId, request: data, photo: config.selfiesEnabled === true ? photo : null});
    }
    $('send').disabled = true; $('back').disabled = true;
    visible('take', false); visible('retake', false); visible('remove', false); visible('file-button', false);
    text('submission', 'Sending your request…');
    xhr = new XMLHttpRequest(); xhr.open('POST', config.endpoint, true); xhr.timeout = 25000;
    xhr.setRequestHeader('Content-Type', 'application/json'); xhr.setRequestHeader('apikey', config.publishableKey || 'demo'); xhr.setRequestHeader('X-Oldstar-Kiosk-Token', token || 'demo');
    function failed(message) { if (e !== epoch) { return; } xhr = null; $('send').disabled = false; text('send', 'Retry this request'); text('submission', message); }
    xhr.onload = function () {
      var result = {}; if (e !== epoch) { return; }
      try { result = JSON.parse(xhr.responseText); } catch (ignore) {}
      if (xhr.status >= 200 && xhr.status < 300 && result.id) {
        reset(); show('thanks'); successTimer = setTimeout(reset, 6000);
      } else if (xhr.status === 429) { failed('The kiosk is busy. Please wait a minute, then retry.'); }
      else if (xhr.status === 401 || xhr.status === 403) { failed('Kiosk access has expired or been disabled. Please ask staff.'); }
      else { failed('We could not confirm submission. Tap Retry to check/send the SAME request. Please do not start it again.'); }
    };
    xhr.onerror = xhr.ontimeout = function () { failed('Connection lost. Your request may have arrived. Retry checks the same request and will not add a duplicate.'); };
    xhr.send(pending);
  }
  function start(value) { reset(); type = value; text('form-title', value === 'karaoke' ? 'Sing karaoke' : 'Request music'); show('details'); $('name').focus(); }
  $('fullscreen').onclick = function () { var el = document.documentElement, fn = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen; if (fn) { try { fn.call(el); } catch (ignore) { text('setup', 'Fullscreen needs tablet support. Ask staff.'); } } else { text('setup', 'Fullscreen is unavailable in this browser. Ask staff.'); } };
  $('start-song').onclick = function () { start('song'); }; $('start-karaoke').onclick = function () { start('karaoke'); };
  $('request-form').onsubmit = function (event) { event.preventDefault(); if (!$('name').value.replace(/\s/g, '') || !$('title').value.replace(/\s/g, '')) { text('validation', 'Please enter your name and song title.'); return; } show('photo'); };
  $('take').onclick = take; $('retake').onclick = function () { removePhoto(); take(); };
  $('remove').onclick = function () { stopCamera(); removePhoto(); text('camera-status', 'Photo removed.'); };
  $('capture').onclick = function () { if (!$('video').videoWidth) { text('camera-status', 'Camera is starting. Please wait a moment.'); return; } try { acceptPhoto(encodeImage($('video'), $('video').videoWidth, $('video').videoHeight)); } catch (error) { text('camera-status', error.message); } };
  $('file-button').onclick = function () { $('file').click(); };
  $('file').onchange = function () {
    if (config.selfiesEnabled !== true) { this.value = ''; return; }
    var f = this.files && this.files[0], e = epoch, job = ++imageAttempt, reader, image;
    if (!f) { return; }
    if (!/^image\/(jpeg|png)$/.test(f.type) || f.size > 5 * 1024 * 1024) { text('camera-status', 'Use a JPEG or PNG photo smaller than 5 MB, or skip.'); this.value = ''; return; }
    reader = new FileReader(); reader.onload = function () {
      if (e !== epoch || job !== imageAttempt || active !== 'photo' || pending) { return; } image = new Image();
      image.onload = function () { if (e !== epoch || job !== imageAttempt || active !== 'photo' || pending) { return; } try { acceptPhoto(encodeImage(image, image.width, image.height)); } catch (error) { text('camera-status', error.message); } image.src = ''; reader = null; };
      image.onerror = function () { if (e === epoch) { text('camera-status', 'That photo could not be read. Retake or skip.'); } }; image.src = reader.result;
    }; reader.readAsDataURL(f); this.value = '';
  };
  $('send').onclick = send; $('back').onclick = function () { if (!pending) { stopCamera(); show('details'); } };
  $('cancel-details').onclick = $('cancel-photo').onclick = $('next').onclick = reset;
  function activity() { if (active !== 'welcome') { lastActivity = new Date().getTime(); } }
  document.addEventListener('touchstart', activity, false); document.addEventListener('mousedown', activity, false); document.addEventListener('keydown', activity, false); document.addEventListener('input', activity, false);
  document.addEventListener('visibilitychange', function () { if (document.hidden) { reset(); } }, false);
  window.addEventListener('pagehide', reset, false); window.addEventListener('pageshow', reset, false);
  idle = setInterval(function () { if (active !== 'welcome' && new Date().getTime() - lastActivity >= 90000) { reset(); } }, 1000);
  try {
    var fragment = /^#kiosk=([0-9a-f]{64})$/.exec(window.location.hash);
    if (fragment) { token = fragment[1]; localStorage.setItem('oldstar_kiosk_credential_v1', token); window.history.replaceState(null, '', window.location.pathname); }
    else { token = localStorage.getItem('oldstar_kiosk_credential_v1') || ''; }
  } catch (ignore) { text('setup', 'Device storage is unavailable. Ask staff to provision this kiosk.'); }
  if (config.selfiesEnabled !== true) {
    text('details-next', 'Next: review & send →'); text('photo-title', 'Ready to send?');
    text('photo-intro', 'Your request will wait for DJ approval.'); text('photo-privacy', 'Selfies are currently disabled.');
    visible('camera-box', false);
  }
  visible('demo', !!config.demo);
  if (!config.endpoint) { text('setup', 'Awaiting staff setup. Submissions are disabled.'); }
  reset();
}());
