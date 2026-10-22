(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e={},t=t=>typeof t==`string`&&e[t]||t,n=e=>e&&typeof e==`object`?Object.fromEntries(Object.entries(e).map(([e,n])=>[t(e),n])):e;function r(e){return{...e,amp:t(e.amp),pedals:Array.isArray(e.pedals)?e.pedals.map(e=>e&&{...e,id:t(e.id)}):e.pedals,fx:n(e.fx)}}function i(e){return{...e,amp:t(e.amp),ampKnobs:n(e.ampKnobs),board:Array.isArray(e.board)?e.board.map(e=>e&&{...e,id:t(e.id)}):e.board,pedalKnobs:n(e.pedalKnobs),fx:n(e.fx)}}function a(e,t,n){try{let r=localStorage.getItem(t)??localStorage.getItem(e);if(r===null)return;localStorage.setItem(t,JSON.stringify(n(JSON.parse(r))))}catch{}}async function o(e,t,n,r){if(!(`indexedDB`in globalThis)||!indexedDB.databases)return;let i=(await indexedDB.databases()).map(e=>e.name);if(!i.includes(e)||i.includes(t))return;let a=e=>new Promise((t,i)=>{let a=indexedDB.open(e,1);a.onupgradeneeded=()=>{a.result.objectStoreNames.contains(n)||a.result.createObjectStore(n,{keyPath:r})},a.onsuccess=()=>t(a.result),a.onerror=()=>i(a.error)}),o=await a(e),s=await new Promise((e,t)=>{let r=o.transaction(n,`readonly`).objectStore(n).getAll();r.onsuccess=()=>e(r.result),r.onerror=()=>t(r.error)});o.close();let c=await a(t);await new Promise((e,t)=>{let r=c.transaction(n,`readwrite`);for(let e of s)r.objectStore(n).put(e);r.oncomplete=()=>e(),r.onerror=()=>t(r.error)}),c.close()}async function s(){a(`phreakrig.settings.v1`,`phreakguitar.settings.v1`,e=>i(e)),a(`phreakrig.presets.v1`,`phreakguitar.presets.v1`,e=>Array.isArray(e)?e.map(r):e),a(`phreakrig.pedals.v1`,`phreakguitar.pedals.v1`,e=>Array.isArray(e)?e.map(e=>({...e,parent:t(e.parent)})):e),a(`phreakrig.tabs.v1`,`phreakguitar.tabs.v1`,e=>e);try{await o(`phreakrig`,`phreakguitar`,`irs`,`name`),await o(`phreakrig-tabs`,`phreakguitar-tabs`,`files`,`name`)}catch{}}var c=s(),l=`modulepreload`,u=function(e){return`/`+e},d={},f=function(e){return e.pathname.endsWith(`.css`)},p=function(e,t,n){if(t in e)return e[t];let r=n();if(!r){e[t]=void 0;return}let i=r.then(()=>{e[t]=void 0},n=>{throw e[t]=void 0,n});return e[t]=i,i},m=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){let e,i=document.querySelector(`meta[property=csp-nonce]`),a=i?.nonce||i?.getAttribute(`nonce`);function o(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}function s(e){return import.meta.resolve?new URL(import.meta.resolve(e)):new URL(e,import.meta.url)}r=o(t.map(t=>{t=u(t,n);let r=s(t),i=f(r);return p(d,r.href,()=>{if(e===void 0){e={all:new Set,styles:new Set};let t=document.getElementsByTagName(`link`);for(let n=t.length-1;n>=0;n--){let r=t[n];e.all.add(r.href),r.rel===`stylesheet`&&e.styles.add(r.href)}}if((i?e.styles:e.all).has(r.href))return;let t=document.createElement(`link`);if(t.rel=i?`stylesheet`:l,i||(t.as=`script`),t.crossOrigin=``,t.href=r.href,a&&t.setAttribute(`nonce`,a),document.head.appendChild(t),i)return new Promise((e,n)=>{t.addEventListener(`load`,e),t.addEventListener(`error`,()=>n(Error(`Unable to preload CSS for ${r}`)))})})}).filter(e=>e!==void 0))}function i(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return r.then(t=>{for(let e of t||[])e.status===`rejected`&&i(e.reason);return e().catch(i)})},h=`phc_yqi4FYzwPr44C260DHnrRMuNmRzBNtTplqv1R5leQ83`,g=[`phreakguitar.com`,`www.phreakguitar.com`,`phreakguitar.pages.dev`].includes(location.hostname)&&!new URLSearchParams(location.search).has(`notrack`),_=null,v=[];g&&m(async()=>{let{default:e}=await import(`./module-CoYB0Um1.js`);return{default:e}},[]).then(({default:e})=>{e.init(h,{api_host:`https://us.i.posthog.com`,defaults:`2025-05-24`,persistence:`localStorage`,autocapture:!1,disable_session_recording:!0,respect_dnt:!0,person_profiles:`identified_only`}),_=e;for(let[t,n]of v.splice(0))e.capture(t,n)}).catch(()=>{});function y(e,t,n=!1){g&&(_?_.capture(e,t,n?{transport:`sendBeacon`}:void 0):v.length<100&&v.push([e,t]))}var b=e=>e.split(`:`)[0],x={inputDb:0,drive:1,outputDb:2,gateOn:3,gateDb:4};function ee(e,t){let n=0;for(let r=0;r<16;r++){let i=200*(2500/200)**(r/15),a=2*Math.PI*i/t;for(let t of e){let e=0,r=0;for(let n=0;n<t.length;n++)e+=t[n]*Math.cos(a*n),r-=t[n]*Math.sin(a*n);n+=e*e+r*r}}return n/=16*Math.max(1,e.length),n>1e-12?Math.min(100,Math.max(.01,1/Math.sqrt(n))):1}var te=`/assets/amp-processor-DuUYFEM7.js`,ne=`/assets/loopback-processor-Dbhytz70.js`,S={echoCancellation:!1,noiseSuppression:!1,autoGainControl:!1},re=class e{ctx;onMeters=()=>{};onLooper=()=>{};onPedalActivity=()=>{};onProbe=()=>{};onProbeSet=()=>{};onAmpActivity=()=>{};pedalDevices=Array.from({length:4},()=>[]);ampDevices=[];ampReply=null;stream=null;source=null;splitter=null;tuner=null;pre;post;cab;cabOn=!1;inputChannel=1;engineLatencyFrames=0;lastPre={inputPeak:0,pedalFaults:0,pedalNewtonFailures:0};pedalReplies=Array.from({length:4},()=>[]);captureReplies={};glitches=oe();glitchTimer=0;lagHistory=[];constructor(e,t,n,r){this.ctx=e,this.pre=t,this.post=n,this.engineLatencyFrames=r,this.cab=new ConvolverNode(e,{disableNormalization:!0,channelCount:1,channelCountMode:`explicit`}),this.pre.port.onmessage=e=>{let t=e.data;t.type===`meters`?(this.lastPre=t,t.pedalActivity.forEach((e,t)=>{let n=this.pedalDevices[t];n.length===e.length&&e.length>0&&this.onPedalActivity(t,{devices:n,values:e})}),t.probe&&this.onProbe(t.probe.slot,t.probe.node,t.probe.samples),this.ampDevices.length===t.ampActivity.length&&t.ampActivity.length>0&&this.onAmpActivity({devices:this.ampDevices,values:t.ampActivity,power:t.ampPower,supply:t.ampSupply})):t.type===`amp-loaded`?(this.engineLatencyFrames=t.latency,this.ampDevices=t.devices,this.ampReply?.(t),this.ampReply=null):t.type===`capture`?this.captureReplies.pre?.(t):t.type===`pedal-loaded`?(this.engineLatencyFrames=t.latency,t.error||(this.pedalDevices[t.slot]=t.devices),this.pedalReplies[t.slot].shift()?.(t)):t.type===`latency`?this.engineLatencyFrames=t.latency:t.type===`probe-set`&&this.onProbeSet(t.slot,t.node,t.ok)},this.post.port.onmessage=e=>{e.data.type===`capture`?this.captureReplies.post?.(e.data):e.data.type===`meters`&&(e.data.looper&&this.onLooper(e.data.looper),this.onMeters({inputPeak:this.lastPre.inputPeak,outputPeak:e.data.outputPeak,limiterGain:e.data.limiterGain,pedalFaults:this.lastPre.pedalFaults,pedalNewtonFailures:this.lastPre.pedalNewtonFailures}))},this.cab.connect(this.post),this.post.connect(e.destination),this.setCab(null),this.glitchTimer=window.setInterval(()=>this.checkGlitches(),250)}checkGlitches(){if(this.ctx.state!==`running`){this.glitches.window=[];return}let e=this.ctx.getOutputTimestamp();if(e.contextTime===void 0||e.performanceTime===void 0||e.contextTime<=0)return;let t=e.performanceTime/1e3-e.contextTime;if(this.lagHistory.push(t),this.lagHistory.length>2400&&this.lagHistory.splice(0,1200),performance.now()-this.glitches.startedAt<2e3)return;let n=this.glitches;if(n.window.push(t),n.window.length>ie&&n.window.shift(),n.window.length<ie)return;let r=Math.min(...n.window);!Number.isNaN(n.baseline)&&r-n.baseline>ae&&n.dropouts++,n.baseline=r}glitchStats(){return{dropouts:this.glitches.dropouts,runningSeconds:(performance.now()-this.glitches.startedAt)/1e3}}resetGlitchStats(){this.glitches=oe()}static async start(t){let n=await se(t.inputDeviceId),r=new AudioContext({latencyHint:t.buffer===`low`?0:`interactive`,sampleRate:n});t.onContext?.(r);let i=await fetch(`/engine.wasm`).then(e=>{if(!e.ok)throw Error(`engine.wasm: HTTP ${e.status} (run npm run wasm)`);return e.arrayBuffer()});await r.audioWorklet.addModule(te),await r.audioWorklet.addModule(ne);let a=async(e,t)=>{let n=new AudioWorkletNode(r,`phreak-amp`,{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[t],channelCount:t,channelCountMode:`explicit`,channelInterpretation:`speakers`,processorOptions:{wasmBytes:i.slice(0),stage:e,channels:t}}),a=await new Promise(e=>{n.port.onmessage=t=>e(t.data)});return{node:n,latency:a.type===`ready`?a.latency:0}},o=await a(`pre`,1),s=await a(`post`,2),c=new e(r,o.node,s.node,o.latency);return t.outputDeviceId&&await c.setOutputDevice(t.outputDeviceId),await c.setInput(t.inputDeviceId,t.inputChannel),await r.resume(),c}async setInput(e,t){this.source?.disconnect(),this.splitter?.disconnect(),this.stream?.getTracks().forEach(e=>e.stop()),this.stream=await navigator.mediaDevices.getUserMedia({audio:{...S,deviceId:e?{exact:e}:void 0,channelCount:{ideal:2},latency:{ideal:0}}}),this.source=new MediaStreamAudioSourceNode(this.ctx,{mediaStream:this.stream}),this.splitter=new ChannelSplitterNode(this.ctx,{numberOfOutputs:Math.max(2,this.inputChannelCount())}),this.source.connect(this.splitter),this.inputChannel=Math.min(t,this.inputChannelCount()-1),this.splitter.connect(this.pre,this.inputChannel),this.tuner&&this.splitter.connect(this.tuner,this.inputChannel)}startTuner(){return this.tuner||(this.tuner=new AnalyserNode(this.ctx,{fftSize:4096}),this.splitter?.connect(this.tuner,this.inputChannel)),this.tuner}stopTuner(){if(this.tuner&&this.splitter)try{this.splitter.disconnect(this.tuner)}catch{}this.tuner=null}inputChannelCount(){return this.stream?.getAudioTracks()[0]?.getSettings().channelCount??1}inputLabel(){return this.stream?.getAudioTracks()[0]?.label??``}async setOutputDevice(e){if(!this.ctx.setSinkId)throw Error(`This browser cannot choose an output device (needs Chrome/Edge).`);await this.ctx.setSinkId(e)}setParam(e,t){(e===x.outputDb?this.post:this.pre).port.postMessage({type:`param`,id:e,value:t})}setTone(e,t,n){this.pre.port.postMessage({type:`tone`,treble:e,mid:t,bass:n})}loadPedal(e,t,n){return new Promise(r=>{this.pedalReplies[e].push(e=>r(e.error));let i=new TextEncoder().encode(t);this.pre.port.postMessage({type:`pedal-load`,slot:e,netlist:i,knobs:n})})}loadAmp(e,t){return new Promise(n=>{this.ampReply=e=>n(e.error),this.pre.port.postMessage({type:`amp-load`,netlist:new TextEncoder().encode(e),knobs:t})})}unloadAmp(){this.ampDevices=[],this.pre.port.postMessage({type:`amp-unload`})}setFxEnabled(e,t,n=`post`){this.node(n).port.postMessage({type:`fx-enable`,fx:e,on:t})}setFxControl(e,t,n,r=`post`){this.node(r).port.postMessage({type:`fx-control`,fx:e,index:t,value:n})}node(e){return e===`pre`?this.pre:this.post}setAmpControl(e,t){this.pre.port.postMessage({type:`amp-control`,index:e,value:t})}unloadPedal(e){this.pedalDevices[e]=[],this.pre.port.postMessage({type:`pedal-unload`,slot:e})}setPedalEnabled(e,t){this.pre.port.postMessage({type:`pedal-enable`,slot:e,on:t})}looperEnable(e){this.post.port.postMessage({type:`looper-enable`,on:e})}looperCommand(e){this.post.port.postMessage({type:`looper-cmd`,cmd:e})}looperGain(e){this.post.port.postMessage({type:`looper-gain`,gain:e})}setProbe(e,t){this.pre.port.postMessage({type:`pedal-probe`,slot:e,node:t??``})}setPedalControl(e,t,n){this.pre.port.postMessage({type:`pedal-control`,slot:e,index:t,value:n})}movePedal(e,t){let[n]=this.pedalDevices.splice(e,1);this.pedalDevices.splice(t,0,n),this.pre.port.postMessage({type:`pedal-move`,from:e,to:t})}async capture(){let e=(e,t)=>new Promise(n=>{this.captureReplies[e]=n,t.port.postMessage({type:`capture`})}),[t,n]=await Promise.all([e(`pre`,this.pre),e(`post`,this.post)]),r=Math.min(t.endFrame,n.endFrame),i=e=>e.samples.subarray(0,e.samples.length-(e.endFrame-r)),a=i(t),o=i(n),s=Math.min(a.length,o.length);return{dry:a.subarray(a.length-s),wet:o.subarray(o.length-s),sampleRate:this.ctx.sampleRate,endTime:r/this.ctx.sampleRate}}setCab(e){this.pre.disconnect(),e?(this.cab.buffer=ce(this.ctx,e),this.pre.connect(this.cab)):this.pre.connect(this.post),this.cabOn=e!==null}get cabEnabled(){return this.cabOn}latency(){let e=(this.stream?.getAudioTracks()[0])?.getSettings()?.latency;return{baseMs:this.ctx.baseLatency*1e3,outputMs:(this.ctx.outputLatency??0)*1e3,inputMs:typeof e==`number`?e*1e3:null,engineMs:this.engineLatencyFrames/this.ctx.sampleRate*1e3}}async measureLoopback(){if(!this.splitter)throw Error(`no input`);let e=new AudioWorkletNode(this.ctx,`phreak-loopback`,{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],channelCount:1,channelCountMode:`explicit`});this.post.disconnect(),this.splitter.connect(e,this.inputChannel),e.connect(this.ctx.destination);try{let t=await new Promise(t=>{e.port.onmessage=e=>t(e.data)});if(t.type===`failed`)throw Error(t.reason);let n=[...t.delays].sort((e,t)=>e-t);return n[Math.floor(n.length/2)]/this.ctx.sampleRate*1e3}finally{e.disconnect(),this.splitter.disconnect(e),this.post.connect(this.ctx.destination)}}async stop(){window.clearInterval(this.glitchTimer),this.stream?.getTracks().forEach(e=>e.stop()),await this.ctx.close()}},ie=48,ae=.002;function oe(){return{dropouts:0,startedAt:performance.now(),window:[],baseline:NaN}}async function se(e){let t=Number(new URLSearchParams(location.search).get(`rate`));if(t>=22050&&t<=192e3)return t;let n=await navigator.mediaDevices.getUserMedia({audio:{...S,deviceId:e?{exact:e}:void 0}}),r=n.getAudioTracks()[0]?.getSettings().sampleRate;return n.getTracks().forEach(e=>e.stop()),r&&r>=22050&&r<=192e3?r:void 0}function ce(e,t){let n=1e-4,r=Array.from({length:Math.min(2,t.numberOfChannels)},(e,n)=>t.getChannelData(n)),i=t.length,a=0;for(let e of r){let t=e.findIndex(e=>Math.abs(e)>=n);if(t<0)continue;let r=e.length-1;for(;r>t&&Math.abs(e[r])<n;)r--;i=Math.min(i,t),a=Math.max(a,r+1)}a<=i&&(i=0,a=t.length);let o=ee(r,t.sampleRate),s=new AudioBuffer({numberOfChannels:r.length,length:a-i,sampleRate:e.sampleRate});return r.forEach((e,t)=>{let n=s.getChannelData(t);for(let t=i;t<a;t++)n[t-i]=e[t]*o}),s}var le={disc:`<circle class="knob-body" r="30" /><line class="knob-pointer" x1="0" y1="-12" x2="0" y2="-27" />`,goldcap:`<circle class="knob-skirt" r="31" /><circle class="knob-gold" r="20" />
             <line class="knob-gold-line" x1="0" y1="-6" x2="0" y2="-19" /><line class="knob-skirt-line" x1="0" y1="-22" x2="0" y2="-30" />`,chicken:`<path class="knob-chicken" d="M0 -34 C 8 -24 15 -10 16 4 A 16 16 0 1 1 -16 4 C -15 -10 -8 -24 0 -34 Z" />
            <line class="knob-chicken-line" x1="0" y1="-30" x2="0" y2="-12" />`,skirted:`<circle class="knob-skirt" r="31" /><circle class="knob-knurl" r="19" />
            <line class="knob-skirt-line" x1="0" y1="-21" x2="0" y2="-30" />`},ue=270,de=-135,fe=class{el;onChange=()=>{};v;spec;cap;arc;readout;constructor(e){this.spec=e,this.v=e.value,this.el=document.createElement(`div`),this.el.className=`knob knob-${e.cap??`disc`}`,this.el.innerHTML=`
      <svg viewBox="-50 -50 100 100" aria-hidden="true">
        <path class="knob-track" d="${pe(de,135)}" />
        <path class="knob-arc" />
        <g class="knob-cap">${le[e.cap??`disc`]}</g>
      </svg>
      <div class="knob-label"></div>
      <div class="knob-value"></div>`,this.el.querySelector(`.knob-label`).textContent=e.label,this.el.tabIndex=0,this.el.setAttribute(`role`,`slider`),this.el.setAttribute(`aria-label`,e.label),this.el.setAttribute(`aria-valuemin`,String(e.min)),this.el.setAttribute(`aria-valuemax`,String(e.max)),this.cap=this.el.querySelector(`.knob-cap`),this.arc=this.el.querySelector(`.knob-arc`),this.readout=this.el.querySelector(`.knob-value`),this.bind(),this.render()}get value(){return this.v}set(e,t=!0){let n=this.spec.step??0,r=Math.min(this.spec.max,Math.max(this.spec.min,e));n>0&&(r=Math.round(r/n)*n),r!==this.v&&(this.v=r,this.render(),t&&this.onChange(this.v))}get range(){return this.spec.max-this.spec.min}bind(){let e=0;this.el.addEventListener(`pointerdown`,t=>{this.el.setPointerCapture(t.pointerId),e=t.clientY,this.el.focus()}),this.el.addEventListener(`pointermove`,t=>{if(!this.el.hasPointerCapture(t.pointerId))return;let n=t.shiftKey?800:200;this.set(this.v+(e-t.clientY)/n*this.range),e=t.clientY}),this.el.addEventListener(`dblclick`,()=>this.set(this.spec.defaultValue)),this.el.addEventListener(`wheel`,e=>{e.preventDefault(),this.set(this.v-Math.sign(e.deltaY)*this.range*(e.shiftKey?.005:.02))},{passive:!1}),this.el.addEventListener(`keydown`,e=>{let t=e.shiftKey?.01:.05;if(e.key===`ArrowUp`||e.key===`ArrowRight`)this.set(this.v+this.range*t);else if(e.key===`ArrowDown`||e.key===`ArrowLeft`)this.set(this.v-this.range*t);else if(e.key===`Home`)this.set(this.spec.min);else if(e.key===`End`)this.set(this.spec.max);else return;e.preventDefault()})}render(){let e=(this.v-this.spec.min)/this.range,t=de+e*ue;this.cap.setAttribute(`transform`,`rotate(${t})`),this.arc.setAttribute(`d`,e>.001?pe(de,t):``);let n=this.spec.format?this.spec.format(this.v):this.v.toFixed(1);this.readout.textContent=n,this.el.setAttribute(`aria-valuenow`,String(this.v)),this.el.setAttribute(`aria-valuetext`,n)}};function pe(e,t){let n=e=>{let t=(e-90)*Math.PI/180;return`${(40*Math.cos(t)).toFixed(2)} ${(40*Math.sin(t)).toFixed(2)}`},r=+(t-e>180);return`M ${n(e)} A 40 40 0 ${r} 1 ${n(t)}`}var me=`* Round fuzz: the classic two-transistor silicon (NPN) fuzz, negative ground.
* Classic topology: Q1 common-emitter into Q2, 100k DC feedback from Q2's
* emitter to Q1's base, Fuzz pot sets how much of Q2's emitter resistance
* the 20u cap bypasses. Values follow the common BC108-era build.
*
*@pedal name="Round Fuzz" oversample=4
*@control fuzz label="Fuzz" taper=lin default=1.0
*@control volume label="Volume" taper=audio default=0.6
*@input Vin
*@output out

* The guitar: pickup DC resistance in series with the signal (a round fuzz
* is famously sensitive to what drives it).
Vin src 0 0
Rpickup src in 6k

Vcc vcc 0 DC 9

C1 in b1 2.2u
Q1 c1 b1 0 SI70
R1 vcc c1 33k

Q2 c2 c1 e2 SI120
R2 c2 j 470
R3 j vcc 8.2k
R4 e2 b1 100k

* Fuzz: wiper at the top (pos=1) bypasses all of Q2's emitter resistor.
XFUZZ e2 fw 0 POT R=1k pos={fuzz}
C3 fw 0 20u

C2 j va 10n
XVOL va out 0 POT R=500k pos={volume}
* Amp input impedance.
Rload out 0 1meg

* Silicon small-signal NPNs (BC108-ish) with the classic hFE pairing.
.model SI70  NPN(IS=1.8e-14 BF=70  BR=5)
.model SI120 NPN(IS=1.8e-14 BF=120 BR=5)

* Schematic drawing for the viewer.
*@sch flag 0 352 IN
*@sch sym res 96 336 R90 Rpickup
*@sch wire 80 352 128 352
*@sch sym cap 192 336 R90 C1
*@sch wire 192 352 256 352
*@sch sym npn 256 304 R0 Q1
*@sch wire 320 400 320 432
*@sch flag 320 432 0
*@sch sym res 304 144 R0 R1
*@sch wire 320 128 320 160
*@sch flag 320 128 9V
*@sch wire 320 240 320 304
*@sch wire 320 304 448 304
*@sch sym npn 448 256 R0 Q2
*@sch sym res 496 160 R0 R2
*@sch sym res 496 64 R0 R3
*@sch wire 512 48 512 80
*@sch flag 512 48 9V
*@sch wire 512 160 512 176
*@sch wire 512 176 688 176
*@sch sym cap 752 160 R90 C2
*@sch wire 752 176 816 176
*@sch sym pot 800 160 R0 XVOL
*@sch wire 816 256 816 288
*@sch flag 816 288 0
*@sch wire 864 224 1088 224
*@sch flag 1088 224 OUT
*@sch sym res 960 208 R0 Rload
*@sch wire 976 304 976 336
*@sch flag 976 336 0
*@sch wire 512 352 512 416
*@sch sym pot 496 400 R0 XFUZZ
*@sch wire 512 496 512 528
*@sch flag 512 528 0
*@sch wire 560 464 624 464
*@sch sym cap 608 464 R0 C3
*@sch wire 624 528 624 560
*@sch flag 624 560 0
*@sch wire 224 352 224 624
*@sch wire 224 624 304 624
*@sch sym res 400 608 R90 R4
*@sch wire 384 624 448 624
*@sch wire 448 624 448 384
*@sch wire 448 384 512 384

.subckt POT a w b R=10k pos=0.5
Ra a w {R*(1-pos)+1}
Rb w b {R*pos+1}
.ends

.param fuzz=1.0
.param volume=0.165
.end
`,he=`* Round fuzz, germanium (the 1966-68 originals: AC128 / NKT275): the same
* two-transistor circuit as the silicon one, but PNP germanium on a
* positive ground - the battery's + is ground and the collectors sit at
* -9 V. Germanium's ~0.2 V junctions and softer knee give the warmer,
* rounder fuzz of late-60s and early-70s rock. Q1 common-emitter into Q2,
* 100k DC feedback from Q2's emitter to Q1's base, Fuzz sets how much of
* Q2's emitter resistance the 20u cap bypasses. hFE ~70 / ~120.
* Germanium leakage (which real units are biased around) isn't modelled.
*
*@pedal name="Round Fuzz Ge" oversample=4
*@control fuzz label="Fuzz" taper=lin default=1.0
*@control volume label="Volume" taper=audio default=0.6
*@input Vin
*@output out

* The guitar: pickup DC resistance in series with the signal (a round fuzz
* is famously sensitive to what drives it).
Vin src 0 0
Rpickup src in 6k

* Positive ground: the supply sits 9 V below ground.
Vcc vcc 0 DC -9

C1 in b1 2.2u
Q1 c1 b1 0 GE70
R1 vcc c1 33k

Q2 c2 c1 e2 GE120
R2 c2 j 470
R3 j vcc 8.2k
R4 e2 b1 100k

* Fuzz: wiper at the top (pos=1) bypasses all of Q2's emitter resistor.
XFUZZ e2 fw 0 POT R=1k pos={fuzz}
C3 fw 0 20u

C2 j va 10n
XVOL va out 0 POT R=500k pos={volume}
* Amp input impedance.
Rload out 0 1meg

* Germanium PNPs (AC128-ish): Is set for ~0.2 V Vbe at 1 mA, classic
* hFE pairing.
.model GE70  PNP(IS=4e-7 BF=70  BR=4)
.model GE120 PNP(IS=4e-7 BF=120 BR=4)

* Schematic drawing for the viewer.
*@sch flag 0 352 IN
*@sch sym res 96 336 R90 Rpickup
*@sch wire 80 352 128 352
*@sch sym cap 192 336 R90 C1
*@sch wire 192 352 256 352
*@sch sym pnp 256 304 R0 Q1
*@sch wire 320 400 320 432
*@sch flag 320 432 0
*@sch sym res 304 144 R0 R1
*@sch wire 320 128 320 160
*@sch flag 320 128 -9V
*@sch wire 320 240 320 304
*@sch wire 320 304 448 304
*@sch sym pnp 448 256 R0 Q2
*@sch sym res 496 160 R0 R2
*@sch sym res 496 64 R0 R3
*@sch wire 512 48 512 80
*@sch flag 512 48 -9V
*@sch wire 512 160 512 176
*@sch wire 512 176 688 176
*@sch sym cap 752 160 R90 C2
*@sch wire 752 176 816 176
*@sch sym pot 800 160 R0 XVOL
*@sch wire 816 256 816 288
*@sch flag 816 288 0
*@sch wire 864 224 1088 224
*@sch flag 1088 224 OUT
*@sch sym res 960 208 R0 Rload
*@sch wire 976 304 976 336
*@sch flag 976 336 0
*@sch wire 512 352 512 416
*@sch sym pot 496 400 R0 XFUZZ
*@sch wire 512 496 512 528
*@sch flag 512 528 0
*@sch wire 560 464 624 464
*@sch sym cap 608 464 R0 C3
*@sch wire 624 528 624 560
*@sch flag 624 560 0
*@sch wire 224 352 224 624
*@sch wire 224 624 304 624
*@sch sym res 400 608 R90 R4
*@sch wire 384 624 448 624
*@sch wire 448 624 448 384
*@sch wire 448 384 512 384

.subckt POT a w b R=10k pos=0.5
Ra a w {R*(1-pos)+1}
Rb w b {R*pos+1}
.ends

.param fuzz=1.0
.param volume=0.165
.end
`,ge=`* The classic green overdrive (the '808 circuit): emitter-follower input buffer, op-amp
* clipping amplifier with anti-parallel silicon diodes in its feedback loop,
* 1k/0.22u low-pass, active tone stage, Level pot, emitter-follower output.
* Topology and values follow the original as analysed by ElectroSmash and
* drawn in Barbarach's LTspice model; op-amps are a single-pole macromodel
* (100 dB open-loop gain, ~3 MHz gain-bandwidth, outputs clamp ~1 V from the
* rails), standing in for the JRC4558.
*
*@pedal name="Green Drive" oversample=4
*@control drive label="Drive" taper=audio default=0.3
*@control tone label="Tone" taper=lin default=0.5
*@control level label="Level" taper=audio default=0.8
*@input Vin
*@output out

* The guitar: pickup DC resistance in series with the signal.
Vin src 0 0
Rpickup src in 6k

* Supply and the 4.5 V reference.
Vcc vcc 0 DC 9
R16 vcc vref 10k
R17 vref 0 10k
C9 vref 0 47u

* Input buffer (emitter follower).
R1 in n2 1k
C1 n2 b1 20n
R2 b1 vref 510k
Q1 vcc b1 e1 Q2SC1815
R3 e1 0 10k

* Clipping amplifier: gain 1 + (51k + Drive) / 4.7k, diodes in the loop.
C2 e1 p1 1u
R4 p1 vref 10k
XU1 p1 m1 o1 vcc 0 OPAMP
R6 m1 g1 4.7k
C3 g1 0 47n
C11 o1 m1 51p
D1 m1 o1 D1N4148
D3 o1 m1 D1N4148
R5 m1 dr 51k
* Drive pot wired as a variable resistor (wiper tied to one end).
XDRIVE dr dr o1 POT R=500k pos={drive}

* Tone: 1k/0.22u low-pass into IC1b; the Tone pot runs from IC1b's (-)
* input (pos=1, treble) to its (+) input (pos=0, bass), wiper to 220R + 0.22u.
R7 o1 p2 1k
C6 p2 0 220n
R18 p2 vref 10k
XU2 p2 m2 o2 vcc 0 OPAMP
R8 o2 m2 1k
XTONE m2 tw p2 POT R=20k pos={tone}
C10 tw t2 220n
R9 t2 0 220

* Level and output buffer.
C5 o2 c5 1u
R10 c5 lv 1k
XLEVEL lv lw 0 POT R=100k pos={level}
C7 lw b2 100n
R12 b2 vref 1meg
Q2 vcc b2 e2 Q2SC1815
R13 e2 0 10k
R14 e2 ob 100
C8 ob out 10u
R15 out 0 10k
* Amp input impedance.
Rload out 0 1meg

.model D1N4148 D(IS=2.52n N=1.752 RS=0.568)
.model Q2SC1815 NPN(IS=1e-14 BF=250 BR=3)
.model DCLAMP D(IS=1e-14 N=1)

* Op-amp macromodel: gain stage with a dominant pole at ~30 Hz
* (100k x 30 Hz = 3 MHz GBW), unity buffer, 75R output, rail clamps.
.subckt OPAMP inp inn out vcc vee
E1 g1 0 inp inn 100k
R1 g1 g2 1k
C1 g2 0 5.3u
E2 o1 0 g2 0 1
Rout o1 out 75
Vhi rhi vcc DC -1.5
Vlo rlo vee DC 1.5
Dhi out rhi DCLAMP
Dlo rlo out DCLAMP
.ends

* Schematic drawing for the viewer (laid out for this file; check with tools/check_sch.py).
*@sch flag 0 0 IN
*@sch sym res 96 -16 R90 RPICKUP
*@sch sym res 176 -16 R90 R1
*@sch sym cap 224 -16 R90 C1
*@sch wire 224 0 288 0
*@sch sym res 240 -16 R0 R2
*@sch flag 256 80 Vref
*@sch sym npn 288 -48 R0 Q1
*@sch flag 352 -48 9V
*@sch sym res 336 32 R0 R3
*@sch flag 352 128 0
*@sch wire 352 48 496 48
*@sch sym polcap 560 32 R90 C2
*@sch wire 560 48 640 48
*@sch sym res 576 32 R0 R4
*@sch flag 592 128 Vref
*@sch sym opamp 672 -32 R0 XU1
*@sch wire 672 0 672 -16
*@sch flag 672 -16 9V
*@sch wire 672 64 672 96
*@sch flag 672 96 0
*@sch sym res 656 -64 R90 R6
*@sch sym cap 560 -64 R90 C3
*@sch flag 496 -48 0
*@sch wire 640 16 640 -288
*@sch wire 704 32 880 32
*@sch wire 832 32 832 -288
*@sch sym cap 704 -112 R90 C11
*@sch wire 704 -96 832 -96
*@sch sym diode 656 -144 R270 D1
*@sch wire 640 -160 656 -160
*@sch wire 720 -160 832 -160
*@sch sym diode 720 -240 R90 D3
*@sch wire 640 -224 656 -224
*@sch wire 720 -224 832 -224
*@sch sym res 736 -304 R90 R5
*@sch wire 720 -288 736 -288
*@sch sym pot 720 -272 R270 XDRIVE
*@sch wire 816 -288 832 -288
*@sch wire 784 -336 736 -336
*@sch wire 736 -336 736 -288
*@sch sym res 976 16 R90 R7
*@sch wire 960 32 1216 32
*@sch sym cap 992 32 R0 C6
*@sch flag 1008 96 0
*@sch sym res 1072 16 R0 R18
*@sch flag 1088 112 Vref
*@sch wire 960 32 960 240
*@sch sym opamp 1248 112 M180 XU2
*@sch wire 1248 16 1248 -16
*@sch flag 1248 -16 0
*@sch wire 1248 80 1248 112
*@sch flag 1248 112 9V
*@sch wire 1216 64 1216 240
*@sch sym res 1312 144 R90 R8
*@sch wire 1296 160 1328 160
*@sch wire 1328 48 1328 160
*@sch sym pot 1056 224 R90 XTONE
*@sch wire 1040 240 1216 240
*@sch sym cap 976 288 R0 C10
*@sch sym res 976 336 R0 R9
*@sch flag 992 432 0
*@sch wire 1280 48 1360 48
*@sch sym polcap 1424 32 R90 C5
*@sch sym res 1520 32 R90 R10
*@sch wire 1504 48 1520 48
*@sch sym pot 1504 32 R0 XLEVEL
*@sch flag 1520 128 0
*@sch sym cap 1632 80 R90 C7
*@sch wire 1632 96 1664 96
*@sch sym res 1632 80 R0 R12
*@sch flag 1648 176 Vref
*@sch sym npn 1664 48 R0 Q2
*@sch flag 1728 48 9V
*@sch sym res 1712 128 R0 R13
*@sch flag 1728 224 0
*@sch sym res 1824 128 R90 R14
*@sch sym polcap 1872 128 R90 C8
*@sch wire 1872 144 1904 144
*@sch sym res 1872 128 R0 R15
*@sch flag 1888 224 0
*@sch flag 1904 144 OUT
*@sch sym res 80 224 R0 R16
*@sch flag 96 240 9V
*@sch flag 96 320 Vref
*@sch sym res 80 304 R0 R17
*@sch flag 96 400 0
*@sch wire 96 320 160 320
*@sch sym polcap 144 320 R0 C9
*@sch flag 160 384 0

.subckt POT a w b R=10k pos=0.5
Ra a w {R*(1-pos)+1}
Rb w b {R*pos+1}
.ends

.param drive=0.0612
.param tone=0.5
.param level=0.4896
.end
`,_e=`* The famous gold 'horse' transparent overdrive. Values from the original circuit as published in
* Tiburonboy's symbolic MNA analysis (which splits it into paths for
* superposition; joined back into one circuit here, its AC grounds tied
* to the 4.5 V reference) and ElectroSmash's analysis.
*
* Input buffer -> gain stage whose gain pot is one gang of a dual 100k;
* the other gang pans a clean path into the summing amp, less of it as
* gain rises. Gain-stage output -> 1k -> 1N34A germanium diodes to Vref ->
* summing amp (with two clean paths) -> active treble shelf -> the
* Output pot. TL072s on the charge pump's +18 V / -9 V rails, biased
* at 4.5 V: about +-13 V of swing, the famous clean headroom.
*
*@pedal name="Gold Horse" oversample=4
*@control gain label="Gain" taper=lin default=0.3
*@control treble label="Treble" taper=lin default=0.5
*@control output label="Output" taper=lin default=0.5
*@input Vin
*@output out

* The guitar.
Vin src 0 0
Rpickup src in 6k

* Supplies: 9 V battery, the charge pump's +18 V and -9 V, 4.5 V reference.
Vpos vpos 0 DC 18
Vneg vneg 0 DC -9
Vref vref 0 DC 4.5

* Input buffer.
R1 in n3 10k
C1 n3 ib 100n
R2 ib vref 1meg
XU1A ib bo bo vpos vneg OPAMP

* Gain stage (non-inverting). Gain gang A: ends at the + input's
* shunt (g4) and the feedback leg (g5), wiper on Vref.
C3 bo e3 100n
R6 e3 g4 10k
C5 e3 g4 68n
XGAINA g5 vref g4 POT R=100k pos={gain}
R10 g6 g5 2k
R11 gm g6 15k
C7 gm g6 82n
R12 go gm 422k
C8 go gm 390p
XU1B g4 gm go vpos vneg OPAMP

* Clean path 1 through gain gang B: as gain rises the wiper moves to Vref.
R5 e3 c14 5.1k
C4 e3 c14 68n
R8 c14 vref 1.5k
C6 c14 c15 390n
R9 c15 vref 1k
XGAINB vref c16 c14 POT R=100k pos={gain}

* Clipping: germanium diodes to Vref.
C9 go d9 1u
R13 d9 dclip 1k
D2 dclip vref D1N34A
D3 vref dclip D1N34A
C10 dclip d11 1u

* Summing amplifier (inverting) mixing the clipped path and both clean paths.
R16 d11 sum 47k
C11 d11 d17 2.2n
R15 d17 c16 22k
R17 sum c16 27k
R18 c16 d18 12k
C12 sum d18 27n
R7 e3 c13 1.5k
C16 c13 vref 1u
R24 sum c13 15k
R20 so sum 392k
C13 so sum 820p
XU2A vref sum so vpos vneg OPAMP

* Treble: active high shelf (inverting).
R21 so t4 1.8k
XTREBLE t4 tw t6 POT R=10k pos={treble}
C14 tm tw 3.9n
R22 tm so 100k
R241 to tm 100k
R23 to t6 4.7k
XU2B vref tm to vpos vneg OPAMP

* Output: the treble stage drives the Output pot; 560R and the output cap.
* (The analysis's 68k/100k belong to the bypass path's leakage, not here.)
XOUTPUT to vw vref POT R=10k pos={output}
R25 vw v8 560
C15 v8 out 4.7u
* Amp input impedance.
Rload out 0 1meg

* 1N34A germanium point-contact diode.
.model D1N34A D(IS=2.6u N=1.6 RS=1)
.model DCLAMP D(IS=1e-14 N=1)

* Op-amp macromodel (TL072-ish): 100 dB, ~3 MHz GBW, outputs clamp ~1 V
* from the rails.
.subckt OPAMP inp inn out vcc vee
E1 g1 0 inp inn 100k
R1 g1 g2 1k
C1 g2 0 5.3u
E2 o1 0 g2 0 1
Rout o1 out 75
Vhi rhi vcc DC -1.5
Vlo rlo vee DC 1.5
Dhi out rhi DCLAMP
Dlo rlo out DCLAMP
.ends

.subckt POT a w b R=10k pos=0.5
Ra a w {R*(1-pos)+1}
Rb w b {R*pos+1}
.ends

.param gain=0.3
.param treble=0.5
.param output=0.5
.end
`,ve=`* The classic US four-stage fuzz, 1976-77 'version 3', from
* ElectroSmash's analysis and its parts list: four common-emitter stages
* (2N5088/BC239-class NPNs), two of them clipping through 1N914 pairs,
* and the passive tone stack with its 1 kHz scoop.
* Placement of the last 100k/10k (output-stage base divider) is inferred
* from the parts list: every other part is accounted for.
*
*@pedal name="Ram Fuzz" oversample=4
*@control sustain label="Sustain" taper=lin default=0.6
*@control tone label="Tone" taper=lin default=0.5
*@control volume label="Volume" taper=lin default=0.4
*@input Vin
*@output out

* The guitar.
Vin src 0 0
Rpickup src in 6k

Vcc vcc 0 DC 9

* Input booster (Q1): 39k input, shunt feedback, Miller cap.
C1 in i1 1u
R2 i1 b1 39k
R14 b1 0 47k
Q1 c1 b1 e1 NPN5088
R22 e1 0 100
R13 vcc c1 10k
R9 c1 b1 470k
C10 c1 b1 470p

* Sustain: how hard the clipping stages are hit (1k keeps a floor).
C5 c1 s1 100n
XSUSTAIN s1 sw s2 POT R=100k pos={sustain}
R23 s2 0 1k

* First clipping stage (Q2).
C13 sw i2 100n
R11 i2 b2 10k
R20 b2 0 100k
Q2 c2 b2 e2 NPN5088
R21 e2 0 150
R19 vcc c2 10k
R17 c2 b2 470k
C11 c2 b2 470p
C6 c2 dc2 1u
D1 dc2 b2 D1N914
D2 b2 dc2 D1N914

* Second clipping stage (Q3).
C3 c2 i3 100n
R12 i3 b3 10k
R16 b3 0 100k
Q3 c3 b3 e3 NPN5088
R10 e3 0 150
R6b vcc c3 15k
R15 c3 b3 470k
C12 c3 b3 470p
C7 c3 dc3 1u
D3 dc3 b3 D1N914
D4 b3 dc3 D1N914

* Tone: low-pass (39k/10n) and high-pass (4n/22k) blended by the pot.
R8 c3 lp 39k
C8 lp 0 10n
C9 c3 hp 4n
R5 hp 0 22k
XTONE hp tw lp POT R=100k pos={tone}

* Output stage (Q4): plain common emitter, ~13 dB.
C2 tw b4 100n
R3 vcc b4 100k
R18 b4 0 10k
Q4 c4 b4 e4 NPN5088
R4 e4 0 3.3k
R6 vcc c4 15k
C4 c4 v1 1u
XVOLUME v1 out 0 POT R=100k pos={volume}
* Amp input impedance.
Rload out 0 1meg

.model D1N914 D(IS=2.52n N=1.752 RS=0.568)
.model NPN5088 NPN(IS=1e-14 BF=500 BR=5)

.subckt POT a w b R=10k pos=0.5
Ra a w {R*(1-pos)+1}
Rb w b {R*pos+1}
.ends

.param sustain=0.6
.param tone=0.5
.param volume=0.4
.end
`,ye=`* The classic one-transistor linear power booster: one NPN in common emitter,
* the classic clean boost (gain ~ Rc/Re = 10k/390R, about +28 dB flat out).
* Values per ElectroSmash's analysis of the original: 430k/43k base divider, 10k
* collector, 390R emitter, 100n in and out, 100k Volume. 2N5088 stands in
* for the original 2N5133 (both high-gain small-signal NPNs).
*
*@pedal name="Clean Boost" oversample=4
*@control volume label="Volume" taper=audio default=0.5
*@input Vin
*@output out

* The guitar: pickup DC resistance in series with the signal.
Vin src 0 0
Rpickup src in 6k

Vcc vcc 0 DC 9

C1 in b 100n
R1 vcc b 430k
R2 b 0 43k
Q1 c b e Q2N5088
R3 vcc c 10k
R4 e 0 390

* Volume: the boost's output level into the amp.
C2 c v 100n
XVOLUME v out 0 POT R=100k pos={volume}
* Amp input impedance.
Ramp out 0 1meg

.model Q2N5088 NPN(IS=5.9e-15 BF=600 BR=4)

.subckt POT a w b R=10k pos=0.5
Ra a w {R*(1-pos)+1}
Rb w b {R*pos+1}
.ends

.param volume=0.1545
.end
`,be=`* The 1960s British treble booster: one OC44 germanium PNP in
* common emitter on a positive ground. The tiny 5n input cap passes mostly
* treble and upper mids, so it boosts the top and pushes a British head or class-A combo
* into a fat, cutting lead: Brian May, Tony Iommi, Rory Gallagher, and the
* British blues of the '60s. Values per the original: 5n input, 470k/68k
* base divider, 10k collector, 3.9k emitter with 47u bypass, 10n out,
* Boost 10k at the output.
*
*@pedal name="Treble Booster" oversample=4
*@control boost label="Boost" taper=audio default=0.7
*@input Vin
*@output out

* The guitar: pickup DC resistance in series with the signal.
Vin src 0 0
Rpickup src in 6k

* Positive ground: the supply sits 9 V below ground.
Vcc vcc 0 DC -9

C1 in b 5n
R1 b vcc 470k
R2 b 0 68k
Q1 c b e OC44
R3 c vcc 10k
R4 e 0 3.9k
C2 e 0 47u

* Boost: the output level.
C3 c v 10n
XBOOST v out 0 POT R=10k pos={boost}
* Amp input impedance.
Ramp out 0 1meg

* Germanium PNP (OC44-ish): ~0.2 V Vbe at 1 mA, hFE ~90.
.model OC44 PNP(IS=4e-7 BF=90 BR=4)

.subckt POT a w b R=10k pos=0.5
Ra a w {R*(1-pos)+1}
Rb w b {R*pos+1}
.ends

.param boost=0.3385
.end
`,xe=`* The classic wah (the late-60s V846 circuit), wired as R.G.
* Keen describes it in "The Technology of Wah Pedals". Q1 is a common-
* emitter stage (22k collector, 390R emitter: gain ~36) that biases itself
* from its own collector through 470k / 82k, the current reaching its base
* through the inductor (|| 33k, which sets the Q) and 1.5k; a 4.7u grounds
* the inductor's far end for audio. The rocker pot is a volume divider on
* Q1's collector; Q2, an emitter follower, buffers its wiper and drives a
* 0.01u into the inductor / 1.5k junction: a capacitor whose apparent size
* the pot sets (Miller effect), tuning the inductor's resonance. Output
* from Q1's collector. Later versions' input buffer is left out (the 68k input
* is the classic, slightly tone-sucking original front end).
*
*@pedal name="Classic Wah" oversample=4
*@control wah label="Wah" taper=revaudio default=0.5
*@input Vin
*@output out

* The guitar: pickup DC resistance in series with the signal.
Vin src 0 0
Rpickup src in 6k

Vcc vcc 0 DC 9

* Input: 0.01u and 68k into Q1's base.
C1 in i1 10n
R1 i1 b1 68k

* Q1: common emitter, biased from its own collector.
Q1 c1 b1 e1 QWAH
R3 vcc c1 22k
R4 e1 0 390
R6 c1 t2 470k
R8 t2 0 82k
C3 t2 0 4.7u

* The tank: 1.5k from Q1's base to the junction, then the inductor (with
* ~60R of winding) || 33k down to the bypassed bias node.
R2 b1 t1 1.5k
L1 t1 tl 500m
RL tl t2 60
R7 t1 t2 33k

* The rocker: a volume divider on Q1's collector; Q2 buffers the wiper.
* Lug a is the ground end, so toe down (pos 1) takes the least signal: the
* smallest capacitor, the highest note. The rocker only turns the pot
* through part of its travel; the two fixed resistors stand in for those
* end stops (about 450 Hz heel down, 1.6 kHz toe down).
C4 c1 ptop 220n
RTOP ptop pt 30k
XWAH pb pw pt POT R=100k pos={wah}
RBOT pb 0 3.3k
C6 pw b2 220n
R5 c1 b2 470k
Q2 q2c b2 e2 QWAH
R9 vcc q2c 1k
R10 e2 0 10k
* ... and drives the 0.01u into the tank: the variable capacitor.
C2 e2 t1 10n

* Out from Q1's collector.
C5 c1 out 220n
* Amp input impedance.
Ramp out 0 1meg

* High-gain small-signal NPNs (MPSA18 / BC109 class).
.model QWAH NPN(IS=1e-14 BF=500 BR=4)

.subckt POT a w b R=10k pos=0.5
Ra a w {R*(1-pos)+1}
Rb w b {R*pos+1}
.ends

.param wah=0.8455
.end
`,Se=`* The 1968 photocell vibe: a four-stage phaser built from
* transistor phase splitters, each tuned by a light-dependent resistor
* around one lamp driven by a slow oscillator: the throb of late-60s and
* 70s psychedelic and blues-rock records.
* A DSP model (engine/fx/PhotoVibe.cpp) after the DAFx-19 grey-box paper,
* not a solved circuit: the lamp, LDRs and their housing are measured
* behaviour there too. Chorus mixes the dry signal back in; Vibrato is
* the pure pitch wobble.
*
*@pedal name="Photo Vibe" dsp=photovibe
*@control speed label="Speed" taper=lin default=0.35
*@control intensity label="Intensity" taper=lin default=0.6
*@control volume label="Volume" taper=lin default=0.5
*@control mode label="Mode" taper=lin default=0 positions="Chorus,Vibrato"
`,Ce=`* The classic orange four-stage phaser, 1974 'script' circuit (no R28 feedback resistor), as
* ElectroSmash analyses it. An op-amp input buffer; four all-pass stages,
* each an inverting op-amp with a 47n / 24k high-pass on its + input,
* and a 2N5952 JFET across the 24k as a voltage-controlled resistor (the
* closer its gate gets to pinch-off, the higher the resistance and the
* lower the stage's 90-degree point); a PNP mixer summing the dry signal
* and the four-times-shifted one 50/50, so two notches sweep the band.
*
* The LFO is in the circuit too: U1b is a Schmitt trigger (R19 / R21
* hysteresis) whose square output charges C10 (15u) through the Speed pot
* (470k as a variable resistor); the triangle on C10 comes back to the
* trigger through R24 (C7 smooths the switching). R22 (3M9) couples the
* triangle onto the gates' bias, set by the trimmer through R20 (1M):
* only about a fifth of it reaches the gates, which is all the 2N5952
* needs near pinch-off.
*
* Kept out: the reverse-polarity diode, and the zener (a 5.1 V source
* here: it sits behind 15u, so audio never sees its impedance). The
* trimmer is set for the 2N5952 model below (VTO -2.02 V; LTspice's
* standard.jft); real units are trimmed to their FETs the same way.
* Op-amps: the single-pole macromodel used by the other pedals, on 9 V.
*
*@pedal name="Orange Phaser" oversample=2
*@control speed label="Speed" taper=revaudio default=0.35
*@input Vin
*@output out

* The guitar: pickup DC resistance in series with the signal.
Vin src 0 0
Rpickup src in 6k

* Supply: 9 V for the op-amps, 5.1 V reference (the zener) as their
* virtual ground; the bias trimmer (250k) through R20 to the gates.
Vcc vcc 0 DC 9
Vref vref 0 DC 5.1
RT1 vref tw 112k
RT2 tw 0 138k
R20 tw vbias 1meg
C4 vbias vref 47n

* Input buffer (U1a): R3, C5 (DC block), R14 biasing to Vref.
R3 in i1 10k
C5 i1 ip 10n
R14 ip vref 470k
XU1A ip b0 b0 vcc 0 OPAMP

* Phase stages: out = -in + 2 V(+), V(+) = in through C, to Vref via R || JFET.
R1 b0 m1 10k
R5 m1 s1 10k
C1 b0 p1 47n
R6 p1 vref 24k
J2 p1 vbias vref J2N5952
XU2A p1 m1 s1 vcc 0 OPAMP

R11 s1 m2 10k
R10 m2 s2 10k
C3 s1 p2 47n
R25 p2 vref 24k
J3 p2 vbias vref J2N5952
XU2D p2 m2 s2 vcc 0 OPAMP

R12 s2 m3 10k
R13 m3 s3 10k
C6 s2 p3 47n
R26 p3 vref 24k
J4 p3 vbias vref J2N5952
XU2C p3 m3 s3 vcc 0 OPAMP

R17 s3 m4 10k
R18 m4 s4 10k
C9 s3 p4 47n
R23 p4 vref 24k
J5 p4 vbias vref J2N5952
XU2B p4 m4 s4 vcc 0 OPAMP

* LFO (U1b).
R19 vref lp 150k
R21 lo lp 470k
R24 tri lm 150k
C7 lm lo 10n
XU1B lp lm lo vcc 0 OPAMP
* (R36s: the knob's top end stop. With no resistance left the trigger
* runs at ~40 Hz; this keeps full speed near 15 Hz.)
XSPEED tri spd spd POT R=470k pos={speed}
R36s spd lo 4.7k
C10 tri 0 15u
R22 tri vbias 3.9meg

* Output mixer: PNP common-emitter, R7 collector-base feedback; dry (R16)
* and shifted (R8) summed at the base. C2 / R2 to the output.
R16 b0 qb 150k
R8 s4 qb 150k
R7 qb qc 150k
Q1 qc qb vref Q2N4125
R4 qc 0 56k
C2 qc out 47n
R2 out 0 150k
* Amp input impedance.
Rload out 0 1meg

.model J2N5952 NJF(VTO=-2.021 BETA=1.314m LAMBDA=4m)
.model Q2N4125 PNP(IS=1e-14 BF=200 BR=4)
.model DCLAMP D(IS=1e-14 N=1)

* Op-amp macromodel: gain stage with a dominant pole at ~30 Hz
* (100k x 30 Hz = 3 MHz GBW), unity buffer, 75R output, rail clamps.
.subckt OPAMP inp inn out vcc vee
E1 g1 0 inp inn 100k
R1 g1 g2 1k
C1 g2 0 5.3u
E2 o1 0 g2 0 1
Rout o1 out 75
Vhi rhi vcc DC -1.5
Vlo rlo vee DC 1.5
Dhi out rhi DCLAMP
Dlo rlo out DCLAMP
.ends

.subckt POT a w b R=10k pos=0.5
Ra a w {R*(1-pos)+1}
Rb w b {R*pos+1}
.ends

.param speed=0.35
`,we=`* The first octave-up fuzz (a 1967 design, as traced and sold by a US
* maker in 1973), drawn after Aion FX's Octagon build documentation of
* that circuit. Q1 (PNP) is a high-gain stage: its emitter goes to
* AC ground through 1k, 100u and the Drive pot (1kC as a variable
* resistor: less resistance, more gain), and to DC feedback from Q3's
* collector through 47k. Q2 follows Q1's collector and drives Q3, a
* common-emitter stage (1k2 collector) that drives the transformer's
* 600 ohm winding through 33u. The 1.5k winding is centre-tapped to
* ground, so its two ends swing in opposite directions; a germanium diode
* from each end into the Volume pot lets through only the positive halves
* of both: full-wave rectification, which doubles the frequency (the
* octave up) on top of the fuzz.
*
* The transformer: a 42TM022-type 1.5k CT : 600 ohm part (what nearly every clone uses now),
* from its datasheet: 1.5k CT winding 570 mH / 65 ohm, 600 ohm winding
* 195 mH / 45 ohm, here as three coupled inductors (each half of the
* centre-tapped side a quarter of its inductance) at k = 0.99.
*
* The Octave switch is Aion's mod: Octave (both diodes), Fuzz (one diode,
* the original's crossover-distorted non-octave sound), Fuzz without the
* diode (bypassed by a jumper).
*
*@pedal name="Octave Fuzz" oversample=4
*@control drive label="Drive" taper=revaudio default=0.7
*@control volume label="Volume" taper=audio default=0.6
*@control octave label="Octave" taper=lin default=0 positions="Octave,Fuzz,Clean fuzz"
*@input Vin
*@output out

* The guitar: pickup DC resistance in series with the signal.
Vin src 0 0
Rpickup src in 6k

* Supply: 9 V less the reverse-polarity Schottky, then R11 / C8.
Vcc vs 0 DC 8.7
R11 vs va 100
C8 va 0 100u

* Input: pulldown, coupling cap, RF cap; Q1's base biased from a
* filtered divider (R2 / C3, then R1 820k and R3 680k).
RPD in 0 2.2meg
C1 in b1 100n
C2 b1 0 150p
R2 va bt 180k
C3 bt 0 33u
R1 bt b1 820k
R3 b1 0 680k

* Q1 (PNP gain stage), R5 / C4 high-cut on its collector.
Q1 c1 b1 e1 Q2N3906
R4 c1 0 220k
R5 c1 c4 220
C4 c4 0 1n
R8 e1 ef 1k
C6 ef dr 100u
XDRIVE dr 0 0 POT R=1k pos={drive}
R9 ef c3 47k

* Q2 (follower) into Q3 (common emitter, emitter bypassed).
Q2 va c1 e2 Q2N3904
R6 e2 0 22k
Q3 c3 e2 e3 Q2N3904
R7 e3 0 470
C5 e3 0 220u
R10 va c3 1.2k

* The transformer, 600 ohm side driven, 1.5k CT side rectified.
C7 c3 t6 33u
RS t6 t6i 45
LS t6i 0 195m
RPA p1 p1i 32.5
LPA p1i 0 142.5m
LPB 0 p3i 142.5m
RPB p3i p3 32.5
K1 LS LPA 0.99
K2 LS LPB 0.99
K3 LPA LPB 0.99

* The rectifier and the Octave switch.
D2 p1 o D1N34A
D3 p3 d3 D1N34A
XOCT d3 o SW pos={octave} k=0 n=3
XNOD p1 o SW pos={octave} k=2 n=3

* Volume (500kA) and the amp's input.
XVOL o out 0 POT R=500k pos={volume}
Rload out 0 1meg

.model Q2N3906 PNP(IS=1.41f BF=180.7 BR=4.977)
.model Q2N3904 NPN(IS=6.734f BF=416.4 BR=0.7371)
.model D1N34A D(IS=2.6u N=1.6 RS=1)

.subckt POT a w b R=10k pos=0.5
Ra a w {R*(1-pos)+1}
Rb w b {R*pos+1}
.ends

.subckt SW a b pos=0 k=0 n=2
R1 a b {abs(pos*(n-1)-k) < 0.5 ? 1 : 1e9}
.ends

.param drive=0.8
.param volume=0.17
.param octave=0
`,Te=`* The classic black-box distortion: a non-inverting LM308 stage with up to ~67 dB of gain, hard
* silicon clipping to ground after it, a passive low-pass Filter and an
* output buffer. Values per ElectroSmash's analysis of the original: 22n/1M input,
* 1k/1n RF filter, Distortion 100k (log) || 100p in the feedback loop over
* two RC legs to ground (560R + 4.7u, 47R + 2.2u), 4.7u + 1k into a pair of
* 1N914s, Filter 1.5k + 100k (lin) into 3.3n, Volume 100k (log).
* The LM308 is a single-pole macromodel with ~1 MHz gain-bandwidth (its
* 30 pF compensation): at high Distortion the gain eats the bandwidth, the
* the original's darkening. Its slew-rate limit isn't modelled. The JFET output
* buffer is an ideal unity follower.
*
*@pedal name="Rodent" oversample=4
*@control distortion label="Distortion" taper=audio default=0.5
*@control filter label="Filter" taper=lin default=0.4
*@control volume label="Volume" taper=audio default=0.5
*@input Vin
*@output out

* The guitar: pickup DC resistance in series with the signal.
Vin src 0 0
Rpickup src in 6k

* Supply and the 4.5 V reference.
Vcc vcc 0 DC 9
RA vcc vref 100k
RB vref 0 100k
CR vref 0 47u

* Input: coupling and bias, then an RF filter at the op-amp's input.
C1 in a 22n
R1 a vref 1meg
R2 a p1 1k
C2 p1 0 1n

* Gain stage: 1 + Distortion / (the two RC legs), Distortion || 100p.
XU1 p1 m1 o1 vcc 0 LM308
XDIST m1 m1 o1 POT R=100k pos={distortion}
C3 m1 o1 100p
R3 m1 l1 560
C4 l1 0 4.7u
R4 m1 l2 47
C5 l2 0 2.2u

* Hard clipping to ground.
C6 o1 k 4.7u
R5 k cl 1k
D1 cl 0 D1N914
D2 0 cl D1N914

* Filter: more knob, more resistance, darker.
R6 cl f1 1.5k
XFILTER f1 f1 f2 POT R=100k pos={filter}
C7 f2 0 3.3n

* Output buffer (the JFET source follower, as an ideal follower).
C8 f2 g 22n
R7 g vref 1meg
E1 bo 0 g 0 1
C9 bo vo 1u
XVOLUME vo out 0 POT R=100k pos={volume}
* Amp input impedance.
Ramp out 0 1meg

.model D1N914 D(IS=2.52n N=1.752 RS=0.568)
.model DCLAMP D(IS=1e-14 N=1)

* LM308 macromodel: 100 dB open-loop gain, dominant pole at 10 Hz (1k x
* 15.9u: 1 MHz gain-bandwidth), 75R output, outputs clamp ~1.5 V from the
* rails.
.subckt LM308 inp inn out vcc vee
E1 g1 0 inp inn 100k
R1 g1 g2 1k
C1 g2 0 15.9u
E2 o1 0 g2 0 1
Rout o1 out 75
Vhi rhi vcc DC -1.5
Vlo rlo vee DC 1.5
Dhi out rhi DCLAMP
Dlo rlo out DCLAMP
.ends

.subckt POT a w b R=10k pos=0.5
Ra a w {R*(1-pos)+1}
Rb w b {R*pos+1}
.ends

.param distortion=0.1545
.param filter=0.4
.param volume=0.1545
.end
`;function C(e,t){return{id:e,name:/^\*@pedal\b.*?name="([^"]+)"/im.exec(t)?.[1]??e,netlist:t,controls:[...t.matchAll(/^\*@control\s+(\S+)(.*)$/gim)].map(([,e,t])=>({name:e.toLowerCase(),label:/label="([^"]+)"/i.exec(t)?.[1]??e,defaultValue:Number(/default=([\d.]+)/i.exec(t)?.[1]??.5),positions:/positions="([^"]+)"/i.exec(t)?.[1].split(`,`)}))}}var Ee=[C(`classic-wah`,xe),C(`clean-boost`,ye),C(`treble-boost`,be),C(`round-fuzz`,me),C(`round-fuzz-ge`,he),C(`octave-fuzz`,we),C(`green-drive`,ge),C(`gold-horse`,_e),C(`rodent`,Te),C(`orange-phaser`,Ce),C(`photo-vibe`,Se),C(`ram-fuzz`,ve)],De=`phreakguitar.pedals.v1`;function Oe(){try{let e=JSON.parse(localStorage.getItem(De)??`[]`);return Array.isArray(e)?e.filter(e=>typeof e?.id==`string`&&typeof e?.netlist==`string`):[]}catch{return[]}}function ke(e){try{localStorage.setItem(De,JSON.stringify(e))}catch{}}var Ae=e=>({...C(e.id,e.netlist),parent:e.parent});function je(e,t){let n=e.id,r=e.parent;for(let e=0;r&&e<16;e++)n=r,r=t.find(e=>e.id===r)?.parent;return n}var Me={res:`M16 16V28L4 34L28 42L4 50L28 58L4 66L28 74L16 80V96`,cap:`M16 0V26M0 26H32M0 38H32M16 38V64`,polcap:`M16 0V26M0 26H32M0 42Q16 32 32 42M16 37V64`,diode:`M16 0V20M0 20H32L16 44ZM0 44H32M16 44V64`,npn:`M0 48H16M16 16V80M16 36L64 6V0M16 60L64 90V96`,pnp:`M0 48H16M16 16V80M16 36L64 6V0M16 60L64 90V96`,opamp:`M-32 32L32 64L-32 96ZM0 32V48M0 80V96`,pot:`M16 16V28L4 34L28 42L4 50L28 58L4 66L28 74L16 80V96M64 64H30`,ind:`M16 16V28A10 10 0 0 1 16 48A10 10 0 0 1 16 68A10 10 0 0 1 16 88V96`,njf:`M0 48H16M16 16V80M16 28H64V0M16 68H64V96`,voltage:`M0 16V32M0 80V96`},Ne={res:[[16,16],[16,96]],cap:[[16,0],[16,64]],polcap:[[16,0],[16,64]],diode:[[16,0],[16,64]],npn:[[64,0],[0,48],[64,96]],pnp:[[64,0],[0,48],[64,96]],opamp:[[-32,80],[-32,48],[0,32],[0,96],[32,64]],pot:[[16,16],[64,64],[16,96]],voltage:[[0,16],[0,96]],ind:[[16,16],[16,96]],njf:[[64,0],[0,48],[64,96]]},Pe={npn:`M64 90L48 88L56 76Z`,pnp:`M22 64L36 62L30 74Z`,pot:`M30 64L42 58V70Z`,njf:`M16 48L6 42V54Z`};function Fe(e){let t=Number(e.slice(1));return`${e.startsWith(`M`)?`scale(-1 1) `:``}rotate(${t})`}function Ie(e,t){let[n,r]=e;for(let e=0;e<Number(t.rot.slice(1))/90;e++)[n,r]=[-r,n];return t.rot.startsWith(`M`)&&(n=-n),[t.x+n,t.y+r]}function Le(e,t){let n=new Map,r=new Map,i=!1;for(let a of e.split(`
`)){let e=a.trim().split(/\s+/),o=e[0]?.toLowerCase()??``;if(o===`.subckt`?i=!0:o===`.ends`?i=!1:o===`.model`&&r.set(e[1].toLowerCase(),e[1]),i||!o||o.startsWith(`*`)||o.startsWith(`.`))continue;let s=e[0].toUpperCase(),c=(e,t)=>e.toLowerCase().replace(/meg$/,`M`).replace(/u$/,`µ`).replace(/k$/,`k`)+t;switch(o[0]){case`r`:n.set(s,c(e[3],`Ω`));break;case`c`:n.set(s,c(e[3],`F`));break;case`l`:n.set(s,c(e[3],`H`));break;case`j`:n.set(s,e[4].replace(/^J(?=\d)/i,``));break;case`d`:n.set(s,e[3].replace(/^D(?=\d)/i,``));break;case`q`:n.set(s,e[4].replace(/^Q(?=\d)/i,``));break;case`x`:if(e[4]?.toUpperCase()===`POT`){let e=/R=(\S+)/i.exec(a)?.[1]??``,r=/pos=\{(\w+)\}/i.exec(a)?.[1]?.toLowerCase(),i=t.controls.find(e=>e.name===r)?.label??`Pot`;n.set(s,`${i} ${c(e,`Ω`)}`)}else n.set(s,`op-amp`)}}return n}var Re={diode:[0,1],npn:[0,1,2],pnp:[0,1,2],njf:[0,1,2],pot:[null,1,null],voltage:[0,1],opamp:[0,1,3,4,2]};function ze(e,t,n,r,i){let a=new Map,o=e=>{let t=e;for(;a.has(t)&&a.get(t)!==t;)t=a.get(t);return a.set(e,t),t},s=(e,t)=>{let n=o(e),r=o(t);n!==r&&a.set(n,r)},c=e=>`${e[0]},${e[1]}`,l=[];for(let[e,t,r,i]of n)s(c([e,t]),c([r,i])),l.push([e,t],[r,i]);let u=new Map;for(let e of t){let t=(Ne[e.type]??[]).map(t=>Ie(t,e));u.set(e,t),l.push(...t)}for(let e of r)l.push([e.x,e.y]);let d=new Map;i.forEach(e=>{let[t,r,i,a]=n[e];for(let e of[c([t,r]),c([i,a])])d.set(e,(d.get(e)??0)+1)});let f=new Set(t.filter(e=>e.added).flatMap(e=>u.get(e).map(c))),p=e=>{let t=d.get(c(e));return t!==void 0&&(t>1||f.has(c(e)))};for(let[e,[t,r,a,o]]of n.entries())if(!i.has(e))for(let[e,n]of l)p([e,n])||(t===a&&e===t&&n>=Math.min(r,o)&&n<=Math.max(r,o)||r===o&&n===r&&e>=Math.min(t,a)&&e<=Math.max(t,a))&&s(c([e,n]),c([t,r]));let m=new Map(Je(e.netlist).map(e=>[e.name.toUpperCase(),e])),h=new Set([...m.values()].flatMap(e=>e.nodes.map(e=>e.toLowerCase()))),g=/^\*@output\s+(\S+)/im.exec(e.netlist)?.[1].toLowerCase(),_=/^\*@input\s+(\S+)/im.exec(e.netlist)?.[1].toUpperCase(),v=_?m.get(_)?.nodes[0]?.toLowerCase():void 0,y=new Map,b=(e,t)=>{t&&!y.has(o(c(e)))&&y.set(o(c(e)),t.toLowerCase())};for(let e of r){let t=e.label.toLowerCase();if(t===`0`)b([e.x,e.y],`0`);else if(t===`out`)b([e.x,e.y],g);else if(t===`in`)b([e.x,e.y],v);else if(h.has(t))b([e.x,e.y],t);else{let n=parseFloat(t),r=[...m.values()].find(e=>e.letter===`v`&&parseFloat(e.value)===n);b([e.x,e.y],r?.nodes[0])}}for(let e of t){let t=Re[e.type],n=m.get(e.name);t&&n&&u.get(e).forEach((e,r)=>{let i=t[r];i!==null&&b(e,n.nodes[i])})}for(let e=!0;e;){e=!1;for(let n of t){let t=m.get(n.name),r=u.get(n),i=n.type===`pot`?[r[0],r[2]]:r,a=n.type===`pot`?[t?.nodes[0],t?.nodes[2]]:t?.nodes;if(!t||!a||i.length!==2||a.length!==2||a.some(e=>!e))continue;let[s,l]=i.map(e=>y.get(o(c(e)))),[d,f]=a.map(e=>e.toLowerCase()),p=e=>e===d?f:e===f?d:void 0;s&&!l&&p(s)?(b(i[1],p(s)),e=!0):l&&!s&&p(l)&&(b(i[0],p(l)),e=!0)}}return e=>y.get(o(c(e)))}function Be(e){return/^\*@sch /m.test(e.netlist)}function Ve(e,t={}){let n=[],r=[],i=[],a=new Set;for(let t of e.netlist.split(`
`)){let e=t.trim().split(/\s+/);e[0]===`*@sch`&&(e[1]===`sym`?n.push({type:e[2],x:+e[3],y:+e[4],rot:e[5],name:e[6].toUpperCase(),added:e[7]===`new`}):e[1]===`wire`?(r.push([+e[2],+e[3],+e[4],+e[5]]),e[6]===`new`&&a.add(r.length-1)):e[1]===`flag`&&i.push({x:+e[2],y:+e[3],label:e[4]}))}let o=Le(e.netlist,e),s=new Map,c=e=>s.set(e.join(`,`),(s.get(e.join(`,`))??0)+1);for(let[e,t,n,i]of r)c([e,t]),c([n,i]);for(let e of n)for(let t of Ne[e.type]??[])c(Ie(t,e));for(let e of i)c([e.x,e.y]);for(let[e,t,n,i]of r)for(let r of s.keys()){let[a,o]=r.split(`,`).map(Number);(e===n&&a===e&&o>Math.min(t,i)&&o<Math.max(t,i)||t===i&&o===t&&a>Math.min(e,n)&&a<Math.max(e,n))&&s.set(r,(s.get(r)??0)+2)}let l=[],u=[];for(let[e,t,n,i]of r)l.push(e,n),u.push(t,i);for(let e of n)for(let t of Ne[e.type]??[]){let n=Ie(t,e);l.push(n[0]),u.push(n[1])}for(let e of i)l.push(e.x),u.push(e.y);let d=Math.min(...l)-200,f=Math.min(...u)-200,p=Math.max(...l)-d+200,m=Math.max(...u)-f+200,h=(e,t)=>{let n=document.createElementNS(`http://www.w3.org/2000/svg`,e);for(let[e,r]of Object.entries(t))n.setAttribute(e,String(r));return n},g=h(`svg`,{viewBox:`${d} ${f} ${p} ${m}`,class:`schematic`,role:`img`,"aria-label":`${e.name} schematic`}),_=h(`defs`,{});for(let[e,t]of[[`halo-diode`,`#ff5a36`],[`halo-bjt`,`#ffb347`]]){let n=h(`radialGradient`,{id:e});n.append(h(`stop`,{offset:`0%`,"stop-color":t,"stop-opacity":.9}),h(`stop`,{offset:`45%`,"stop-color":t,"stop-opacity":.35}),h(`stop`,{offset:`100%`,"stop-color":t,"stop-opacity":0})),_.append(n)}g.append(_);let v=h(`g`,{class:`sch-halos`});g.append(v);let y=`min(100%, ${Math.round(p*.4)}px)`,b=`${Math.round(p*.4)}px`;g.style.width=y,g.addEventListener(`click`,e=>{if(e.target.classList.contains(`sch-hit`))return;let t=g.classList.toggle(`zoomed`);g.style.width=t?b:y,g.style.maxWidth=t?`none`:``});let x=h(`g`,{class:`sch-wires`}),ee=ze(e,n,r,i,a);r.forEach(([e,t,n,r],i)=>{let o=ee([e,t])??``;x.append(h(`line`,{x1:e,y1:t,x2:n,y2:r,"data-node":o,...a.has(i)?{class:`sch-new`}:{}}))});for(let[e,t]of s){if(t<3)continue;let[n,r]=e.split(`,`).map(Number);x.append(h(`circle`,{cx:n,cy:r,r:7,class:`sch-dot`}))}if(g.append(x),t.onNode){let e=h(`g`,{class:`sch-hits`});for(let[n,i,a,o]of r){let r=ee([n,i]);if(!r||r===`0`)continue;let s=h(`line`,{x1:n,y1:i,x2:a,y2:o,class:`sch-hit`,"data-node":r}),c=h(`title`,{});c.textContent=`Probe ${r}`,s.append(c),s.addEventListener(`click`,e=>{let s=g.getScreenCTM()?.inverse(),c=s?new DOMPoint(e.clientX,e.clientY).matrixTransform(s):new DOMPoint(n,i),l=(e,t,n)=>Math.min(Math.max(Math.round(e/16)*16,Math.min(t,n)),Math.max(t,n));t.onNode(r,n===a?[n,l(c.y,i,o)]:[l(c.x,n,a),i])}),e.append(s)}g.append(e)}let te=new Set(Je(e.netlist).map(e=>e.name.toUpperCase()));for(let e of n){let t=te.has(e.name)?e.added?` sch-new`:``:` sch-removed`,n=h(`g`,{class:`sch-part sch-${e.type}${t}`,"data-name":e.name}),r=h(`title`,{});r.textContent=`${e.name}${o.has(e.name)?` · ${o.get(e.name)}`:``}`,n.append(r);let i=h(`g`,{transform:`translate(${e.x} ${e.y}) ${Fe(e.rot)}`});i.append(h(`path`,{d:Me[e.type]??``,class:`sch-body`})),Pe[e.type]&&i.append(h(`path`,{d:Pe[e.type],class:`sch-fill`})),n.append(i);let a=(Ne[e.type]??[]).map(t=>Ie(t,e)),s=a.reduce((e,t)=>e+t[0],0)/a.length,c=a.reduce((e,t)=>e+t[1],0)/a.length,l=Number(e.rot.slice(1))%180==90&&e.type!==`opamp`,[u,d,f]=e.type===`pot`?[a[1][0]+12,a[1][1]-18,`start`]:l?[s,c-30,`middle`]:[s+34,c+11,`start`];if(e.type===`diode`||e.type===`npn`||e.type===`pnp`){let t=h(`circle`,{cx:s,cy:c,r:e.type===`diode`?90:110,class:`sch-halo`,fill:`url(#halo-${e.type===`diode`?`diode`:`bjt`})`,opacity:0,"data-for":e.name});v.append(t)}let p=h(`text`,{x:u,y:d,"text-anchor":f,class:`sch-value`});p.textContent=e.type===`opamp`?e.name.replace(/^X/,``):o.get(e.name)??e.name,n.append(p),g.append(n)}for(let e of i){let t=h(`g`,{class:`sch-flag`});if(e.label===`0`)t.append(h(`path`,{d:`M${e.x-24} ${e.y}H${e.x+24}M${e.x-15} ${e.y+10}H${e.x+15}M${e.x-6} ${e.y+20}H${e.x+6}`,class:`sch-body`}));else{let n=/^(IN|OUT)$/i.test(e.label),r=e.label.toUpperCase()===`IN`,i=n?h(`text`,{x:e.x+(r?-22:22),y:e.y+15,"text-anchor":r?`end`:`start`,class:`sch-io`}):h(`text`,{x:e.x,y:e.y-14,"text-anchor":`middle`,class:`sch-rail`});i.textContent=n?e.label.toUpperCase()===`IN`?`Guitar in`:`To amp`:e.label,t.append(h(`circle`,{cx:e.x,cy:e.y,r:6,class:`sch-dot`}),i)}g.append(t)}return g}function He(e,t,n){let r=e.querySelector(`.sch-halo[data-for="${t}"]`),i=e.querySelector(`.sch-part[data-name="${t}"]`);r&&i&&(r.setAttribute(`opacity`,n.toFixed(3)),i.style.setProperty(`--g`,n.toFixed(3)))}function Ue(e,t){return e===`diode`?Math.min(1,Math.max(0,(Math.log10(Math.max(t,1e-12))+7)/2)):Math.min(1,Math.max(0,t))**.6}function We(e){let t=new Map;return e.querySelectorAll(`.sch-part`).forEach(e=>{let n=e.classList.contains(`sch-diode`)?`diode`:e.classList.contains(`sch-npn`)||e.classList.contains(`sch-pnp`)?`bjt`:null;n&&e.dataset.name&&t.set(e.dataset.name,n)}),t}function Ge(e,t){e.querySelectorAll(`.sch-wires line`).forEach(e=>e.classList.toggle(`probed`,!!t&&e.dataset.node===t))}function Ke(e,t,n,r){let i=[];for(let t of e.split(`
`)){let e=t.trim().split(/\s+/);e[0]===`*@sch`&&e[1]===`sym`&&i.push([+e[3],+e[4]])}let a=Ne[t]??Ne.res,o=r.reduce((e,t)=>e+t[0],0)/r.length,s=r.reduce((e,t)=>e+t[1],0)/r.length,c=[];for(let e of[128,192,256])for(let[t,n]of[[0,-1],[0,1],[1,0],[-1,0],[1,-1],[-1,-1],[1,1],[-1,1]])c.push([o+t*e,s+n*e]);let l=e=>Math.min(...i.map(t=>Math.hypot(t[0]-e[0],t[1]-e[1])),1e9),u=c.reduce((e,t)=>l(t)>l(e)+1?t:e),d=e=>Math.round(e/16)*16,f=d(u[0]-16),p=d(u[1]-48),m=[`*@sch sym ${t} ${f} ${p} R0 ${n} new`];return a.forEach(([e,t],n)=>{let i=[f+e,p+t],a=r[n]??r[r.length-1],o=[i[0],a[1]];i[1]!==o[1]&&m.push(`*@sch wire ${i[0]} ${i[1]} ${o[0]} ${o[1]} new`),o[0]!==a[0]&&m.push(`*@sch wire ${o[0]} ${o[1]} ${a[0]} ${a[1]} new`)}),m}var qe={r:2,c:2,l:2,d:2,q:3,j:3,v:2,e:4};function Je(e){let t=[],n=!1;return e.split(`
`).forEach((e,r)=>{let i=e.trim().split(/\s+/),a=(i[0]??``).toLowerCase();if(a===`.subckt`?n=!0:a===`.ends`&&(n=!1),n||!a||a.startsWith(`*`)||a.startsWith(`.`)||a.startsWith(`+`))return;let o=a[0];if(o===`x`){let e=i.filter((e,t)=>t>0&&e.includes(`=`)),n=i.slice(1).filter(e=>!e.includes(`=`));t.push({line:r,name:i[0],letter:o,nodes:n.slice(0,-1),value:n[n.length-1]??``,params:e})}else if(o===`k`)t.push({line:r,name:i[0],letter:o,nodes:i.slice(1,3),value:i[3]??``,params:[]});else{let e=qe[o]??2,n=o===`v`?i.slice(e+1).filter(e=>e.toLowerCase()!==`dc`).join(` `):i[e+1]??``;t.push({line:r,name:i[0],letter:o,nodes:i.slice(1,e+1),value:n,params:[]})}}),t}function Ye(e){return e.letter===`x`?[e.name,...e.nodes,e.value,...e.params].join(` `):e.letter===`v`?[e.name,...e.nodes,`DC`,e.value].join(` `):[e.name,...e.nodes,e.value].join(` `)}var Xe=[`.model D1N914 D(IS=2.52n N=1.752 RS=0.568)`,`.model DBAT46 D(IS=0.14u N=1.04 RS=1)`,`.model DLEDRED D(IS=1e-19 N=1.7 RS=5)`,`.model D1N4001 D(IS=14.11n N=1.984 RS=33.89m)`,`.model Q2N3904 NPN(IS=6.734f BF=416.4 BR=0.7371)`,`.model Q2N3906 PNP(IS=1.41f BF=180.7 BR=4.977)`,`.model Q2N5088 NPN(IS=5.9f BF=900 BR=2)`,`.model J2N5457 NJF(VTO=-1.372 BETA=1.125m LAMBDA=2.3m)`],Ze={D1N4148:`silicon`,D1N914:`silicon`,D1N34A:`germanium`,DBAT46:`Schottky`,DLEDRED:`red LED`,D1N4001:`silicon rectifier`,DCLAMP:`op-amp rail clamp`};function Qe(){let e=new Map,t=[...Xe,...Ee.flatMap(e=>e.netlist.split(`
`))];for(let n of t){let t=/^\.model\s+(\S+)\s+(\w+)\s*\(/i.exec(n.trim());if(!t)continue;let r=t[1].toUpperCase(),i=t[2].toLowerCase();[`d`,`npn`,`pnp`,`njf`,`pjf`].includes(i)&&!e.has(r)&&r!==`DCLAMP`&&e.set(r,{name:r,kind:i,line:n.trim(),label:Ze[r]??``})}return[...e.values()]}var $e=Qe();function et(e){let t=new Map;for(let n of e.split(`
`)){let e=/^\.model\s+(\S+)\s+(\w+)/i.exec(n.trim());e&&t.set(e[1].toUpperCase(),e[2].toLowerCase())}return t}function tt(e,t){if(et(e.join(`
`)).has(t.toUpperCase()))return;let n=$e.find(e=>e.name===t.toUpperCase());if(!n)return;let r=e.findIndex(e=>/^\.(model|subckt|param)\b/i.test(e.trim()));e.splice(r<0?e.length:r,0,n.line)}function nt(e){let t=new Set;for(let n of e)n.letter!==`k`&&n.nodes.forEach(e=>t.add(e));return[...t].sort((e,t)=>e.localeCompare(t,void 0,{numeric:!0}))}var rt=e=>/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?(meg|[tgkmunpf])?[a-z]*$/i.test(e),it=[{key:`r`,label:`Resistor`,prefix:`R`,value:`10k`},{key:`c`,label:`Capacitor`,prefix:`C`,value:`100n`},{key:`l`,label:`Inductor`,prefix:`L`,value:`100m`},{key:`d`,label:`Diode`,prefix:`D`,model:`d`},{key:`npn`,label:`NPN transistor`,prefix:`Q`,model:`npn`},{key:`pnp`,label:`PNP transistor`,prefix:`Q`,model:`pnp`},{key:`njf`,label:`N-JFET`,prefix:`J`,model:`njf`}],at=(e,t)=>{switch(e.letter){case`r`:return`Resistor`;case`c`:return`Capacitor`;case`l`:return`Inductor`;case`d`:return`Diode`;case`q`:return t.get(e.value.toUpperCase())===`pnp`?`PNP`:`NPN`;case`j`:return`JFET`;case`v`:return`Supply`;case`e`:return`Controlled source`;case`k`:return`Coupling`;default:{let t=e.value.toLowerCase();return t===`pot`?`Pot`:t===`sw`?`Switch`:t===`triode`?`Triode`:e.value}}},w=e=>e.replace(/[&<>"]/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`})[e]);function ot(e,t){let n=document.createElement(`div`);n.className=`designer`;let r=e.netlist,i=[],a=null,o=-1,s=!1,c=null;async function l(e,n=!0){if(e===r)return;n&&(i.push(r),i.length>100&&i.shift()),r=e,d(),a=t?await t.apply(r):null;let s=a&&/line (\d+)/.exec(a);o=s?Number(s[1])-1:-1,d()}function u(e){let t=r.split(`
`);e(t),l(t.join(`
`))}function d(){let f=Je(r),p=et(r),m=nt(f),h=!!t,g=`nodes-${e.id}`,_=new Map;for(let e of f)if(e.letter!==`k`)for(let t of e.nodes)_.set(t.toLowerCase(),(_.get(t.toLowerCase())??0)+1);let v=/^\*@output\s+(\S+)/im.exec(r)?.[1].toLowerCase(),y=e=>e!==`0`&&e.toLowerCase()!==v&&(_.get(e.toLowerCase())??0)<2,b=f.flatMap(e=>e.letter===`k`?[]:e.nodes.filter(y).map(t=>`${e.name}: pin "${t}" connects to nothing else`)),x=/^\*@input\s+(\S+)/im.exec(r)?.[1].toUpperCase(),ee=f.map((e,t)=>{let n=w(e.value),r=e.name.toUpperCase()===x;if(r)n=`guitar in`;else if(h){if(`rclk`.includes(e.letter)||e.letter===`v`)n=`<input class="d-value" data-i="${t}" value="${w(e.value)}" size="7" aria-label="${w(e.name)} value">`;else if(`dqj`.includes(e.letter)){let r=e.letter===`d`?`d`:p.get(e.value.toUpperCase())??(e.letter===`j`?`njf`:`npn`),i=$e.filter(e=>e.kind===r);i.some(t=>t.name===e.value.toUpperCase())||i.unshift({name:e.value.toUpperCase(),kind:r,line:``,label:``}),n=`<select class="d-model" data-i="${t}" aria-label="${w(e.name)} model">${i.map(t=>`<option value="${t.name}" ${t.name===e.value.toUpperCase()?`selected`:``}>${t.name}${t.label?` (${t.label})`:``}</option>`).join(``)}</select>`}else if(e.value.toLowerCase()===`pot`){let r=e.params.find(e=>/^r=/i.test(e))?.slice(2)??``,i=e.params.find(e=>/^pos=/i.test(e))?.replace(/^pos=\{?|\}$/gi,``)??``;n=`<input class="d-pot" data-i="${t}" value="${w(r)}" size="6" aria-label="${w(e.name)} resistance"> <small>knob: ${w(i)}</small>`}}else e.value.toLowerCase()===`pot`&&(n=w(e.params.find(e=>/^r=/i.test(e))?.slice(2)??``));let i=e.nodes.map((n,i)=>h&&!r&&e.letter!==`k`?`<input class="d-node" data-i="${t}" data-k="${i}" value="${w(n)}" size="7" list="${g}" aria-label="${w(e.name)} pin ${i+1}">`:w(n)).join(` `),a=h&&!r?`<button class="link d-del" data-i="${t}" aria-label="Remove ${w(e.name)}">remove</button>`:``,s=e.letter!==`k`&&e.nodes.some(y);return`<tr class="${e.line===o?`d-error`:s?`d-warn`:``}" data-part="${w(e.name.toUpperCase())}">
        <td>${w(e.name)}</td><td>${at(e,p)}</td><td class="d-nodes">${i}</td><td>${n}</td><td>${a}</td></tr>`}).join(``),te=e.name,ne=h?`
      <div class="d-add">
        <select class="d-add-kind" aria-label="New part type">${it.map(e=>`<option value="${e.key}">${e.label}</option>`).join(``)}</select>
        between <input class="d-add-a" size="5" list="${g}" placeholder="node" aria-label="First pin">
        and <input class="d-add-b" size="5" list="${g}" placeholder="node" aria-label="Second pin">
        <span class="d-add-c-wrap" hidden>and <input class="d-add-c" size="5" list="${g}" placeholder="node" aria-label="Third pin"></span>
        <span class="d-add-value-wrap"><input class="d-add-value" size="6" aria-label="Value"></span>
        <select class="d-add-model" aria-label="Model" hidden></select>
        ${t?.pick&&/^\*@sch /m.test(r)?`<button class="link d-add-pick">Pick on drawing</button>`:``}
        <button class="d-add-go">Add part</button>
        <p class="hint">Pins: C B E for transistors, D G S for JFETs, anode then cathode for diodes. 0 is ground; a new name makes a new node.</p>
      </div>`:``;n.innerHTML=`
      ${h?`<div class="d-head">
        <label>Name <input class="d-name" value="${w(te)}" size="24" maxlength="40"></label>
        <button class="d-undo" ${i.length?``:`disabled`}>Undo</button>
        <button class="link d-raw">${s?`Hide`:`Edit`} netlist</button>
        <button class="link d-export">Export .cir</button>
        <button class="link d-csv">Parts list (CSV)</button>
        <button class="link d-delete">Delete this pedal</button>
      </div>`:`<div class="d-head"><button class="link d-export">Export .cir</button><button class="link d-csv">Parts list (CSV)</button></div>`}
      ${a?`<p class="d-error-text">${w(a)}</p>`:``}
      ${h&&b.length?`<p class="d-warn-text">${b.map(w).join(`<br>`)}</p>`:``}
      ${s?`<div class="d-rawbox"><textarea class="d-rawtext" spellcheck="false" rows="18">${w(r)}</textarea>
        <button class="d-raw-apply">Apply</button></div>`:``}
      <datalist id="${g}">${m.map(e=>`<option value="${w(e)}">`).join(``)}</datalist>
      <div class="d-parts-wrap"><table class="d-parts"><thead><tr><th>Part</th><th>Type</th><th>Pins</th><th>Value</th><th></th></tr></thead><tbody>${ee}</tbody></table></div>
      ${ne}`;let S=e=>f[Number(e.dataset.i)];n.querySelectorAll(`.d-value`).forEach(e=>e.addEventListener(`change`,()=>{let t=S(e),n=e.value.trim();rt(n)?u(e=>{e[t.line]=Ye({...t,value:n})}):e.classList.add(`bad`)})),n.querySelectorAll(`.d-pot`).forEach(e=>e.addEventListener(`change`,()=>{let t=S(e),n=e.value.trim();rt(n)?u(e=>{e[t.line]=Ye({...t,params:t.params.map(e=>/^r=/i.test(e)?`R=${n}`:e)})}):e.classList.add(`bad`)})),n.querySelectorAll(`.d-model`).forEach(e=>e.addEventListener(`change`,()=>{let t=S(e);u(n=>{n[t.line]=Ye({...t,value:e.value}),tt(n,e.value)})})),n.querySelectorAll(`.d-node`).forEach(e=>e.addEventListener(`change`,()=>{let t=S(e),n=e.value.trim();if(!/^[\w.]+$/.test(n)){e.classList.add(`bad`);return}let r=[...t.nodes];r[Number(e.dataset.k)]=n,u(e=>{e[t.line]=Ye({...t,nodes:r})})})),n.querySelectorAll(`.d-del`).forEach(e=>e.addEventListener(`click`,()=>{let t=S(e);u(e=>{e[t.line]=`* removed: ${e[t.line]}`})})),n.querySelector(`.d-undo`)?.addEventListener(`click`,()=>{let e=i.pop();e!==void 0&&l(e,!1)}),n.querySelector(`.d-raw`)?.addEventListener(`click`,()=>{s=!s,d()}),n.querySelector(`.d-raw-apply`)?.addEventListener(`click`,()=>void l(n.querySelector(`.d-rawtext`).value)),n.querySelector(`.d-name`)?.addEventListener(`change`,e=>{let n=e.target.value.trim().replace(/"/g,`'`);n&&(u(e=>{let t=e.findIndex(e=>/^\*@pedal\b/i.test(e));t>=0&&(e[t]=/name="[^"]*"/i.test(e[t])?e[t].replace(/name="[^"]*"/i,`name="${n}"`):`${e[t]} name="${n}"`)}),t?.rename(n))}),n.querySelector(`.d-delete`)?.addEventListener(`click`,e=>{let n=e.target;n.dataset.armed?t?.remove():(n.dataset.armed=`1`,n.textContent=`Click again to delete it for good`)}),n.querySelector(`.d-export`)?.addEventListener(`click`,()=>lt(`${st(e.name)}.cir`,r,`text/plain`)),n.querySelector(`.d-csv`)?.addEventListener(`click`,()=>lt(`${st(e.name)}-parts.csv`,ct(Je(r),et(r)),`text/csv`));let re=n.querySelector(`.d-add-kind`);if(re){let e=n.querySelector(`.d-add-model`),i=n.querySelector(`.d-add-value-wrap`),a=n.querySelector(`.d-add-value`),o=n.querySelector(`.d-add-c-wrap`),s=()=>{let t=it.find(e=>e.key===re.value),n=`model`in t?t.model:null;e.hidden=!n,i.hidden=!!n,o.hidden=!(n&&n!==`d`),n?e.innerHTML=$e.filter(e=>e.kind===n).map(e=>`<option value="${e.name}">${e.name}${e.label?` (${e.label})`:``}</option>`).join(``):a.value=`value`in t?t.value:``};re.addEventListener(`change`,()=>{c=null,s()}),s();let l=n.querySelector(`.d-add-pick`);l?.addEventListener(`click`,async()=>{let e=it.find(e=>e.key===re.value),r=`model`in e&&e.model!==`d`?3:2,i=r===3?e.key===`njf`?`drain, gate, source`:`collector, base, emitter`:e.key===`d`?`anode, then cathode`:`one end, then the other`;l.textContent=`Click ${r} wires on the drawing: ${i} (Esc cancels)`;let a=await t.pick(r);l.textContent=`Pick on drawing`,a&&([`.d-add-a`,`.d-add-b`,`.d-add-c`].forEach((e,t)=>{a[t]&&(n.querySelector(e).value=a[t].node)}),c=a.map(e=>e.at))}),n.querySelector(`.d-add-go`).addEventListener(`click`,()=>{let t=it.find(e=>e.key===re.value),i=[`.d-add-a`,`.d-add-b`,`.d-add-c`].map(e=>n.querySelector(e).value.trim()),o=`model`in t?t.model:null,s=o&&o!==`d`?3:2;if(i.slice(0,s).some(e=>!/^[\w.]+$/.test(e)))return;let l=o?e.value:a.value.trim();if(!o&&!rt(l)){a.classList.add(`bad`);return}let d=new Set(f.map(e=>e.name.toUpperCase())),p=1;for(;d.has(`${t.prefix}${100+p}`);)p++;let m=`${t.prefix}${100+p}`,h={r:`res`,c:`cap`,l:`ind`,d:`diode`,npn:`npn`,pnp:`pnp`,njf:`njf`}[t.key],g=c&&c.length>=s?Ke(r,h,m,c):[];c=null,u(e=>{let t=e.findIndex(e=>/^\.(model|subckt|param)\b/i.test(e.trim()));e.splice(t<0?e.length:t,0,`${m} ${i.slice(0,s).join(` `)} ${l}`,``),o&&tt(e,l),g.length&&e.push(...g)})})}}return d(),n}var st=e=>e.toLowerCase().replace(/[^a-z0-9]+/g,`-`).replace(/^-|-$/g,``)||`pedal`;function ct(e,t){let n=e=>`"${e.replace(/"/g,`""`)}"`;return[`Part,Type,Value`,...e.filter(e=>![`v`,`e`,`k`].includes(e.letter)&&![`opamp`].includes(e.value.toLowerCase())).map(e=>{let r=e.value.toLowerCase()===`pot`?e.params.find(e=>/^r=/i.test(e))?.slice(2)??``:e.value;return[e.name,at(e,t),r].map(n).join(`,`)})].join(`
`)+`
`}function lt(e,t,n){let r=URL.createObjectURL(new Blob([t],{type:n}));Object.assign(document.createElement(`a`),{href:r,download:e}).click(),setTimeout(()=>URL.revokeObjectURL(r),1e3)}function ut(e,t){let n=e.netlist.split(`
`),r=n.findIndex(e=>/^\*@pedal\b/i.test(e));return r>=0&&(n[r]=n[r].replace(/name="[^"]*"/i,`name="${t.replace(/"/g,`'`)}"`)),[`* ${t}: forked from ${e.name} in the PhreakGuitar pedal designer.`,...n].join(`
`)}var dt=`phreakguitar.tabs.v1`;function ft(){let e={speed:1,playMyPart:!0,metronome:!1,countIn:!0,volume:.6,open:!1};try{return{...e,...JSON.parse(localStorage.getItem(dt)??`{}`)}}catch{return e}}var T=ft(),E=()=>{try{localStorage.setItem(dt,JSON.stringify(T))}catch{}},pt=`phreakguitar-tabs`;async function mt(){return await c,new Promise((e,t)=>{let n=indexedDB.open(pt,1);n.onupgradeneeded=()=>n.result.createObjectStore(`files`,{keyPath:`name`}),n.onsuccess=()=>e(n.result),n.onerror=()=>t(n.error)})}async function ht(e,t){let n=await mt();try{return await new Promise((r,i)=>{let a=t(n.transaction(`files`,e).objectStore(`files`));a.onsuccess=()=>r(a.result),a.onerror=()=>i(a.error)})}finally{n.close()}}var gt=async()=>{try{return(await ht(`readonly`,e=>e.getAll())).sort((e,t)=>t.added-e.added)}catch{return[]}},_t=async(e,t)=>{try{await ht(`readwrite`,n=>n.put({name:e,bytes:t,added:Date.now()}))}catch{}},vt=async e=>{try{await ht(`readwrite`,t=>t.delete(e))}catch{}};async function yt(){try{let e=await fetch(`/__tabs`);return e.ok?await e.json():[]}catch{return[]}}var bt=/\.(gp|gp3|gp4|gp5|gpx|gp7|musicxml|mxl|xml)$/i,xt=e=>e.replace(bt,``).replace(/[_]+/g,` `).replace(/\s*\(\d+\)$/,``).trim();function St(e){let t=document.createElement(`section`);t.className=`card tabs`,t.setAttribute(`aria-label`,`Tabs`),t.hidden=!T.open,t.innerHTML=`
    <div class="tabs-head">
      <h2>Tabs</h2>
      <select class="tabs-file" aria-label="Tab file"><option value="">Pick a tab…</option></select>
      <button class="tabs-open">Open file…</button>
      <input class="tabs-input" type="file" accept=".gp,.gp3,.gp4,.gp5,.gpx,.gp7,.musicxml,.mxl,.xml" hidden>
      <span class="tabs-find">
        <input class="tabs-q" type="search" placeholder="Song or artist" aria-label="Search Ultimate Guitar for">
        <button class="link tabs-ug">Find on Ultimate Guitar</button>
      </span>
      <button class="link tabs-forget" hidden>Remove from this browser</button>
    </div>
    <div class="tabs-transport" hidden>
      <button class="tabs-play" aria-label="Play">▶ Play</button>
      <button class="tabs-stop" aria-label="Stop">■</button>
      <label>Track <select class="tabs-track"></select></label>
      <label class="tabs-speed">Speed <input type="range" min="25" max="150" step="5"> <output></output></label>
      <label class="switch"><input type="checkbox" class="tabs-mypart"> <span>Play my part (mute this track)</span></label>
      <label>Backing <input type="range" class="tabs-vol" min="0" max="100"></label>
      <label class="switch"><input type="checkbox" class="tabs-loop"> <span>Loop</span></label>
      <label class="switch"><input type="checkbox" class="tabs-click"> <span>Metronome</span></label>
      <label class="switch"><input type="checkbox" class="tabs-countin"> <span>Count-in</span></label>
      <span class="tabs-pos hint"></span>
    </div>
    <div class="tabs-view"><div class="tabs-score"></div></div>
    <p class="hint tabs-hint">Guitar Pro (.gp, .gp5, .gpx…) or MusicXML. Files you open or drop here are kept in this browser.
      Drag across bars to pick a section, then Loop. Space plays and pauses.</p>`;let n=e=>t.querySelector(e),r=n(`.tabs-file`),i=n(`.tabs-transport`),a=n(`.tabs-view`),o=n(`.tabs-score`),s=n(`.tabs-play`),c=n(`.tabs-track`),l=n(`.tabs-speed input`),u=n(`.tabs-speed output`),d=n(`.tabs-pos`),f=null,p=null,h=null;async function g(){return p||(f=await m(()=>import(`./alphaTab-Dz43L4Is.js`),[]),p=new f.AlphaTabApi(o,{core:{fontDirectory:`/font/`},display:{staveProfile:f.StaveProfile.Default,scale:.95},player:{playerMode:f.PlayerMode.EnabledSynthesizer,soundFont:`/soundfont/sonivox.sf2`,enableCursor:!0,enableAnimatedBeatCursor:!0,enableUserInteraction:!0,scrollElement:a}}),p.scoreLoaded.on(e=>{h=e,c.replaceChildren(...e.tracks.map((e,t)=>new Option(e.name||`Track ${t+1}`,String(t))));let t=e.tracks.findIndex(e=>/guit|gtr|lead|rhythm/i.test(e.name)),r=T.track!==void 0&&T.track<e.tracks.length?T.track:Math.max(0,t);c.value=String(r),_(r),i.hidden=!1;let a=n(`.tabs-q`);a.value||=[e.title,e.artist].filter(Boolean).join(` `)}),p.playerReady.on(async()=>{v();let t=e.outputDeviceId();if(t)try{let e=(await p.enumerateOutputDevices()).find(e=>e.deviceId===t);e&&await p.setOutputDevice(e)}catch{}}),p.playerStateChanged.on(e=>{s.textContent=e.state===f.synth.PlayerState.Playing?`❚❚ Pause`:`▶ Play`}),p.playerPositionChanged.on(e=>{let t=e=>`${Math.floor(e/6e4)}:${String(Math.floor(e/1e3)%60).padStart(2,`0`)}`;d.textContent=`${t(e.currentTime)} / ${t(e.endTime)}`}),p)}function _(e){p&&h&&(T.track=e,E(),p.renderTracks([h.tracks[e]]),v())}function v(){if(!p||!h)return;p.playbackSpeed=T.speed,p.masterVolume=T.volume,p.metronomeVolume=+!!T.metronome,p.countInVolume=+!!T.countIn,p.changeTrackMute(h.tracks,!1);let e=h.tracks[T.track??0];T.playMyPart&&e&&p.changeTrackMute([e],!0)}async function b(e){(await g()).load(new Uint8Array(e)),y(`tab_loaded`,{format:T.file?.name.split(`.`).pop()?.toLowerCase()??`unknown`})}async function x(e){let[t,i]=await Promise.all([yt(),gt()]),a=(e,t)=>{if(!t.length)return[];let n=Object.assign(document.createElement(`optgroup`),{label:e});return n.append(...t),[n]},o=(e,t)=>new Option(t,e);r.replaceChildren(new Option(`Pick a tab…`,``),...a(`Downloads`,t.filter(e=>e.folder===`downloads`).map(e=>o(`folder:${e.folder}/${e.name}`,xt(e.name)))),...a(`Tabs folder`,t.filter(e=>e.folder===`tabs`).map(e=>o(`folder:${e.folder}/${e.name}`,xt(e.name)))),...a(`In this browser`,i.map(e=>o(`browser:${e.name}`,xt(e.name)))));let s=e??(T.file?T.file.source===`folder`?`folder:${T.file.folder}/${T.file.name}`:`browser:${T.file.name}`:``);r.value=[...r.options].some(e=>e.value===s)?s:``,n(`.tabs-forget`).hidden=!r.value.startsWith(`browser:`)}async function ee(){let e=r.value;if(n(`.tabs-forget`).hidden=!e.startsWith(`browser:`),e)try{if(e.startsWith(`folder:`)){let[t,...n]=e.slice(7).split(`/`),r=n.join(`/`),i=await fetch(`/__tabs/${encodeURIComponent(t)}/${encodeURIComponent(r)}`);if(!i.ok)throw Error(`not found`);T.file={source:`folder`,folder:t,name:r},await b(await i.arrayBuffer())}else{let t=e.slice(8),n=(await gt()).find(e=>e.name===t);if(!n)throw Error(`not found`);T.file={source:`browser`,name:t},await b(n.bytes)}T.track=void 0,E()}catch{d.textContent=`Couldn't open that file.`}}async function te(e){if(!bt.test(e.name))return;let t=await e.arrayBuffer();await _t(e.name,t.slice(0)),T.file={source:`browser`,name:e.name},T.track=void 0,E(),await x(`browser:${e.name}`),await b(t)}r.addEventListener(`change`,()=>void ee()),n(`.tabs-open`).addEventListener(`click`,()=>n(`.tabs-input`).click()),n(`.tabs-input`).addEventListener(`change`,e=>{let t=e.target.files?.[0];t&&te(t)}),t.addEventListener(`dragover`,e=>{e.preventDefault(),t.classList.add(`drop`)}),t.addEventListener(`dragleave`,()=>t.classList.remove(`drop`)),t.addEventListener(`drop`,e=>{e.preventDefault(),t.classList.remove(`drop`);let n=e.dataTransfer?.files[0];n&&te(n)}),n(`.tabs-forget`).addEventListener(`click`,async()=>{let e=r.value;e.startsWith(`browser:`)&&(await vt(e.slice(8)),T.file=void 0,E(),await x(``))}),n(`.tabs-ug`).addEventListener(`click`,()=>{let e=n(`.tabs-q`).value.trim(),t=e?`https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(e)}`:`https://www.ultimate-guitar.com/`;window.open(t,`_blank`,`noopener`)}),s.addEventListener(`click`,()=>p?.playPause()),n(`.tabs-stop`).addEventListener(`click`,()=>p?.stop()),c.addEventListener(`change`,()=>_(Number(c.value))),l.value=String(Math.round(T.speed*100)),u.textContent=`${l.value}%`,l.addEventListener(`input`,()=>{T.speed=Number(l.value)/100,u.textContent=`${l.value}%`,E(),p&&(p.playbackSpeed=T.speed)});let ne=n(`.tabs-vol`);ne.value=String(Math.round(T.volume*100)),ne.addEventListener(`input`,()=>{T.volume=Number(ne.value)/100,E(),p&&(p.masterVolume=T.volume)});let S=(e,t,r)=>{let i=n(e);i.checked=t(),i.addEventListener(`change`,()=>{r(i.checked),E(),v()})};S(`.tabs-mypart`,()=>T.playMyPart,e=>{T.playMyPart=e}),S(`.tabs-click`,()=>T.metronome,e=>{T.metronome=e}),S(`.tabs-countin`,()=>T.countIn,e=>{T.countIn=e});let re=n(`.tabs-loop`);re.addEventListener(`change`,()=>{p&&(p.isLooping=re.checked)}),document.addEventListener(`keydown`,e=>{e.code===`Space`&&!t.hidden&&p&&(e.target.closest(`input, select, textarea, button`)||(e.preventDefault(),p.playPause()))});let ie=!1;async function ae(){ie?await x(r.value):(ie=!0,await x(),r.value&&await ee())}return T.open&&ae(),{el:t,isOpen:()=>!t.hidden,toggle(){return t.hidden=!t.hidden,T.open=!t.hidden,E(),t.hidden?p?.pause():ae(),!t.hidden}}}var Ct=e=>e.replace(/[&<>"]/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`})[e]);function wt(e,t){let n=document.createElement(`div`);n.className=`stage-view stage-${t}`,n.innerHTML=`
    ${t===`full`?`<div class="stage-top">
      <button class="link stage-tuner">Tuner (T)</button>
      <button class="link stage-close">Exit stage view (Esc)</button>
    </div>`:``}
    <div class="stage-preset">
      <button class="nav stage-prev" aria-label="Previous preset">◀</button>
      <div class="stage-name"><b></b><span class="preset-edited" hidden>edited</span></div>
      <button class="nav stage-next" aria-label="Next preset">▶</button>
    </div>
    ${t===`full`?`<p class="stage-notes"></p>`:``}
    <div class="stage-switches"></div>
    <div class="stage-bottom">
      <div class="stage-master"></div>
      <div class="stage-meter"><div class="meter-bar"><div class="meter-fill"></div></div><small>Out</small></div>
      ${t===`mini`?`<button class="link stage-tuner">Tuner (T)</button>`:``}
    </div>`;let r=e=>n.querySelector(e);r(`.stage-prev`).addEventListener(`click`,()=>e.prev()),r(`.stage-next`).addEventListener(`click`,()=>e.next()),n.querySelector(`.stage-close`)?.addEventListener(`click`,()=>e.close?.()),n.querySelector(`.stage-tuner`)?.addEventListener(`click`,()=>e.tuner());let i=new fe({...e.master.spec,value:e.master.get()});i.onChange=t=>e.master.set(t),r(`.stage-master`).append(i.el);let a=r(`.stage-switches`);function o(){let t=e.preset();r(`.stage-name b`).textContent=t.name,r(`.stage-name .preset-edited`).hidden=!t.edited;let o=n.querySelector(`.stage-notes`);o&&(o.textContent=t.notes??``),a.innerHTML=e.items().map(e=>`
      <button class="stage-fs" data-id="${Ct(e.id)}" aria-pressed="${e.on}">
        <span class="led" aria-hidden="true"></span>
        <span class="stage-fs-name">${Ct(e.label)}</span>
        <kbd>${Ct(e.key)}</kbd>
      </button>`).join(``),a.querySelectorAll(`.stage-fs`).forEach(t=>t.addEventListener(`click`,()=>e.toggle(t.dataset.id))),Math.abs(i.value-e.master.get())>1e-9&&i.set(e.master.get(),!1)}let s=r(`.stage-meter .meter-fill`);return o(),{el:n,refresh:o,level(e,t){s.style.transform=`scaleX(${e})`,n.classList.toggle(`hot`,t)}}}var Tt={off:`Turn on`,empty:`Record`,recording:`Play`,playing:`Overdub`,overdubbing:`Play`,stopped:`Play`},Et={off:`Off`,empty:`Empty`,recording:`Recording`,playing:`Playing`,overdubbing:`Overdubbing`,stopped:`Stopped`},Dt=(e,t)=>{let n=Math.floor(e/t);return`${Math.floor(n/60)}:${String(n%60).padStart(2,`0`)}`};function Ot(e){let t=document.createElement(`div`);t.className=`fxbox looper-box`;let n=null,r=0,i=new fe({label:`Level`,min:-24,max:6,value:e.level.get(),defaultValue:0,step:.5,format:e=>`${e>0?`+`:``}${e.toFixed(1)} dB`});i.onChange=t=>e.level.set(t);function a(){if(!e.enabled()){t.innerHTML=`<div class="fx-brand"><b>Looper</b><small>60 s · stereo</small></div>
        <p class="looper-off">Record a part, loop it, play over it, then layer more on top. Switching presets doesn't change the loop.</p>
        <button class="looper-on">Turn the looper on</button>
        <p class="hint">Keys: L record / play / overdub · K stop · U undo</p>`,t.querySelector(`.looper-on`).addEventListener(`click`,()=>{e.setEnabled(!0),a()});return}t.innerHTML=`<div class="fx-brand"><b>Looper</b><small>60 s · stereo</small></div>
      <div class="looper-ring" aria-hidden="true">
        <svg viewBox="0 0 100 100"><circle class="lr-track" cx="50" cy="50" r="42"/><circle class="lr-arc" cx="50" cy="50" r="42" pathLength="100"/></svg>
        <div class="lr-read"><b class="lr-state">Empty</b><span class="lr-time">0:00</span></div>
      </div>
      <button class="looper-main" title="Record, close the loop and play it, overdub on top (L)">Record</button>
      <div class="looper-row">
        <button class="looper-stop" title="Stop; again to play from the top (K)">Stop</button>
        <button class="looper-undo" title="Undo the last overdub; again to bring it back (U)">Undo</button>
        <button class="looper-clear" title="Erase the loop (two clicks)">Clear</button>
      </div>
      <div class="looper-level"></div>
      <button class="link looper-off-btn" title="Turn the looper off (frees its memory)">Turn off</button>`,t.querySelector(`.looper-level`).append(i.el),t.querySelector(`.looper-main`).addEventListener(`click`,()=>e.command(0)),t.querySelector(`.looper-stop`).addEventListener(`click`,()=>e.command(1)),t.querySelector(`.looper-undo`).addEventListener(`click`,()=>e.command(2));let n=t.querySelector(`.looper-clear`);n.addEventListener(`click`,()=>{r?(clearTimeout(r),r=0,n.textContent=`Clear`,e.command(3)):(n.textContent=`Sure?`,r=window.setTimeout(()=>{r=0,n.textContent=`Clear`},2500))}),t.querySelector(`.looper-off-btn`).addEventListener(`click`,()=>{e.setEnabled(!1),a()}),o()}function o(){let r=n,i=e.powered()?r?.state??`empty`:`off`;t.dataset.state=i;let a=e=>t.querySelector(e),o=a(`.looper-main`);if(!o)return;o.textContent=e.powered()?Tt[i===`off`?`empty`:i]:`Power on first`,o.disabled=!e.powered(),a(`.lr-state`).textContent=e.powered()?Et[i]:`Standby`;let c=s;a(`.lr-time`).textContent=!r||r.length===0?`0:00`:r.state===`recording`?Dt(r.length,c):`${Dt(r.position,c)} / ${Dt(r.length,c)}`;let l=!r||r.length===0||r.state===`recording`?+(r?.state===`recording`):r.position/r.length,u=a(`.lr-arc`);u.style.strokeDasharray=`${(l*100).toFixed(2)} 100`,u.style.opacity=l>0?`1`:`0`;let d=a(`.looper-undo`);d.textContent=r?.canRedo?`Redo`:`Undo`,d.disabled=!r||!r.canUndo&&!r.canRedo,a(`.looper-stop`).textContent=r?.state===`stopped`?`Start`:`Stop`,a(`.looper-stop`).disabled=!r||r.state===`empty`,a(`.looper-clear`).disabled=!r||r.state===`empty`}let s=48e3;return a(),{el:t,render:a,update(e,t){n=e,s=t,o()}}}var kt=`* The '59 tweed bass amp (5F6-A circuit): the preamp, solved as a circuit; the 6L6
* power section (presence in the feedback loop, GZ34 rectifier sag) is
* the *@power model.
* V1 is a 12AY7 (lower gain than a 12AX7: part of why the tweed bass stays
* clean longer), both halves on one 820R/250u cathode, channels jumpered;
* Bright volume with its bright cap, 270k mixers into V2a, DC-coupled into
* the V2b cathode follower and the tweed tone stack.
*
*@amp name="Tweed Bass" face=tweed oversample=4
*@control presence label="Presence" taper=lin default=0.5
*@control middle label="Middle" taper=lin default=0.5
*@control bass label="Bass" taper=audio default=0.5
*@control treble label="Treble" taper=lin default=0.6
*@control bright label="Bright" taper=audio default=0.5
*@control normal label="Normal" taper=audio default=0.4
*@control response label="Response" taper=lin default=0.5
*@power tubes=6L6 nfb=0.3 presence=presence headroom=32 count=2 pi=12AX7 rectifier=GZ34 bplus=430 cap=40 idle=90 full=240 rsource=60 response=response
*@input Vin
*@output out

* The guitar.
Vin src 0 0
Rpickup src in 6k

Vb1 b1 0 DC 330
Vb2 b2 0 DC 300

* V1: 12AY7, both halves on a shared bypassed cathode.
Rg1 in g1 68k
XV1A p1 g1 k1 TRIODE MU=41.78 EX=1.183 KG1=1283.7 KP=328.8 KVB=2847.7
DG1 g1 k1 DGRID
Rg2 in g2 68k
XV1B p2 g2 k1 TRIODE MU=41.78 EX=1.183 KG1=1283.7 KP=328.8 KVB=2847.7
DG2 g2 k1 DGRID
Rk1 k1 0 820
Ck1 k1 0 250u
Rp1 b2 p1 100k
Rp2 b2 p2 100k

* Normal and Bright volumes, mixed.
C1 p1 n1 20n
XNORMAL n1 nw 0 POT R=1meg pos={normal}
Rm1 nw mix 270k
C2 p2 br1 20n
XBRIGHT br1 bw 0 POT R=1meg pos={bright}
Cbr br1 bw 100p
Rm2 bw mix 270k

* V2a gain stage DC-coupled into the V2b cathode follower.
XV2A p3 mix k3 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG3 mix k3 DGRID
Rk3 k3 0 820
Rp3 b2 p3 100k
XV2B b1 p3 k4 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG4 p3 k4 DGRID
Rk4 k4 0 100k

* Tweed tone stack (5F6-A values), from the follower's cathode.
C3 k4 t1 250p
XTREBLE t1 tw tb POT R=250k pos={treble}
Rslope k4 sl 56k
C4 sl tb 20n
C5 sl mt 20n
XBASS tb tb mt POT R=1meg pos={bass}
XMIDDLE mt mt 0 POT R=25k pos={middle}

* Into the phase inverter's grid.
Cpi tw out 20n
Rpi out 0 1meg

.model DGRID D(IS=1n N=1.5 RS=1k)

.subckt TRIODE p g k MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
B1 p k I = { pwr(max(V(p,k)/KP*ln(1+exp(KP*(1/MU+V(g,k)/sqrt(KVB+V(p,k)*V(p,k))))), 0), EX) / KG1 }
.ends

.subckt POT a w b R=10k pos=0.5
Ra a w {R*(1-pos)+1}
Rb w b {R*pos+1}
.ends

.param presence=0.5
.param middle=0.5
.param bass=0.154
.param treble=0.6
.param bright=0.154
.param normal=0.0816
.param response=0.5
.end`,At=`* The 22 W black-panel reverb amp (AB763 circuit), Vibrato channel: the same
* preamp as the Twin's, except there is no Middle control - a fixed 6.8k
* where the Twin's 10k Middle pot sits. Spring reverb and optical Vibrato
* after it, then two 6V6s on a GZ34 tube rectifier: about 22 W, so it
* breaks up early and sags - the most recorded amp there is.
* V2A 100k/1.5k/25u, blackface stack from the plate: Treble 250k, Bass
* 250k, 6.8k mid, 100k slope, 250p/0.1u/0.047u; Volume; second stage.
*
*@amp name="Black Panel 22" face=blackpanel oversample=4
*@control volume label="Volume" taper=audio default=0.4
*@control treble label="Treble" taper=audio default=0.6
*@control bass label="Bass" taper=audio default=0.4
*@control reverb label="Reverb" taper=lin default=0.3
*@control speed label="Speed" taper=lin default=0.5
*@control intensity label="Intensity" taper=lin default=0.0
*@control response label="Response" taper=lin default=0.5
*@power tubes=6V6 nfb=0.4 headroom=22 count=2 pi=12AT7 rectifier=GZ34 bplus=420 cap=16 idle=70 full=150 rsource=120 response=response
*@reverb control=reverb
*@tremolo speed=speed intensity=intensity
*@input Vin
*@output out

* The guitar.
Vin src 0 0
Rpickup src in 6k

Vb2 b2 0 DC 270

* V2A: first stage.
Rleak in 0 1meg
Rg1 in g1 68k
XV2A p1 g1 k1 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG1 g1 k1 DGRID
Rk1 k1 0 1.5k
Ck1 k1 0 25u
Rp1 b2 p1 100k

* Blackface tone stack, plate-driven.
C1 p1 t1 250p
XTREBLE t1 tw tb POT R=250k pos={treble}
Rslope p1 sl 100k
C2 sl tb 100n
C3 sl mt 47n
XBASS tb tb mt POT R=250k pos={bass}
* No Middle control on a Deluxe: a fixed resistor.
RMID mt 0 6.8k

* Volume, then V2B: second stage.
XVOLUME tw vw 0 POT R=1meg pos={volume}
XV2B p2 vw k2 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG2 vw k2 DGRID
Rk2 k2 0 1.5k
Ck2 k2 0 22u
Rp2 b2 p2 100k

* On to the reverb mix and the phase inverter.
Cout p2 out 20n
Rpi out 0 1meg

.model DGRID D(IS=1n N=1.5 RS=1k)

.subckt TRIODE p g k MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
B1 p k I = { pwr(max(V(p,k)/KP*ln(1+exp(KP*(1/MU+V(g,k)/sqrt(KVB+V(p,k)*V(p,k))))), 0), EX) / KG1 }
.ends

.subckt POT a w b R=10k pos=0.5
Ra a w {R*(1-pos)+1}
Rb w b {R*pos+1}
.ends

.param volume=0.0816
.param treble=0.2329
.param bass=0.0816
.param reverb=0.3
.param speed=0.5
.param intensity=0
.param response=0.5
.end`,jt=`* The 4x10 black-panel reverb amp (AB763 circuit), Vibrato channel: the same
* preamp as the Twin's (same tone stack, Middle and all). Spring reverb
* and optical Vibrato after it, then two 6L6s on a GZ34 tube rectifier
* (~45 W: more give than the Twin's solid-state 85 W) into four 10"s.
* V2A 100k/1.5k/25u, blackface stack from the plate: Treble 250k, Bass
* 250k, Middle 10k, 100k slope, 250p/0.1u/0.047u; Volume; second stage.
*
*@amp name="Black Panel 4x10" face=blackpanel oversample=4
*@control volume label="Volume" taper=audio default=0.4
*@control treble label="Treble" taper=audio default=0.6
*@control middle label="Middle" taper=lin default=0.5
*@control bass label="Bass" taper=audio default=0.4
*@control reverb label="Reverb" taper=lin default=0.3
*@control speed label="Speed" taper=lin default=0.5
*@control intensity label="Intensity" taper=lin default=0.0
*@control response label="Response" taper=lin default=0.5
*@power tubes=6L6 nfb=0.45 headroom=36 count=2 pi=12AT7 rectifier=GZ34 bplus=460 cap=20 idle=90 full=240 rsource=70 response=response
*@reverb control=reverb
*@tremolo speed=speed intensity=intensity
*@input Vin
*@output out

* The guitar.
Vin src 0 0
Rpickup src in 6k

Vb2 b2 0 DC 270

* V2A: first stage.
Rleak in 0 1meg
Rg1 in g1 68k
XV2A p1 g1 k1 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG1 g1 k1 DGRID
Rk1 k1 0 1.5k
Ck1 k1 0 25u
Rp1 b2 p1 100k

* Blackface tone stack, plate-driven.
C1 p1 t1 250p
XTREBLE t1 tw tb POT R=250k pos={treble}
Rslope p1 sl 100k
C2 sl tb 100n
C3 sl mt 47n
XBASS tb tb mt POT R=250k pos={bass}
XMIDDLE mt mt 0 POT R=10k pos={middle}

* Volume, then V2B: second stage.
XVOLUME tw vw 0 POT R=1meg pos={volume}
XV2B p2 vw k2 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG2 vw k2 DGRID
Rk2 k2 0 1.5k
Ck2 k2 0 22u
Rp2 b2 p2 100k

* On to the reverb mix and the phase inverter.
Cout p2 out 20n
Rpi out 0 1meg

.model DGRID D(IS=1n N=1.5 RS=1k)

.subckt TRIODE p g k MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
B1 p k I = { pwr(max(V(p,k)/KP*ln(1+exp(KP*(1/MU+V(g,k)/sqrt(KVB+V(p,k)*V(p,k))))), 0), EX) / KG1 }
.ends

.subckt POT a w b R=10k pos=0.5
Ra a w {R*(1-pos)+1}
Rb w b {R*pos+1}
.ends

.param volume=0.0816
.param treble=0.2329
.param middle=0.5
.param bass=0.0816
.param reverb=0.3
.param speed=0.5
.param intensity=0
.param response=0.5
.end`,Mt=`* The 100 W black-panel reverb amp (AB763 circuit), Vibrato channel: the preamp,
* solved as a circuit; the built-in spring reverb and the optical "Vibrato"
* (a tremolo) run after it, then the 4x6L6 power section (heavy feedback,
* solid-state rectifier: almost no sag, the famous clean headroom).
* V2A 100k/1.5k/25u, the blackface tone stack driven straight from the
* plate (no cathode follower): Treble 250k, Bass 250k, Middle 10k, 100k
* slope, 250p/0.1u/0.047u; Volume; second gain stage.
*
*@amp name="Black Panel 100" face=blackpanel oversample=4
*@control volume label="Volume" taper=audio default=0.4
*@control treble label="Treble" taper=audio default=0.6
*@control middle label="Middle" taper=lin default=0.5
*@control bass label="Bass" taper=audio default=0.4
*@control reverb label="Reverb" taper=lin default=0.3
*@control speed label="Speed" taper=lin default=0.5
*@control intensity label="Intensity" taper=lin default=0.0
*@control response label="Response" taper=lin default=0.5
*@power tubes=6L6 nfb=0.5 headroom=45 count=4 pi=12AT7 rectifier=silicon bplus=460 cap=100 idle=150 full=460 rsource=20 response=response
*@reverb control=reverb
*@tremolo speed=speed intensity=intensity
*@input Vin
*@output out

* The guitar.
Vin src 0 0
Rpickup src in 6k

Vb2 b2 0 DC 270

* V2A: first stage.
Rleak in 0 1meg
Rg1 in g1 68k
XV2A p1 g1 k1 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG1 g1 k1 DGRID
Rk1 k1 0 1.5k
Ck1 k1 0 25u
Rp1 b2 p1 100k

* Blackface tone stack, plate-driven.
C1 p1 t1 250p
XTREBLE t1 tw tb POT R=250k pos={treble}
Rslope p1 sl 100k
C2 sl tb 100n
C3 sl mt 47n
XBASS tb tb mt POT R=250k pos={bass}
XMIDDLE mt mt 0 POT R=10k pos={middle}

* Volume, then V2B: second stage.
XVOLUME tw vw 0 POT R=1meg pos={volume}
XV2B p2 vw k2 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG2 vw k2 DGRID
Rk2 k2 0 1.5k
Ck2 k2 0 22u
Rp2 b2 p2 100k

* On to the reverb mix and the phase inverter.
Cout p2 out 20n
Rpi out 0 1meg

.model DGRID D(IS=1n N=1.5 RS=1k)

.subckt TRIODE p g k MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
B1 p k I = { pwr(max(V(p,k)/KP*ln(1+exp(KP*(1/MU+V(g,k)/sqrt(KVB+V(p,k)*V(p,k))))), 0), EX) / KG1 }
.ends

.subckt POT a w b R=10k pos=0.5
Ra a w {R*(1-pos)+1}
Rb w b {R*pos+1}
.ends

.param volume=0.0816
.param treble=0.2329
.param middle=0.5
.param bass=0.0816
.param reverb=0.3
.param speed=0.5
.param intensity=0
.param response=0.5
.end`,Nt=`* The first British 45 W head (1965 circuit, also in the 1962 combo): a British
* copy of the '59 tweed bass amp. The preamp is the 5F6-A's - both V1 halves on
* one 820R/250u cathode, 270k mixers, V2a DC-coupled into the V2b cathode
* follower, the 56k-slope stack - with a 12AX7 in V1 where the tweed bass has
* a 12AY7 (more gain: why it breaks up sooner), a 500p bright cap on the
* High Treble channel and 22n stack caps. Two KT66s on a GZ34 rectifier.
* The amp of the mid-60s British blues-rock records.
*
*@amp name="Brit 45" face=plexi oversample=4
*@control presence label="Presence" taper=lin default=0.5
*@control middle label="Middle" taper=lin default=0.5
*@control bass label="Bass" taper=audio default=0.5
*@control treble label="Treble" taper=lin default=0.6
*@control loud1 label="Loudness I" taper=audio default=0.5
*@control loud2 label="Loudness II" taper=audio default=0.3
*@control response label="Response" taper=lin default=0.5
*@power tubes=KT66 nfb=0.3 presence=presence headroom=30 count=2 pi=12AX7 rectifier=GZ34 bplus=430 cap=32 idle=90 full=230 rsource=70 response=response
*@input Vin
*@output out

* The guitar.
Vin src 0 0
Rpickup src in 6k

Vb1 b1 0 DC 330
Vb2 b2 0 DC 300

* V1: 12AX7 (ECC83), both halves on a shared bypassed cathode.
Rg1 in g1 68k
XV1A p1 g1 k1 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG1 g1 k1 DGRID
Rg2 in g2 68k
XV1B p2 g2 k1 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG2 g2 k1 DGRID
Rk1 k1 0 820
Ck1 k1 0 250u
Rp1 b2 p1 100k
Rp2 b2 p2 100k

* Loudness II (Normal) and Loudness I (High Treble), mixed.
C1 p1 n1 20n
XLOUD2 n1 nw 0 POT R=1meg pos={loud2}
Rm1 nw mix 270k
C2 p2 br1 20n
XLOUD1 br1 bw 0 POT R=1meg pos={loud1}
Cbr br1 bw 500p
Rm2 bw mix 270k

* V2a gain stage DC-coupled into the V2b cathode follower.
XV2A p3 mix k3 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG3 mix k3 DGRID
Rk3 k3 0 820
Rp3 b2 p3 100k
XV2B b1 p3 k4 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG4 p3 k4 DGRID
Rk4 k4 0 100k

* The tone stack (5F6-A layout, 22n caps), from the follower's cathode.
C3 k4 t1 250p
XTREBLE t1 tw tb POT R=250k pos={treble}
Rslope k4 sl 56k
C4 sl tb 22n
C5 sl mt 22n
XBASS tb tb mt POT R=1meg pos={bass}
XMIDDLE mt mt 0 POT R=25k pos={middle}

* Into the phase inverter's grid.
Cpi tw out 20n
Rpi out 0 1meg

.model DGRID D(IS=1n N=1.5 RS=1k)

.subckt TRIODE p g k MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
B1 p k I = { pwr(max(V(p,k)/KP*ln(1+exp(KP*(1/MU+V(g,k)/sqrt(KVB+V(p,k)*V(p,k))))), 0), EX) / KG1 }
.ends

.subckt POT a w b R=10k pos=0.5
Ra a w {R*(1-pos)+1}
Rb w b {R*pos+1}
.ends

.param presence=0.5
.param middle=0.5
.param bass=0.154
.param treble=0.6
.param loud1=0.1545
.param loud2=0.0612
.param response=0.5
.end`,Pt=`* The late-'60s British 100 W "plexi" head (1959 circuit): the preamp,
* solved as a circuit; the EL34 power section is the *@power model.
* Both channels jumpered, the way it's usually played: the guitar feeds
* V1a (High Treble, Loudness I, 5000p bright cap) and V1b (Normal,
* Loudness II); 470k mixers into V2a, DC-coupled to the V2b cathode
* follower that drives the British tone stack.
*
*@amp name="Brit Plexi 100" face=plexi oversample=4
*@control presence label="Presence" taper=lin default=0.5
*@control bass label="Bass" taper=audio default=0.5
*@control middle label="Middle" taper=lin default=0.5
*@control treble label="Treble" taper=lin default=0.6
*@control loud1 label="Loudness I" taper=audio default=0.6
*@control loud2 label="Loudness II" taper=audio default=0.4
*@control response label="Response" taper=lin default=0.5
*@power tubes=EL34 nfb=0.35 presence=presence headroom=34 count=4 pi=12AX7 rectifier=silicon bplus=470 cap=50 idle=140 full=450 rsource=25 response=response
*@input Vin
*@output out

* The guitar.
Vin src 0 0
Rpickup src in 6k

* Supplies (B+ after the preamp dropping resistors).
Vb1 b1 0 DC 330
Vb2 b2 0 DC 300

* V1a: High Treble channel.
Rg1 in g1 68k
XV1A p1 g1 k1 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG1 g1 k1 DGRID
Rk1 k1 0 820
Ck1 k1 0 0.68u
Rp1 b2 p1 100k
C1 p1 v1t 22n
XLOUD1 v1t vw1 0 POT R=1meg pos={loud1}
Cbr v1t vw1 5n
Rm1 vw1 mix 470k

* V1b: Normal channel.
Rg2 in g2 68k
XV1B p2 g2 k2 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG2 g2 k2 DGRID
Rk2 k2 0 820
Ck2 k2 0 250u
Rp2 b2 p2 100k
C2 p2 v2t 22n
XLOUD2 v2t vw2 0 POT R=1meg pos={loud2}
Rm2 vw2 mix 470k

* V2a gain stage, DC-coupled into the V2b cathode follower.
XV2A p3 mix k3 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG3 mix k3 DGRID
Rk3 k3 0 820
Rp3 b2 p3 100k
XV2B b1 p3 k4 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG4 p3 k4 DGRID
Rk4 k4 0 100k

* British tone stack, driven from the follower's cathode.
C3 k4 t1 470p
XTREBLE t1 tw tb POT R=220k pos={treble}
Rslope k4 sl 33k
C4 sl tb 22n
C5 sl mt 22n
XBASS tb tb mt POT R=1meg pos={bass}
XMIDDLE mt mt 0 POT R=25k pos={middle}

* Into the phase inverter's grid.
Cpi tw out 22n
Rpi out 0 1meg

.model DGRID D(IS=1n N=1.5 RS=1k)

.subckt TRIODE p g k MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
B1 p k I = { pwr(max(V(p,k)/KP*ln(1+exp(KP*(1/MU+V(g,k)/sqrt(KVB+V(p,k)*V(p,k))))), 0), EX) / KG1 }
.ends

.subckt POT a w b R=10k pos=0.5
Ra a w {R*(1-pos)+1}
Rb w b {R*pos+1}
.ends

.param bass=0.154
.param middle=0.5
.param treble=0.6
.param loud1=0.2329
.param loud2=0.0816
.param presence=0.5
.param response=0.5
.end`,Ft=`* The early-80s British 100 W master-volume head (2203 circuit): the preamp, solved as a
* circuit; the EL34 power section is the *@power model.
* First stage 100k / 2.7k with a small 0.68u bypass (bass kept out of the
* distortion), 470k || 470p into the Pre-amp volume, the 10k "cold
* clipper" second stage that gives the 800 its tight crunch, an 820R third
* stage DC-coupled into the cathode follower, the British tone stack, and
* the Master volume ahead of the phase inverter.
*
*@amp name="Brit 800" face=brit800 oversample=4
*@control presence label="Presence" taper=lin default=0.5
*@control bass label="Bass" taper=audio default=0.5
*@control middle label="Middle" taper=lin default=0.6
*@control treble label="Treble" taper=lin default=0.6
*@control master label="Master" taper=audio default=0.6
*@control preamp label="Pre-amp" taper=audio default=0.6
*@control response label="Response" taper=lin default=0.5
*@power tubes=EL34 nfb=0.35 presence=presence headroom=30 count=4 pi=12AX7 rectifier=silicon bplus=470 cap=50 idle=140 full=450 rsource=25 response=response
*@input Vin
*@output out

* The guitar.
Vin src 0 0
Rpickup src in 6k

Vb1 b1 0 DC 330
Vb2 b2 0 DC 300

* First stage.
Rg1 in g1 68k
XV1B p1 g1 k1 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG1 g1 k1 DGRID
Rk1 k1 0 2.7k
Ck1 k1 0 0.68u
Rp1 b2 p1 100k

* 470k || 470p into the Pre-amp volume.
C1 p1 a1 22n
Ra a1 pt 470k
Cpk a1 pt 470p
XPREAMP pt pw 0 POT R=1meg pos={preamp}

* Second stage: the cold clipper (10k unbypassed cathode).
XV1A p2 pw k2 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG2 pw k2 DGRID
Rk2 k2 0 10k
Rp2 b2 p2 100k

* Third stage, DC-coupled into the cathode follower.
C2 p2 g3 22n
Rgl3 g3 0 470k
XV2A p3 g3 k3 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG3 g3 k3 DGRID
Rk3 k3 0 820
Ck3 k3 0 0.68u
Rp3 b2 p3 100k
XV2B b1 p3 k4 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG4 p3 k4 DGRID
Rk4 k4 0 100k

* British tone stack.
C3 k4 t1 470p
XTREBLE t1 tw tb POT R=220k pos={treble}
Rslope k4 sl 33k
C4 sl tb 22n
C5 sl mt 22n
XBASS tb tb mt POT R=1meg pos={bass}
XMIDDLE mt mt 0 POT R=25k pos={middle}

* Master volume, then the phase inverter's grid.
Cm tw mtop 22n
XMASTER mtop mw 0 POT R=1meg pos={master}
Cpi mw out 22n
Rpi out 0 1meg

.model DGRID D(IS=1n N=1.5 RS=1k)

.subckt TRIODE p g k MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
B1 p k I = { pwr(max(V(p,k)/KP*ln(1+exp(KP*(1/MU+V(g,k)/sqrt(KVB+V(p,k)*V(p,k))))), 0), EX) / KG1 }
.ends

.subckt POT a w b R=10k pos=0.5
Ra a w {R*(1-pos)+1}
Rb w b {R*pos+1}
.ends

.param presence=0.5
.param bass=0.154
.param middle=0.6
.param treble=0.6
.param master=0.2329
.param preamp=0.2329
.param response=0.5
.end`,It=`* The 1970s British 100 W high-headroom head (DR103 circuit): the preamp, solved as a
* circuit, per the component list at circuitcodex.com/amps/dr103. Normal
* and Brilliant channels jumpered: V1 (two 12AX7 halves, 220k plates, one
* 1.5k/100u cathode), the Brilliant channel coupled through only 1n (its
* brightness), 470k volumes and 470k mixers into V2B (220k, unbypassed
* 2.2k), DC into the V2A cathode follower (120k) that drives the tone stack
* (100p / 220k Treble, 470k Bass, 22k Middle, 47n / 47n, 100k slope); the
* Treble wiper through 220k to the 470k Master; V3B driver (100k, 2.2k
* with 47n: a treble lift), then the V3A cathode follower (grid fed from
* V3B's plate through 1.8M) into the 12AT7 phase inverter. Four EL34s on
* a silicon bridge and 2x220u at 480 V: loud, clean and stiff.
*
*@amp name="Brit Clean 100" face=britclean oversample=4
*@control normal label="Normal" taper=audio default=0.5
*@control brilliant label="Brilliant" taper=audio default=0.3
*@control bass label="Bass" taper=audio default=0.5
*@control treble label="Treble" taper=lin default=0.5
*@control middle label="Middle" taper=lin default=0.5
*@control presence label="Presence" taper=lin default=0.4
*@control master label="Master" taper=audio default=0.5
*@control response label="Response" taper=lin default=0.5
*@power tubes=EL34 nfb=0.45 presence=presence headroom=40 count=4 pi=12AT7 rectifier=silicon bplus=480 cap=110 idle=150 full=460 rsource=20 response=response
*@input Vin
*@output out

* The guitar.
Vin src 0 0
Rpickup src in 6k

* Preamp supplies (after the droppers).
Vb5 b5 0 DC 320
Vb3 b3 0 DC 400

* V1: both channels, one shared bypassed cathode.
R1s in g1 68k
Rg1 g1 0 1meg
R3s in g2 68k
Rg2 g2 0 1meg
XV1A p1 g1 k1 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG1 g1 k1 DGRID
XV1B p2 g2 k1 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG2 g2 k1 DGRID
Rk1 k1 0 1.5k
Ck1 k1 0 100u
Rl1 b5 p1 220k
Rl2 b5 p2 220k

* Brilliant (1n coupling) and Normal (10n) volumes, mixed.
C2 p1 v1t 1n
XBRILLIANT v1t vw1 0 POT R=470k pos={brilliant}
C3 p2 v2t 10n
XNORMAL v2t vw2 0 POT R=470k pos={normal}
Rm1 vw1 mix 470k
Rm2 vw2 mix 470k

* V2B gain stage, DC into the V2A cathode follower.
XV2B p3 mix k3 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG3 mix k3 DGRID
Rk2 k3 0 2.2k
Rl3 b3 p3 220k
XV2A b3 p3 k4 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG4 p3 k4 DGRID
Rkcf k4 0 120k

* The tone stack, from the follower's cathode.
C4 k4 t1 100p
XTREBLE t1 tw tb POT R=220k pos={treble}
Rslope k4 sl 100k
C5 sl tb 47n
C6 sl mt 47n
XBASS tb tb mt POT R=470k pos={bass}
XMIDDLE mt mt 0 POT R=22k pos={middle}

* Treble wiper through 220k to the Master.
Rtm tw mv 220k
XMASTER mv mw 0 POT R=470k pos={master}

* V3B driver, partly bypassed cathode.
XV3B p5 mw k5 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG5 mw k5 DGRID
Rk3 k5 0 2.2k
Ck3 k5 0 47n
Rl4 b3 p5 100k

* V3A cathode follower: grid from V3B's plate (22n || 1.8M), 1M down.
C8 p5 g6 22n
R18 p5 g6 1.8meg
Rg3 g6 0 1meg
XV3A b3 g6 k6 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG6 g6 k6 DGRID
Rkcf2 k6 0 220k

* Into the phase inverter's grid.
Cpi k6 out 100n
Rpi out 0 1meg

.model DGRID D(IS=1n N=1.5 RS=1k)

.subckt TRIODE p g k MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
B1 p k I = { pwr(max(V(p,k)/KP*ln(1+exp(KP*(1/MU+V(g,k)/sqrt(KVB+V(p,k)*V(p,k))))), 0), EX) / KG1 }
.ends

.subckt POT a w b R=10k pos=0.5
Ra a w {R*(1-pos)+1}
Rb w b {R*pos+1}
.ends

.param normal=0.1545
.param brilliant=0.0612
.param bass=0.1545
.param treble=0.5
.param middle=0.5
.param presence=0.4
.param master=0.1545
.param response=0.5
.end
`,Lt=`* The early-70s British "graphic-panel" 120 W head (Mk II circuit), the preamp solved as a
* circuit from the 1972 schematics as redrawn by B. Hickmott (el34world).
* V1A (220k / 2.2k / 50u) into its own tone stack: a Baxandall-like
* sum of a Bass network (100k into a 1M pot with 2.2n top-to-wiper, 22n
* wiper-to-bottom, 22k to ground; wiper through 100k) and a Treble network
* (1.5n into a 1M pot over 10n). The 1M Gain pot (330p bright cap) feeds
* V1B (220k / 2.2k / 50u), then the six-way voicing switch: a chain of 4.7n, 4.7n, 2.2n,
* 1n and 330p that a six-way switch taps - each click adds a cap in
* series and takes more low end away. Then V2A (100k, 1n across the plate
* load) whose 1.5k cathode carries the HF "Boost": a 1k pot feeding a 2 mH
* choke and 0.47u to ground, a series resonance near 5 kHz that bypasses
* the cathode there. Into the cathodyne; four EL34s on a silicon bridge.
*
*@amp name="Graphic 120" face=graphic oversample=4
*@control gain label="Gain" taper=audio default=0.5
*@control bass label="Bass" taper=audio default=0.5
*@control treble label="Treble" taper=audio default=0.5
*@control fac label="Voicing" taper=lin default=0 positions="1,2,3,4,5,6"
*@control boost label="HF Drive" taper=lin default=0.3
*@control response label="Response" taper=lin default=0.5
*@power tubes=EL34 nfb=0.25 headroom=36 count=4 pi=12AX7 rectifier=silicon bplus=480 cap=50 idle=150 full=460 rsource=25 response=response
*@input Vin
*@output out

* The guitar.
Vin src 0 0
Rpickup src in 6k

* Preamp supplies (C+ and D+, after the 33k droppers).
Vc vc 0 DC 330
Vd vd 0 DC 300

* V1A.
R68 in g1 68k
Rg1 g1 0 1meg
XV1A p1 g1 k1 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG1 g1 k1 DGRID
Rk1 k1 0 2.2k
Ck1 k1 0 50u
Rp1 vd p1 220k
C1 p1 t 68n

* The tone stack: Bass network ...
Rb1 t bt 100k
XBASS bt bw bb POT R=1meg pos={bass}
Cb1 bt bw 2.2n
Cb2 bw bb 22n
Rb2 bb 0 22k
Rb3 bw o 100k
* ... and Treble network, summed at the Treble wiper.
Ct1 t tt 1.5n
XTREBLE tt o tb POT R=1meg pos={treble}
Ct2 tb 0 10n

* Gain, with its bright cap, into V1B.
XGAIN o gw 0 POT R=1meg pos={gain}
Cg o gw 330p
XV1B p2 gw k2 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG2 gw k2 DGRID
Rk2 k2 0 2.2k
Ck2 k2 0 50u
Rp2 vd p2 220k
C2 p2 f0 68n

* Voicing: the switch taps a chain of series caps.
Cf1 f0 f1 4.7n
Cf2 f1 f2 4.7n
Cf3 f2 f3 2.2n
Cf4 f3 f4 1n
Cf5 f4 f5 330p
XFAC1 f0 fo SW pos={fac} k=0 n=6
XFAC2 f1 fo SW pos={fac} k=1 n=6
XFAC3 f2 fo SW pos={fac} k=2 n=6
XFAC4 f3 fo SW pos={fac} k=3 n=6
XFAC5 f4 fo SW pos={fac} k=4 n=6
XFAC6 f5 fo SW pos={fac} k=5 n=6

* V2A (through the 100k of the reverb loop), 1n across its plate load,
* the HF Drive network on its cathode.
Rin2 fo g3 100k
Rg3 g3 0 200k
XV2A p3 g3 k3 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG3 g3 k3 DGRID
Rp3 vc p3 100k
Cp3 vc p3 1n
Rk3 k3 0 1.5k
XBOOST k3 bw2 0 POT R=1k pos={boost}
Lb bw2 bl 2m
Cbst bl 0 0.47u

* Into the cathodyne phase inverter's grid.
C3 p3 out 68n
Rpi out 0 1meg

.model DGRID D(IS=1n N=1.5 RS=1k)

.subckt TRIODE p g k MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
B1 p k I = { pwr(max(V(p,k)/KP*ln(1+exp(KP*(1/MU+V(g,k)/sqrt(KVB+V(p,k)*V(p,k))))), 0), EX) / KG1 }
.ends

.subckt POT a w b R=10k pos=0.5
Ra a w {R*(1-pos)+1}
Rb w b {R*pos+1}
.ends

* A switch throw: closed (1 ohm) at position k of n, open (1 Gohm) otherwise.
.subckt SW a b pos=0 k=0 n=2
R1 a b {abs(pos*(n-1)-k) < 0.5 ? 1 : 1e9}
.ends

.param gain=0.1545
.param bass=0.1545
.param treble=0.1545
.param fac=0
.param boost=0.3
.param response=0.5
.end
`,Rt=`* The late-80s hot-rod 100 W super-lead head (1987 circuit), the preamp solved as a
* circuit from the revised schematic (Mar 1996 drawing with corrections,
* el34world), including the builders' correction that the clean channel
* is fed from before the lead channel's 2n || 470k network, and the 1n
* across the Overdrive Preamp pot that real units have. Input V1b (220k /
* 1.8k / 1u). Lead: 2n || 470k, Overdrive Preamp (500k), 470k into V2a
* (100k / 1.8k / 1u), 470k into V2b - the cold stage: 39k unbypassed
* cathode, 1n across its 100k plate load - whose clipping is its grind.
* Clean: 470k into the Normal Volume and V1a (100k, 2.2k unbypassed) through
* 2.2M || 120p. Both meet at 330k, then V3b (220k / 1.8k / 1u) with its
* cathode follower, and the FX return stage (V4b 220k / 2.2k, V4a follower)
* into the British-type stack (470p / 250k Treble, 47k slope, 20n / 20n,
* 1M Bass, 25k Middle) and the two Masters. Optocouplers switch channels:
* VR1 + VR4 on in Clean, VR2 + VR3 in Overdrive (here SW throws). Four 6L6s
* on ~497 V silicon. Eight triodes: the heaviest amp here.
*
*@amp name="Hot Rod 100" face=hotrod oversample=4
*@control normalvol label="Normal" taper=audio default=0.5
*@control preamp label="Preamp" taper=audio default=0.6
*@control bass label="Bass" taper=audio default=0.5
*@control middle label="Middle" taper=lin default=0.5
*@control treble label="Treble" taper=lin default=0.5
*@control normmaster label="Norm Master" taper=audio default=0.5
*@control odmaster label="OD Master" taper=audio default=0.4
*@control mode label="Mode" taper=lin default=1 positions="Clean,Overdrive"
*@control presence label="Presence" taper=lin default=0.4
*@control response label="Response" taper=lin default=0.5
*@power tubes=6L6 nfb=0.35 presence=presence headroom=36 count=4 pi=12AX7 rectifier=silicon bplus=497 cap=200 idle=160 full=480 rsource=20 response=response
*@input Vin
*@output out

* The guitar.
Vin src 0 0
Rpickup src in 6k

* Preamp supplies (B2, B3, B4 on the schematic).
Vb2 b2 0 DC 378
Vb3 b3 0 DC 350
Vb4 b4 0 DC 359

* V1b: input stage.
R2 in g1 68k
R1 g1 0 1meg
XV1B p1 g1 k1 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG1 g1 k1 DGRID
R3 k1 0 1.8k
C1 k1 0 1u
R4 b4 p1 220k
C2 p1 a 20n

* Lead channel: 2n || 470k, Overdrive Preamp (1n across it), 470k to V2a.
C3 a b 2n
R5 a b 470k
XPREAMP b pw 0 POT R=500k pos={preamp}
C100 b pw 1n
R8 pw g2 470k
XV2A p2 g2 k2 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG2 g2 k2 DGRID
R9 k2 0 1.8k
C4 k2 0 1u
R11 b3 p2 100k
C6 p2 c6 20n
R12 c6 c 470k
R13 c 0 1meg
* VR1 (clean mode) shunts the lead path.
XVR1 c 0 SW pos={mode} k=0 n=2

* V2b: the cold stage.
XV2B p3 c k3 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG3 c k3 DGRID
R14 k3 0 39k
R19 b3 p3 100k
C9 b3 p3 1n
C10 p3 d 20n
R20 d 0 2.2meg

* Clean channel (fed from before the 2n || 470k): 470k, Normal Volume, V1a.
R10 a n1 470k
XNORMAL n1 nw 0 POT R=500k pos={normalvol}
XV1A p4 nw k4 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG4 nw k4 DGRID
R16 k4 0 2.2k
R15 b4 p4 100k
C7 p4 e 20n
R17 e x 2.2meg
C8 e x 120p
R18 x 0 330k
* VR2 (overdrive mode) brings the lead channel in.
XVR2 d x SW pos={mode} k=1 n=2

* V3b gain stage, DC into the V3a cathode follower.
R21 x g5 220k
XV3B p5 g5 k5 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG5 g5 k5 DGRID
R23 k5 0 1.8k
C11 k5 0 1u
R22 b2 p5 220k
XV3A b2 p5 k6 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG6 p5 k6 DGRID
R25 k6 0 100k

* The FX loop (send normalled to return) into the return stage.
C12 k6 r 1u
R26 r 0 1meg
XV4B p7 r k7 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG7 r k7 DGRID
R27 k7 0 2.2k
R28 b2 p7 220k
XV4A b2 p7 k8 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG8 p7 k8 DGRID
R29 k8 0 100k

* The tone stack, from V4a's cathode.
C14 k8 t1 470p
XTREBLE t1 tw tb POT R=250k pos={treble}
R30 k8 sl 47k
C15 sl tb 20n
C16 sl mt 20n
XBASS tb tb mt POT R=1meg pos={bass}
XMIDDLE mt mt 0 POT R=25k pos={middle}

* The two Masters; VR3 (overdrive) / VR4 (clean) pick one.
XODMV tw ow 0 POT R=1meg pos={odmaster}
XNORMMV tw nmw 0 POT R=1meg pos={normmaster}
XVR3 ow y SW pos={mode} k=1 n=2
XVR4 nmw y SW pos={mode} k=0 n=2
Ry y 0 10meg

* Into the phase inverter's grid.
C17 y out 20n
Rpi out 0 1meg

.model DGRID D(IS=1n N=1.5 RS=1k)

.subckt TRIODE p g k MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
B1 p k I = { pwr(max(V(p,k)/KP*ln(1+exp(KP*(1/MU+V(g,k)/sqrt(KVB+V(p,k)*V(p,k))))), 0), EX) / KG1 }
.ends

.subckt POT a w b R=10k pos=0.5
Ra a w {R*(1-pos)+1}
Rb w b {R*pos+1}
.ends

* A switch throw: closed (1 ohm) at position k of n, open (1 Gohm) otherwise.
.subckt SW a b pos=0 k=0 n=2
R1 a b {abs(pos*(n-1)-k) < 0.5 ? 1 : 1e9}
.ends

.param normalvol=0.1545
.param preamp=0.2310
.param bass=0.1545
.param middle=0.5
.param treble=0.5
.param normmaster=0.1545
.param odmaster=0.0990
.param mode=1
.param presence=0.4
.param response=0.5
.end
`,zt=`* Boutique overdrive-special style. The originals were potted in epoxy, so
* this follows the original ODS design as traced by builders (the "Dumb
* Bell" notes at schematicheaven.net, ElectroSmash-era forum analyses):
* a black-panel-derived clean channel - V1A (100k / 1.5k / 25u) into a plate-
* driven tone stack (500p treble cap, 20n mid, 100n bass, 100k slope;
* Treble 250k, Bass 250k, Middle 25k), the 1M Volume, then 220k bypassed by
* 500p into V1B (100k / 1.5k) - and, with Overdrive switched in, two more
* cascaded stages (10n couplings, 100k / 1.5k with partly bypassed
* cathodes, the Drive pot between them) into the Level control (47p bright
* cap). The switch picks clean or overdrive into the pre-PI Master. Four
* 6L6s on a ~465 V silicon supply with a choke; presence in the feedback.
* With overdrive in, the clean Volume becomes a gain control too: the
* cascade the amp is famous for.
*
*@amp name="Boutique ODS" face=boutique oversample=4
*@control volume label="Volume" taper=audio default=0.45
*@control treble label="Treble" taper=lin default=0.5
*@control middle label="Middle" taper=lin default=0.5
*@control bass label="Bass" taper=audio default=0.4
*@control drive label="Drive" taper=lin default=0.5
*@control level label="Level" taper=audio default=0.35
*@control mode label="Mode" taper=lin default=0 positions="Clean,Overdrive"
*@control master label="Master" taper=audio default=0.6
*@control presence label="Presence" taper=lin default=0.4
*@control response label="Response" taper=lin default=0.5
*@power tubes=6L6 nfb=0.4 presence=presence headroom=40 count=4 pi=12AX7 rectifier=silicon bplus=465 cap=100 idle=150 full=460 rsource=20 response=response
*@input Vin
*@output out

* The guitar.
Vin src 0 0
Rpickup src in 6k

* Preamp supplies (the last two filter stages: ~323 V and ~361 V).
Vb1 b1 0 DC 323
Vb2 b2 0 DC 361

* V1A: input stage.
Rin in g1 68k
Rgl g1 0 1meg
XV1A p1 g1 k1 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG1 g1 k1 DGRID
Rk1 k1 0 1.5k
Ck1 k1 0 25u
Rp1 b1 p1 100k

* The tone stack, plate-driven.
Ct p1 t1 500p
XTREBLE t1 tw tb POT R=250k pos={treble}
Rslope p1 sl 100k
Cb sl tb 100n
Cm sl mt 20n
XBASS tb tb mt POT R=250k pos={bass}
XMIDDLE mt mt 0 POT R=25k pos={middle}

* Volume, then 220k || 500p into V1B.
XVOLUME tw vw 0 POT R=1meg pos={volume}
Rv vw g2 220k
Cv vw g2 500p
XV1B p2 g2 k2 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG2 g2 k2 DGRID
Rk2 k2 0 1.5k
Ck2 k2 0 25u
Rp2 b1 p2 100k

* Clean path out of V1B.
Ccl p2 clean 22n
Rcl clean 0 1meg

* Overdrive: two cascaded stages, Drive between them.
Co1 p2 g3 10n
Rg3 g3 0 1meg
XV2A p3 g3 k3 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG3 g3 k3 DGRID
Rk3 k3 0 1.5k
Ck3 k3 0 1u
Rp3 b2 p3 100k
Co2 p3 d1 10n
Rd d1 dtop 100k
XDRIVE dtop g4 0 POT R=100k pos={drive}
XV2B p4 g4 k4 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG4 g4 k4 DGRID
Rk4 k4 0 1.5k
Ck4 k4 0 1u
Rp4 b2 p4 100k
Co3 p4 lv 22n
XLEVEL lv od 0 POT R=1meg pos={level}
Clv lv od 47p

* The Clean / Overdrive switch, then the pre-PI Master.
XSWC clean pre SW pos={mode} k=0 n=2
XSWO od pre SW pos={mode} k=1 n=2
Rpre pre 0 1meg
XMASTER pre mw 0 POT R=1meg pos={master}

* Into the phase inverter's grid.
Cpi mw out 100n
Rpi out 0 1meg

.model DGRID D(IS=1n N=1.5 RS=1k)

.subckt TRIODE p g k MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
B1 p k I = { pwr(max(V(p,k)/KP*ln(1+exp(KP*(1/MU+V(g,k)/sqrt(KVB+V(p,k)*V(p,k))))), 0), EX) / KG1 }
.ends

.subckt POT a w b R=10k pos=0.5
Ra a w {R*(1-pos)+1}
Rb w b {R*pos+1}
.ends

* A switch throw: closed (1 ohm) at position k of n, open (1 Gohm) otherwise.
.subckt SW a b pos=0 k=0 n=2
R1 a b {abs(pos*(n-1)-k) < 0.5 ? 1 : 1e9}
.ends

.param volume=0.1063
.param treble=0.5
.param middle=0.5
.param bass=0.0816
.param drive=0.5
.param level=0.079
.param mode=0
.param master=0.2329
.param presence=0.4
.param response=0.5
.end
`,Bt=`* The 30 W class-A combo's top-boost circuit, Brilliant channel: the preamp, solved as a circuit;
* the EL84 power section (cathode-biased, no negative feedback, Cut
* control) is the *@power model.
* V1's two halves share a 1.5k/25u cathode, so the idle Normal half is
* modelled too (it sets the bias). Brilliant volume with its 100p cap,
* top-boost gain stage and cathode follower into the Treble/Bass stack
* (the tweed bass topology with a fixed 10k for the missing Middle), 470k
* mixer into V3, then on to the phase inverter.
*
*@amp name="Class A 30" face=classa oversample=4
*@control volume label="Volume" taper=audio default=0.55
*@control treble label="Treble" taper=audio default=0.6
*@control bass label="Bass" taper=audio default=0.5
*@control cut label="Cut" taper=lin default=0.3
*@control response label="Response" taper=lin default=0.5
*@power tubes=EL84 nfb=0 cut=cut headroom=30 count=4 pi=12AX7 rectifier=GZ34 bplus=335 cap=32 idle=200 full=270 rsource=40 response=response
*@input Vin
*@output out

* The guitar.
Vin src 0 0
Rpickup src in 6k

* Supplies.
Vb1 b1 0 DC 250
Vb2 b2 0 DC 260
Vb3 b3 0 DC 270

* V1: Brilliant half (V1B) driven, Normal half (V1A) idle; shared cathode.
Rleak in 0 1meg
Rg1 in g1 68k
XV1B p1 g1 k1 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG1 g1 k1 DGRID
Rga ga 0 1meg
XV1A pa ga k1 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
Rpa b1 pa 220k
Rk1 k1 0 1.5k
Ck1 k1 0 25u
Rp1 b1 p1 220k

* Brilliant volume with its brilliance cap.
C1 p1 v1t 47n
XVOLUME v1t vw 0 POT R=1meg pos={volume}
Cbr v1t vw 100p
Rs2 vw g2 100k

* top-boost gain stage, DC-coupled into the cathode follower.
XV2A p2 g2 k2 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG2 g2 k2 DGRID
Rk2 k2 0 1.8k
Ck2 k2 0 25u
Rp2 b2 p2 220k
XV2B b2 p2 k3 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG3 p2 k3 DGRID
Rk3 k3 0 56k

* Top-boost tone stack.
Ct k3 t1 50p
XTREBLE t1 tw tb POT R=1meg pos={treble}
Rslope k3 sl 100k
Cb sl tb 22n
Cm sl mt 22n
XBASS tb tb mt POT R=1meg pos={bass}
Rmid mt 0 10k

* 470k mixer (the Normal channel's mixer to ground) into V3.
Rmix tw mix 470k
Rmix2 mix 0 470k
XV3 p4 mix k4 TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
DG4 mix k4 DGRID
Rk4 k4 0 1.5k
Rp4 b3 p4 220k

* Into the phase inverter's grid.
Cpi p4 out 22n
Rpi out 0 1meg

.model DGRID D(IS=1n N=1.5 RS=1k)

.subckt TRIODE p g k MU=100 EX=1.4 KG1=1060 KP=600 KVB=300
B1 p k I = { pwr(max(V(p,k)/KP*ln(1+exp(KP*(1/MU+V(g,k)/sqrt(KVB+V(p,k)*V(p,k))))), 0), EX) / KG1 }
.ends

.subckt POT a w b R=10k pos=0.5
Ra a w {R*(1-pos)+1}
Rb w b {R*pos+1}
.ends

.param volume=0.2
.param treble=0.2329
.param bass=0.154
.param cut=0.3
.param response=0.5
.end`;function D(e,t,n,r){return{id:e,name:/^\*@amp\b.*?name="([^"]+)"/im.exec(t)?.[1]??e,model:n,face:/^\*@amp\b.*?face=(\w+)/im.exec(t)?.[1]??`tweed`,netlist:t,controls:[...t.matchAll(/^\*@control\s+(\S+)(.*)$/gim)].map(([,e,t])=>({name:e.toLowerCase(),label:/label="([^"]+)"/i.exec(t)?.[1]??e,defaultValue:Number(/default=([\d.]+)/i.exec(t)?.[1]??.5),positions:/positions="([^"]+)"/i.exec(t)?.[1].split(`,`)})),cab:r}}var Vt=/4 ?x ?12|412/i,Ht=/2 ?x ?12|212/i,O=[D(`tweed-bass`,kt,`Tweed 4x10 · '59 bass circuit`,{builtin:0}),D(`blackpanel-22`,At,`Black panel · 22 W · '60s reverb circuit`,{builtin:2}),D(`blackpanel-410`,jt,`Black panel · 4x10 · '60s reverb circuit`,{builtin:0}),D(`blackpanel-100`,Mt,`Black panel · 100 W · '60s reverb circuit`,{builtin:2}),D(`brit-45`,Nt,`Brit · 45 W · '62 KT66 circuit`,{userIR:Vt,builtin:1}),D(`brit-plexi`,Pt,`Brit · 100 W · '68 plexi circuit`,{userIR:Vt,builtin:1}),D(`brit-800`,Ft,`Brit · 100 W · '81 master-volume circuit`,{userIR:Vt,builtin:1}),D(`brit-clean-100`,It,`Brit · 100 W · '70s high-headroom circuit`,{userIR:Vt,builtin:1}),D(`graphic-120`,Lt,`Brit · 120 W · '70s graphic-panel circuit`,{userIR:Vt,builtin:1}),{...D(`hotrod-100`,Rt,`Hot rod · 100 W · '87 super-lead circuit`,{userIR:Vt,builtin:1}),experimental:!0},D(`boutique-ods`,zt,`Boutique · 100 W · overdrive-special circuit`,{builtin:2}),D(`classa-30`,Bt,`Class A · 30 W · '60s top-boost circuit`,{userIR:Ht,builtin:2})],k=(e,t=``)=>{let n=document.createElement(`div`);return n.className=e,n.innerHTML=t,n},Ut=e=>e.replace(/[&<>"]/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`})[e]);function Wt(e,t){let n=k(`face face-${e.face}`),r=k(`face-knobs`);r.append(...t);let i=`<span class="jewel" aria-hidden="true"></span>`,a=Ut(e.name),o=Ut(e.model),s=`<small class="face-maker">PhreakGuitar</small>`,c=e=>`<div class="face-inputs">${e.map(()=>`<span class="jack"></span>`).join(``)}${e.map(e=>`<small>${e}</small>`).join(``)}</div>`;switch(e.face){case`plexi`:case`brit800`:{let t=k(`px-panel`,c(e.face===`brit800`?[`HIGH`,`LOW`]:[`HIGH`,`NORMAL`]));t.append(r,k(`px-switches`,`<span class="toggle"></span><span class="toggle"></span>
          <small>STANDBY</small><small>ON</small>${i}`)),n.append(t,k(`px-front`,`<div class="px-logo">${a}</div><div class="px-model">${o}</div>${s}`));break}case`classa`:{let e=k(`ca-panel`,`<div class="ca-panel-label"><b>${a}</b></div>`);e.append(r,k(`ca-lamp`,`${i}<small>${o}</small>`)),n.append(e,k(`ca-grille`,`<div class="ca-logo">${a}</div>${s}`));break}case`britclean`:{let e=k(`bc-panel`,c([`NORMAL`,`BRILLIANT`]));e.append(r,k(`bc-lamp`,`${i}<small>${o}</small>`)),n.append(e,k(`bc-front`,`<div class="bc-logo">${a}</div>${s}`));break}case`graphic`:{let e=k(`gr-panel`,`<div class="gr-inputs"><span class="jack"></span><span class="jack"></span></div>`);e.append(r,k(`gr-lamp`,`${i}<small>${o}</small>`)),n.append(e,k(`gr-front`,`<div class="gr-logo">${a}</div>${s}`));break}case`hotrod`:{let e=k(`hr-panel`,`<div class="hr-inputs"><span class="jack"></span><small>INPUT</small></div>`);e.append(r,k(`hr-lamp`,`${i}<small>${o}</small>`)),n.append(e,k(`hr-front`,`<div class="hr-logo">${a}</div>${s}`));break}case`boutique`:{let e=k(`bq-panel`,`<div class="bq-inputs"><span class="jack"></span><small>INPUT</small></div>`);e.append(r,k(`bq-lamp`,`${i}<small>${o}</small>`)),n.append(e,k(`bq-front`,`<div class="bq-logo">${a}</div>${s}`));break}case`blackpanel`:{let e=k(`bp-panel`,`<div class="bp-inputs"><span class="jack"></span><span class="jack"></span>
          <small>VIBRATO</small></div>`);e.append(r,k(`bp-lamp`,`${i}<small>${o}</small>`)),n.append(e,k(`bp-grille`,`<div class="bp-logo">${a}</div>${s}`));break}default:{let e=k(`tw-panel`,`<div class="tw-label"><span class="tw-logo">${a}</span>
          <small>${o}</small></div>`);e.append(r,k(`tw-lamp`,i)),n.append(k(`tw-tweed`,``),e)}}return n}var Gt=`http://www.w3.org/2000/svg`;function Kt(e){if(!e.netlist)return[];let t=new Map;for(let[,n,r,i]of e.netlist.matchAll(/^(XV(\d+)[AB]?)\s.*?\bTRIODE\b(.*)$/gim)){let e=Number(/MU=([\d.]+)/i.exec(i)?.[1]??100),a=t.get(r)??{label:`V${r}`,type:e<60?`12AY7`:`12AX7`,kind:`pre`,devices:[]};a.devices.push(n.toUpperCase()),t.set(r,a)}let n=/^\*@power\b(.*)$/im.exec(e.netlist)?.[1]??``,r=e=>RegExp(`\\b${e}=(\\S+)`).exec(n)?.[1],i=[...t.values()].sort((e,t)=>e.label.localeCompare(t.label,`en`,{numeric:!0}));i.push({label:`PI`,type:r(`pi`)??`12AX7`,kind:`power`,devices:[]});let a=r(`tubes`)??`EL34`;for(let e=0;e<Number(r(`count`)??2);e++)i.push({label:``,type:a,kind:`power`,devices:[]});let o=r(`rectifier`);return o&&o!==`silicon`&&i.push({label:`RECT`,type:o,kind:`rect`,devices:[]}),i}function qt(e){let t=e.kind!==`pre`&&e.label!==`PI`&&e.type!==`EL84`,n=t?46:32,r=t?112:80,i=document.createElementNS(Gt,`svg`);i.setAttribute(`viewBox`,`${-n/2-8} ${-r-10} ${n+16} ${r+22}`),i.setAttribute(`width`,String(n+16)),i.setAttribute(`height`,String(r+22)),i.classList.add(`tube`,`tube-${e.kind}`);let a=n/2,o=-r+a,s=t?`M${-a+4} 0 L${-a+4} ${-r*.25} C${-a-1} ${-r*.45} ${-a} ${-r*.6} ${-a} ${o} A${a} ${a} 0 0 1 ${a} ${o}
       C${a} ${-r*.6} ${a+1} ${-r*.45} ${a-4} ${-r*.25} L${a-4} 0 Z`:`M${-a} 0 L${-a} ${o} A${a} ${a} 0 0 1 ${a} ${o} L${a} 0 Z`,c=r*.42,l=n*.62,u=-r*.2-c;return i.innerHTML=`
    <ellipse class="tube-halo" cx="0" cy="${-r*.32}" rx="${n*.9}" ry="${r*.42}" />
    <path class="tube-glass" d="${s}" />
    <rect class="tube-plate" x="${-l/2}" y="${u}" width="${l}" height="${c}" rx="2" />
    <rect class="tube-heater" x="${-l*.18}" y="${u+4}" width="${l*.36}" height="${c-8}" rx="3" />
    <rect class="tube-hot" x="${-l*.18}" y="${u+4}" width="${l*.36}" height="${c-8}" rx="3" />
    ${e.kind===`power`&&t?`<ellipse class="tube-blue" cx="0" cy="${u+c/2}" rx="${a-3}" ry="${c*.75}" />`:``}
    <ellipse class="tube-getter" cx="0" cy="${o-a*.55}" rx="${a*.62}" ry="${a*.32}" />
    <path class="tube-shine" d="M${-a*.55} ${-r*.12} L${-a*.55} ${o}" />
    <rect class="tube-base" x="${-a-+!t}" y="0" width="${n+(t?0:2)}" height="${t?10:6}" rx="2" />`,i}function Jt(e,t){let n=Kt(e);if(n.length===0)return null;let r=document.createElement(`div`);r.className=`tubes`,r.setAttribute(`aria-label`,`Tubes`);let i=/^\*@power\b(.*)$/im.exec(e.netlist??``)?.[1]??``,a=Number(/\bbplus=([\d.]+)/.exec(i)?.[1]??0),o=/\brectifier=(\S+)/.exec(i)?.[1]??`silicon`,s=[{title:`Preamp`,items:n.filter(e=>e.kind===`pre`)},{title:`Power`,items:n.filter(e=>e.kind!==`pre`)}],c=[];for(let e of s){let t=document.createElement(`div`);t.className=`tube-group`,t.innerHTML=`<small class="tube-group-title">${e.title}</small>`;let n=document.createElement(`div`);n.className=`tube-shelf`;for(let t of e.items){let e=document.createElement(`figure`);e.className=`tube-cell`;let r=qt(t),i=document.createElement(`figcaption`);i.innerHTML=t.label?`${t.label}<br><span>${t.type}</span>`:`<br><span>${t.type}</span>`,e.append(r,i),e.title=t.devices.length?`${t.label} (${t.type}): ${t.devices.join(` + `)}`:`${t.label||`Output`} (${t.type})`,n.append(e),c.push({b:t,svg:r,glow:0})}t.append(n),r.append(t)}let l=document.createElement(`div`);l.className=`tube-group supply`,l.innerHTML=`<small class="tube-group-title">Power supply</small>
    <div class="supply-read" title="B+: the voltage the output tubes run on. It dips when you dig in and recovers between notes.">
      <b class="bplus">—</b><span class="sag"></span>
      <small>B+ · ${o===`silicon`?`silicon rectifier`:`${o} rectifier`}</small>
    </div>`,t&&l.append(t),a>0&&r.append(l);let u=l.querySelector(`.bplus`),d=l.querySelector(`.sag`),f=0;return{el:r,update(e){let t=new Map(e.devices.map((e,t)=>[e.toUpperCase(),t])),n=Math.min(1,Math.max(0,(e.power-.03)/.8))**.7;for(let r of c){let i;if(r.b.kind===`pre`){let n=Math.max(0,...r.b.devices.map(n=>e.values[t.get(n)??-1]??0));i=Math.min(1,n)**.6}else i=r.b.kind===`rect`?n*.6:n;r.glow=Math.max(i,r.glow*.78),r.svg.style.setProperty(`--g`,r.glow.toFixed(3))}if(e.supply>0&&a>0){f=f===0||e.supply<f?e.supply:f+(e.supply-f)*.25,u.textContent=`${Math.round(f)} V`;let t=(1-f/a)*100;d.textContent=t>=.5?`−${t.toFixed(+(t<10))}%`:``,l.style.setProperty(`--sag`,String(Math.min(1,Math.max(0,t/15))))}},reset(){f=0,u.textContent=`—`,d.textContent=``;for(let e of c)e.glow=0,e.svg.style.setProperty(`--g`,`0`)}}}var Yt=1400;function Xt(e,t,n=.8){let r=Math.min(Math.floor(t/55),Math.floor(e.length/2)),i=Math.max(2,Math.floor(t/Yt)),a=e.length-r,o=e.subarray(e.length-a-r),s=0;for(let e=0;e<a;e++)s+=o[e]*o[e];if(s/a<1e-8)return null;let c=new Float32Array(r+1),l=0;for(let e=0;e<a;e++)l+=2*o[e]*o[e];for(let e=0;e<=r;e++){e>0&&(l+=o[a+e-1]*o[a+e-1]-o[e-1]*o[e-1]);let t=0;for(let n=0;n<a;n++)t+=o[n]*o[n+e];c[e]=l>0?2*t/l:0}let u=[],d=0;for(;d<r&&c[d]>0;)d++;for(;d<r;){for(;d<r&&c[d]<=0;)d++;let e=d;for(;d<r&&c[d]>0;)c[d]>c[e]&&(e=d),d++;e<r&&e>=i&&c[e]>0&&u.push(e)}if(u.length===0)return null;let f=Math.max(...u.map(e=>c[e])),p=u.find(e=>c[e]>=.9*f);if(c[p]<n)return null;let m=c[p-1],h=c[p],g=c[p+1]??h,_=m-2*h+g;return{hz:t/(p+(_===0?0:.5*(m-g)/_)),clarity:h}}var Zt=[`C`,`C♯`,`D`,`D♯`,`E`,`F`,`F♯`,`G`,`G♯`,`A`,`A♯`,`B`];function Qt(e,t=440){let n=69+12*Math.log2(e/t),r=Math.round(n);return{name:Zt[(r%12+12)%12],octave:Math.floor(r/12)-1,cents:(n-r)*100,midi:r}}var $t=3,en=1500,tn=class{el;timer=0;buf=new Float32Array(4096);shown=null;candidate={midi:-1,count:0};lastHeard=0;muted=!1;opts;constructor(e){this.opts=e,this.el=document.createElement(`section`),this.el.className=`tuner`,this.el.hidden=!0,this.el.setAttribute(`aria-label`,`Tuner`),this.el.innerHTML=`
      <div class="tuner-note" aria-live="polite"><b>–</b><sub></sub></div>
      <div class="tuner-meter" aria-hidden="true">
        <div class="tuner-zone"></div>
        <div class="tuner-ticks"><span>−50</span><span>−25</span><span>0</span><span>+25</span><span>+50</span></div>
        <div class="tuner-needle"></div>
      </div>
      <div class="tuner-read">Play a single string</div>
      <label class="tuner-mute"><input type="checkbox" checked /> Mute while tuning</label>
      <button class="tuner-done">Done</button>`,this.el.querySelector(`.tuner-done`).addEventListener(`click`,()=>this.close()),this.el.querySelector(`.tuner-mute input`).addEventListener(`change`,e=>{this.setMuted(e.target.checked)})}get isOpen(){return!this.el.hidden}open(){this.isOpen||(this.el.hidden=!1,this.shown=null,this.render(),this.setMuted(this.el.querySelector(`.tuner-mute input`).checked),this.timer=window.setInterval(()=>this.tick(),1e3/15))}close(){this.isOpen&&(this.el.hidden=!0,clearInterval(this.timer),this.setMuted(!1),this.el.dispatchEvent(new Event(`close`)))}setMuted(e){e!==this.muted&&(this.muted=e,this.opts.mute(e))}tick(){let e=this.opts.input();if(!e)return;e.getFloatTimeDomainData(this.buf);let t=Xt(this.buf,this.opts.sampleRate()),n=performance.now();if(t){let e=Qt(t.hz);this.lastHeard=n,this.shown&&e.midi===this.shown.midi?(this.shown.cents+=(e.cents-this.shown.cents)*.4,this.shown.hz=t.hz):(this.candidate=e.midi===this.candidate.midi?{midi:e.midi,count:this.candidate.count+1}:{midi:e.midi,count:1},(!this.shown||this.candidate.count>=2)&&(this.shown={midi:e.midi,cents:e.cents,hz:t.hz}))}this.el.classList.toggle(`stale`,!!this.shown&&n-this.lastHeard>en),this.render()}render(){let e=this.shown,t=this.el.querySelector(`.tuner-note`),n=this.el.querySelector(`.tuner-needle`);if(!e){t.innerHTML=`<b>–</b><sub></sub>`,n.style.setProperty(`--pos`,`0`),this.el.classList.remove(`in-tune`,`flat`,`sharp`);return}let r=Qt(e.hz);t.innerHTML=`<b>${r.name}</b><sub>${r.octave}</sub>`;let i=Math.max(-50,Math.min(50,e.cents));n.style.setProperty(`--pos`,String(i/50));let a=Math.abs(e.cents)<=$t;this.el.classList.toggle(`in-tune`,a),this.el.classList.toggle(`flat`,!a&&e.cents<0),this.el.classList.toggle(`sharp`,!a&&e.cents>0);let o=Math.round(e.cents);this.el.querySelector(`.tuner-read`).textContent=`${e.hz.toFixed(1)} Hz · ${a?`in tune`:`${o>0?`+`:``}${o} cents ${o>0?`(sharp)`:`(flat)`}`}`}},nn=`phreakguitar`,rn=`irs`;async function an(){return await c,new Promise((e,t)=>{let n=indexedDB.open(nn,1);n.onupgradeneeded=()=>n.result.createObjectStore(rn,{keyPath:`name`}),n.onsuccess=()=>e(n.result),n.onerror=()=>t(n.error)})}async function on(e,t){let n=await an();try{return await new Promise((r,i)=>{let a=t(n.transaction(rn,e).objectStore(rn));a.onsuccess=()=>r(a.result),a.onerror=()=>i(a.error)})}finally{n.close()}}async function sn(){try{return(await on(`readonly`,e=>e.getAll())).sort((e,t)=>e.added-t.added).map(e=>e.name)}catch{return[]}}async function cn(e){try{return(await on(`readonly`,t=>t.get(e)))?.bytes??null}catch{return null}}async function ln(e,t){try{return await on(`readwrite`,n=>n.put({name:e,bytes:t,added:Date.now()})),!0}catch{return!1}}async function un(e){try{await on(`readwrite`,t=>t.delete(e))}catch{}}var A=(e,t)=>({name:e,label:t,defaultValue:.5,slider:!0}),dn=[{index:0,stage:`post`,id:`eq7`,name:`7-Band EQ`,maker:`Graphic equalizer`,controls:[A(`b100`,`100`),A(`b200`,`200`),A(`b400`,`400`),A(`b800`,`800`),A(`b1k6`,`1.6k`),A(`b3k2`,`3.2k`),A(`b6k4`,`6.4k`),A(`level`,`Level`)]},{index:1,stage:`post`,id:`delay`,name:`Digital Delay`,maker:`12 ms – 800 ms`,controls:[{name:`level`,label:`Level`,defaultValue:.45},{name:`feedback`,label:`Repeats`,defaultValue:.35},{name:`time`,label:`Time`,defaultValue:.55},{name:`mode`,label:`Mode`,defaultValue:1,positions:[`S`,`M`,`L`]}]},{index:2,stage:`post`,id:`reverb`,name:`Reverb`,maker:`Spring · Hall · Flange`,controls:[{name:`reverb`,label:`Reverb`,defaultValue:.35},{name:`mode`,label:`Mode`,defaultValue:0,positions:[`Spring`,`Hall`,`Flange`]}]}],fn={index:3,stage:`pre`,id:`red-comp`,name:`Red Comp`,maker:`Compressor`,controls:[{name:`output`,label:`Output`,defaultValue:.5},{name:`sensitivity`,label:`Sensitivity`,defaultValue:.5}]},pn=[fn,...dn],j=(e,t,n=!0)=>({id:e,on:n,knobs:t}),mn=e=>({delay:{on:!0,values:e}}),M={},N={on:!1,db:-65},hn=[{name:`Black panel clean`,level:13.8,amp:`blackpanel-100`,ampKnobs:{volume:.35,treble:.6,middle:.5,bass:.4,reverb:.3},pedals:[],cab:`amp`,fx:M,gate:N},{name:`Country/funk clean: compressor + EQ`,level:5.9,amp:`blackpanel-100`,ampKnobs:{volume:.4,treble:.65,middle:.45,bass:.4,reverb:.2},pedals:[],cab:`amp`,fx:{"red-comp":{on:!0,values:{output:.5,sensitivity:.6}},eq7:{on:!0,values:{b100:.45,b400:.45,b800:.45,b3k2:.62,b6k4:.58}}},gate:N},{name:`Surf: dripping spring`,level:8,amp:`blackpanel-100`,ampKnobs:{volume:.45,treble:.75,middle:.4,bass:.35,reverb:.75},pedals:[],cab:`amp`,fx:M,gate:N},{name:`Black panel + Gold Horse: edge of breakup`,level:-6.5,amp:`blackpanel-100`,ampKnobs:{volume:.5,treble:.55,middle:.55,bass:.4,reverb:.25},pedals:[j(`gold-horse`,{gain:.35,treble:.55,output:.6})],cab:`amp`,fx:M,gate:N},{name:`Tweed blues`,level:5,amp:`tweed-bass`,ampKnobs:{bright:.55,normal:0,treble:.65,middle:.5,bass:.35,presence:.6},pedals:[],cab:`amp`,fx:M,gate:N},{name:`Plexi crunch`,level:-14,amp:`brit-plexi`,ampKnobs:{loud1:.7,loud2:0,treble:.6,middle:.6,bass:.4,presence:.5},pedals:[],cab:`amp`,fx:M,gate:N},{name:`Plexi lead: Green Drive boost + delay`,level:-17.5,amp:`brit-plexi`,ampKnobs:{loud1:.75,loud2:0,treble:.6,middle:.65,bass:.4,presence:.5},pedals:[j(`green-drive`,{drive:.25,tone:.55,level:.75})],cab:`amp`,fx:mn({level:.3,feedback:.3,time:.3,mode:1}),gate:N},{name:`Brit 800 rock rhythm`,level:-4,amp:`brit-800`,ampKnobs:{preamp:.65,master:.5,treble:.6,middle:.55,bass:.5,presence:.5},pedals:[],cab:`amp`,fx:M,gate:{on:!0,db:-62}},{name:`'80s lead: Green Drive into a Brit 800`,level:-6.5,amp:`brit-800`,ampKnobs:{preamp:.8,master:.5,treble:.6,middle:.6,bass:.45,presence:.55},pedals:[j(`green-drive`,{drive:.1,tone:.6,level:.85})],cab:`amp`,fx:mn({level:.25,feedback:.3,time:.45,mode:1}),gate:{on:!0,db:-60}},{name:`Class A chime`,level:-20.8,amp:`classa-30`,ampKnobs:{volume:.4,treble:.65,bass:.45,cut:.3},pedals:[],cab:`amp`,fx:M,gate:N},{name:`Black Panel 22: edge of breakup`,level:-2,amp:`blackpanel-22`,ampKnobs:{volume:.55,treble:.6,bass:.45,reverb:.3},pedals:[],cab:`amp`,fx:M,gate:N,notes:`Two 6V6s on a tube rectifier: clean when you play softly, gritty when you dig in. Ride your guitar volume and pick attack instead of pedals.`},{name:`'60s British blues: treble booster into a Brit 45`,level:-16,amp:`brit-45`,ampKnobs:{loud1:.65,loud2:0,treble:.5,middle:.65,bass:.5,presence:.45},pedals:[j(`treble-boost`,{boost:.8})],cab:`amp`,fx:M,gate:N,notes:`A treble booster into a Brit 45 that is already cooking: the upper mids jump out and the notes sustain. Neck pickup for fat leads, bridge for bite: the mid-60s British blues-rock sound.`},{name:`'70s British crunch (Graphic 120)`,level:-25.6,amp:`graphic-120`,ampKnobs:{gain:.7,bass:.55,treble:.55,fac:0,boost:.3},pedals:[],cab:`amp`,fx:M,gate:{on:!0,db:-62},notes:`A '70s British graphic-panel head cranked: thick, woolly, chewy crunch (early-70s hard rock, later stoner rock). Click through the Voicing switch: each step takes away more low end, from huge (1) to thin and cutting (6).`},{name:`Boutique ODS: cascade overdrive`,level:3.2,amp:`boutique-ods`,ampKnobs:{volume:.5,treble:.55,middle:.55,bass:.4,drive:.5,level:.35,mode:1,master:.55,presence:.4},pedals:[],cab:`amp`,fx:mn({level:.2,feedback:.25,time:.4,mode:1}),gate:{on:!0,db:-62},notes:`The famous boutique overdrive-special sound: the clean channel cascading into two more gain stages - smooth, singing, vocal sustain (jazz-blues and fusion players love it). Turn the clean Volume to set how hard it drives the overdrive; Level balances it against the clean channel.`},{name:`Hot Rod 100: high-gain lead`,level:-3.7,amp:`hotrod-100`,ampKnobs:{mode:1,preamp:.6,odmaster:.4,bass:.45,middle:.6,treble:.55,presence:.45},pedals:[],cab:`amp`,fx:mn({level:.2,feedback:.3,time:.45,mode:1}),gate:{on:!0,db:-60},notes:`Experimental: heavy on the CPU for now (use the Standard buffer in Settings and close other big apps, or it can crackle). Five gain stages in a row, tight and smooth: the late-80s template for modern high gain. Preamp sets the gain, OD Master the volume; flip to Clean for a bright, glassy clean with its own Normal and Norm Master.`},{name:`'60s fuzz: Round Fuzz into a Class A 30`,level:-24,amp:`classa-30`,ampKnobs:{volume:.35,treble:.6,bass:.5,cut:.4},pedals:[j(`round-fuzz`,{fuzz:.85,volume:.25})],cab:`amp`,fx:M,gate:N},{name:`Brown sound: phaser into a cranked plexi`,level:-15.2,amp:`brit-plexi`,ampKnobs:{loud1:.85,loud2:0,treble:.65,middle:.5,bass:.45,presence:.5},pedals:[j(`orange-phaser`,{speed:.25})],cab:`amp`,fx:{delay:{on:!0,values:{level:.2,feedback:.2,time:.35,mode:1}},reverb:{on:!0,values:{reverb:.3,mode:.5}}},gate:{on:!0,db:-60},notes:`The late-70s 'brown sound' (think 'Eruption'): a four-stage phaser at a slow sweep in front of a cranked 100 W plexi, a short echo and some room. Bridge humbucker. The phaser goes before the amp, so the distortion makes the sweep sound vocal rather than watery; try Speed up near 3 o'clock for a faster throb.`},{name:`'90s grunge: Rodent into a clean black panel`,level:8.5,amp:`blackpanel-100`,ampKnobs:{volume:.35,treble:.55,middle:.5,bass:.45,reverb:.15},pedals:[j(`rodent`,{distortion:.65,filter:.35,volume:.45})],cab:`amp`,fx:M,gate:{on:!0,db:-60}},{name:`Ram Fuzz lead: delay + hall`,level:12,amp:`blackpanel-100`,ampKnobs:{volume:.35,treble:.55,middle:.55,bass:.4,reverb:0},pedals:[j(`ram-fuzz`,{sustain:.65,tone:.55,volume:.45})],cab:`amp`,fx:{delay:{on:!0,values:{level:.35,feedback:.35,time:.6,mode:1}},reverb:{on:!0,values:{reverb:.35,mode:.5}}},gate:{on:!0,db:-60}},{group:`Song tones`,name:`Gravity – clean verses`,level:10,amp:`boutique-ods`,ampKnobs:{volume:.4,treble:.55,middle:.5,bass:.45,mode:0,master:.55,presence:.4},pedals:[],cab:`amp`,fx:{"red-comp":{on:!0,values:{output:.5,sensitivity:.35}}},gate:N,notes:`Position 4 or 5 (neck), guitar tone around 7. The platform is a loud, stiff boutique clean (the Boutique ODS's clean channel) with a touch of compression: play with your thumb and fingers, dig in on the low strings, and let the amp stay clean under you. 'Gravity' verses, 'Slow Dancing in a Burning Room'.`},{group:`Song tones`,name:`Gravity – lead`,level:0,amp:`boutique-ods`,ampKnobs:{volume:.5,treble:.55,middle:.5,bass:.45,mode:0,master:.55,presence:.4},pedals:[j(`green-drive`,{drive:.3,tone:.5,level:.7}),j(`gold-horse`,{gain:.25,treble:.5,output:.55})],cab:`amp`,fx:mn({level:.22,feedback:.25,time:.55,mode:1}),gate:{on:!0,db:-62},notes:`Neck pickup (5), volume full. The lead stack is a Green Drive into a Gold Horse, both gentle, into the boutique clean channel on the edge: the drive comes from stacking, not from one pedal flat out. Wide, slow bends, and leave space between phrases.`},{group:`Song tones`,name:`All Your Love – '66 British blues`,level:-10.5,amp:`brit-45`,ampKnobs:{loud1:.9,loud2:0,treble:.55,middle:.7,bass:.5,presence:.45},pedals:[],cab:`amp`,fx:M,gate:N,notes:`The '66 British blues-rock sound: an early 45 W British combo (the Brit 45) turned all the way up, its GZ34 rectifier sagging under the notes, with a humbucker guitar straight in. Some accounts add a treble booster: try one in slot 1. On single-coils, position 1 or 2, volume full, pick hard: 'All Your Love', 'Hideaway'.`},{group:`Song tones`,name:`Sunshine of Your Love – 'woman tone'`,level:-17.5,amp:`brit-plexi`,ampKnobs:{loud1:.9,loud2:0,treble:.35,middle:.7,bass:.55,presence:.3},pedals:[],cab:`amp`,fx:{eq7:{on:!0,values:{b100:.45,b400:.6,b800:.62,b1k6:.55,b3k2:.3,b6k4:.2}}},gate:N,notes:`The trick is the guitar: neck pickup (5) with its tone knob all the way down into a cranked plexi. Roll your tone to 0 (or close); the EQ takes off the rest of the top. Slow, wide vibrato and lots of sustain: the 'Sunshine of Your Love' solo.`},{group:`Song tones`,name:`Old Love – single-coils into tweed`,level:2,amp:`tweed-bass`,ampKnobs:{bright:.6,normal:.2,treble:.6,middle:.55,bass:.4,presence:.55},pedals:[],cab:`amp`,fx:{reverb:{on:!0,values:{reverb:.2,mode:0}}},gate:N,notes:`A single-coil guitar (ideally with an active mid boost) into a tweed. Position 4 for rhythm, 5 for lead; light touch for clean, dig in for the tweed growl: 'Old Love', 'Wonderful Tonight' (lighter).`},{group:`Song tones`,name:`Sultans of Swing`,level:3.5,amp:`blackpanel-410`,ampKnobs:{volume:.38,treble:.72,middle:.35,bass:.45,reverb:.2},pedals:[],cab:`amp`,fx:{"red-comp":{on:!0,values:{output:.5,sensitivity:.45}},eq7:{on:!0,values:{b400:.45,b800:.42,b3k2:.58}}},gate:N,notes:`Position 4 (neck + middle: the quack), and fingers - no pick. That is most of the tone: thumb on the bass strings, snapping the treble strings with index and middle. The original was an early-60s single-coil guitar into a small black-panel combo; the Black Panel 4x10 is its bigger sibling (6L6s, tube rectifier, 10" speakers), bright and clean with a little squash.`},{group:`Song tones`,name:`Money for Nothing`,level:-4,amp:`brit-800`,ampKnobs:{preamp:.6,master:.5,treble:.55,middle:.7,bass:.45,presence:.5},pedals:[j(`classic-wah`,{wah:.58})],cab:`amp`,fx:M,gate:{on:!0,db:-60},notes:`The original: a humbucker guitar through a wah parked about half-way, into a British stack. Here the Classic Wah parked near 1 kHz into a Brit 800. Leave the Wah knob where it is: the parked wah IS the tone. Bridge pickup (1), palm-muted riff, pick with your fingers if you can.`},{group:`Song tones`,name:`Brothers in Arms`,level:-4,amp:`brit-800`,ampKnobs:{preamp:.55,master:.5,treble:.4,middle:.65,bass:.5,presence:.4},pedals:[j(`green-drive`,{drive:.4,tone:.4,level:.6})],cab:`amp`,fx:{delay:{on:!0,values:{level:.3,feedback:.4,time:.55,mode:1}},reverb:{on:!0,values:{reverb:.4,mode:.5}}},gate:{on:!0,db:-62},notes:`Neck pickup (5), guitar tone rolled back to about 5, fingers. A smooth, singing lead with long sustain; the original was a humbucker guitar into a high-gain hot-rod head (here a Brit 800 with a Green Drive for the sustain). Let each note ring into the delay and reverb.`},{group:`Song tones`,name:`Purple Haze`,level:-24,amp:`brit-plexi`,ampKnobs:{loud1:.8,loud2:0,treble:.6,middle:.6,bass:.5,presence:.55},pedals:[j(`round-fuzz-ge`,{fuzz:.9,volume:.6})],cab:`amp`,fx:M,gate:N,notes:`A germanium round fuzz into a cranked 100 W plexi, the 1967 recipe. Bridge (1) for the riff, neck (5) for leads. Rolling your guitar volume back cleans the fuzz up a little; a real one does it more, because it reacts to the guitar's volume pot, which an audio interface hides. For the solo's octave-up, pick 'Purple Haze – solo (octave up)'.`},{group:`Song tones`,name:`Purple Haze – solo (octave up)`,level:-24,amp:`brit-plexi`,ampKnobs:{loud1:.8,loud2:0,treble:.6,middle:.6,bass:.5,presence:.55},pedals:[j(`octave-fuzz`,{drive:.75,volume:.6,octave:0})],cab:`amp`,fx:M,gate:N,notes:`The first octave-up fuzz, built in early 1967 and first heard on this solo, into the cranked plexi. Neck pickup (5), up past the 12th fret: that's where the octave jumps out (on low notes it's mostly a ragged fuzz). Pick lightly and let notes bloom; the octave is clearest on single notes, not chords.`},{group:`Song tones`,name:`Little Wing`,level:-10,amp:`brit-plexi`,ampKnobs:{loud1:.5,loud2:0,treble:.55,middle:.55,bass:.5,presence:.45},pedals:[j(`photo-vibe`,{speed:.25,intensity:.55,volume:.5,mode:0})],cab:`amp`,fx:{reverb:{on:!0,values:{reverb:.25,mode:0}}},gate:N,notes:`A plexi just breaking up, neck pickup (5), chord-melody style: thumb over the neck for the bass notes, hammer-ons and slides in the chord shapes. The record's swirl was a rotating speaker; live it was a photocell vibe, as here, slow. Play softly for clean, dig in for grit.`},{group:`Song tones`,name:`Comfortably Numb – solo`,level:-.4,amp:`brit-clean-100`,ampKnobs:{normal:.45,brilliant:0,bass:.5,treble:.55,middle:.5,presence:.4,master:.45},pedals:[j(`ram-fuzz`,{sustain:.7,tone:.5,volume:.5})],cab:`amp`,fx:{delay:{on:!0,values:{level:.35,feedback:.3,time:.62,mode:1}},reverb:{on:!0,values:{reverb:.35,mode:.5}}},gate:{on:!0,db:-60},notes:`A Ram Fuzz into a very clean, loud British 100 W head (the Brit Clean 100) with long delay and hall. Bridge pickup (1) on single-coils; big, slow bends to pitch and long sustain. Let the delay fill the gaps.`},{group:`Song tones`,name:`Time – solo`,level:-12.7,amp:`brit-clean-100`,ampKnobs:{normal:.5,brilliant:0,bass:.5,treble:.6,middle:.5,presence:.4,master:.45},pedals:[j(`round-fuzz`,{fuzz:.65,volume:.45})],cab:`amp`,fx:{delay:{on:!0,values:{level:.28,feedback:.25,time:.45,mode:1}},reverb:{on:!0,values:{reverb:.25,mode:.5}}},gate:{on:!0,db:-60},notes:`Mid-70s progressive rock: a round fuzz into a clean Brit Clean 100, with delay. Bridge or bridge + middle; aggressive, vocal bends and fast vibrato.`},{group:`Song tones`,name:`Breathe – clean`,level:3.4,amp:`brit-clean-100`,ampKnobs:{normal:.4,brilliant:0,bass:.5,treble:.6,middle:.5,presence:.4,master:.45},pedals:[j(`photo-vibe`,{speed:.3,intensity:.55,volume:.5,mode:0})],cab:`amp`,fx:{"red-comp":{on:!0,values:{output:.5,sensitivity:.55}},delay:{on:!0,values:{level:.3,feedback:.35,time:.6,mode:1}},reverb:{on:!0,values:{reverb:.4,mode:.5}}},gate:N,notes:`Spacious clean: a compressor, a photocell vibe (the 'Breathe' shimmer), delay and plenty of room into the Brit Clean 100. Neck + middle (4) or neck (5), gentle pick; let chords ring into the delay. Switch the vibe off for a plainer clean.`},{group:`Song tones`,name:`Pride and Joy`,level:-4.5,amp:`blackpanel-410`,ampKnobs:{volume:.6,treble:.6,middle:.5,bass:.5,reverb:.25},pedals:[j(`green-drive`,{drive:.2,tone:.6,level:.85})],cab:`amp`,fx:M,gate:N,notes:`A Green Drive with low drive and the level up, into a loud Black Panel 4x10. Most of it is the hands: heavy strings (13s, tuned down a half step, are the classic choice), neck or middle pickup, and hit hard - downstrokes on the shuffle, raking into the bends.`},{group:`Song tones`,name:`Texas Flood`,level:-6,amp:`blackpanel-410`,ampKnobs:{volume:.72,treble:.55,middle:.55,bass:.45,reverb:.2},pedals:[j(`green-drive`,{drive:.3,tone:.55,level:.75})],cab:`amp`,fx:M,gate:N,notes:`Slow blues: the Green Drive pushing a Black Panel 4x10 that's already on the edge, its tube rectifier giving under the big notes. Neck pickup (5), heavy attack, big bends with wide vibrato; back off for the quiet parts and the amp cleans up. For 'Lenny' and 'Cold Shot', try that preset.`},{group:`Song tones`,name:`Voodoo Child`,level:-24,amp:`brit-plexi`,ampKnobs:{loud1:.8,loud2:0,treble:.6,middle:.6,bass:.5,presence:.55},pedals:[j(`classic-wah`,{wah:.4}),j(`round-fuzz-ge`,{fuzz:.85,volume:.6})],cab:`amp`,fx:M,gate:{on:!0,db:-62},notes:`A wah into a germanium round fuzz into a cranked plexi. Rock the Wah knob in time with the intro's muted scratches (heel down at 0, toe at 10); then park it for the riff. Neck pickup for the intro, bridge for the riff.`},{group:`Song tones`,name:`White Room`,level:-14.5,amp:`brit-plexi`,ampKnobs:{loud1:.85,loud2:0,treble:.5,middle:.7,bass:.5,presence:.4},pedals:[j(`classic-wah`,{wah:.45})],cab:`amp`,fx:M,gate:N,notes:`A wah into a cranked plexi: on the record it's worked slowly, swelling into each phrase. Sweep the Wah knob gradually rather than in rhythm. Neck pickup (5), guitar tone a little rolled back.`},{group:`Song tones`,name:`Machine Gun`,level:-23,amp:`brit-plexi`,ampKnobs:{loud1:.85,loud2:0,treble:.55,middle:.6,bass:.55,presence:.5},pedals:[j(`round-fuzz-ge`,{fuzz:.8,volume:.55}),j(`photo-vibe`,{speed:.4,intensity:.75,volume:.5,mode:0})],cab:`amp`,fx:M,gate:{on:!0,db:-62},notes:`A round fuzz into a photocell vibe into cranked plexis: the 1969-70 live sound. The vibe's throb turns sustained fuzz notes into the 'machine gun' pulse. Neck pickup, long sustained bends, let the vibe pulse do the rhythm.`},{group:`Song tones`,name:`Lenny / Cold Shot`,level:8.5,amp:`blackpanel-410`,ampKnobs:{volume:.5,treble:.6,middle:.5,bass:.5,reverb:.25},pedals:[j(`photo-vibe`,{speed:.3,intensity:.6,volume:.5,mode:0})],cab:`amp`,fx:M,gate:N,notes:`A photocell vibe into a Black Panel 4x10 at the edge of breakup. 'Lenny': neck pickup (5), soft chord-melody playing, slow vibe. 'Cold Shot': middle pickup, a touch faster Speed, and dig in for the grit.`}],gn=`phreakguitar.presets.v1`;function _n(){try{let e=localStorage.getItem(gn),t=e?JSON.parse(e):[];return Array.isArray(t)?t.filter(yn):[]}catch{return[]}}function vn(e){try{localStorage.setItem(gn,JSON.stringify(e))}catch{}}function yn(e){let t=e;return!!t&&typeof t.name==`string`&&typeof t.amp==`string`&&Array.isArray(t.pedals)&&typeof t.ampKnobs==`object`&&typeof t.fx==`object`&&typeof t.gate==`object`}var bn=`/assets/ir_tweed410-PDwmzSHi.wav`,xn=`/assets/ir_brit412-BR38X0Tw.wav`,Sn=`/assets/ir_black112-DLR9dA5T.wav`,Cn=`phreakguitar.settings.v1`,wn={knobs:{},gateOn:!1,cab:`builtin:0`,inputChannel:0,buffer:`standard`};function Tn(){try{let e=localStorage.getItem(Cn);return e?{...wn,...JSON.parse(e)}:{...wn}}catch{return{...wn}}}var En=(()=>{try{return localStorage.getItem(Cn)===null}catch{return!1}})(),P=Tn();if(En&&(P.knobs.master=-12),!P.board){let e=P.pedal;P.board=[,,,,].fill(null),e&&e.id!==`none`&&(P.board[0]={id:e.id,on:e.on,knobs:{...e.knobs[e.id]}}),P.pedalKnobs={...e?.knobs},delete P.pedal,delete P.showCircuit}for(;P.board.length<4;)P.board.push(null);function F(){try{localStorage.setItem(Cn,JSON.stringify(P))}catch{}Dn()}var Dn=()=>{},On=e=>`${e>0?`+`:``}${e.toFixed(1)} dB`,kn=e=>e.toFixed(1),An={input:{label:`Input`,min:-24,max:24,value:0,defaultValue:0,step:.1,format:On},drive:{label:`Drive`,min:0,max:10,value:4,defaultValue:4,step:.01,format:kn},bass:{label:`Bass`,min:0,max:10,value:5,defaultValue:5,step:.01,format:kn},mid:{label:`Middle`,min:0,max:10,value:5,defaultValue:5,step:.01,format:kn},treble:{label:`Treble`,min:0,max:10,value:6,defaultValue:6,step:.01,format:kn},master:{label:`Master`,min:-24,max:24,value:0,defaultValue:0,step:.1,format:On},gateDb:{label:`Threshold`,min:-90,max:-30,value:-65,defaultValue:-65,step:.5,format:e=>`${e.toFixed(1)} dB`},presetLevel:{label:`Level`,min:-30,max:30,value:0,defaultValue:0,step:.5,format:On}},I={};for(let[e,t]of Object.entries(An)){let n=e===`presetLevel`?P.presetLevel:P.knobs[e],r=new fe({...t,value:n??t.value});r.onChange=()=>{e===`presetLevel`?P.presetLevel=r.value:P.knobs[e]=r.value,F(),Zn(e),B(`amp.${e}`,r.value)},I[e]=r}var L=e=>document.querySelector(e);function jn(e,t,n,r){let i=document.createElement(`div`);i.className=`fx-switch`,i.setAttribute(`role`,`radiogroup`),i.setAttribute(`aria-label`,e);let a=t.length,o=()=>i.querySelectorAll(`button`).forEach((e,t)=>e.setAttribute(`aria-checked`,String(t===Math.round(n()*(a-1)))));return t.forEach((e,t)=>{let n=document.createElement(`button`);n.textContent=e,n.setAttribute(`role`,`radio`),n.addEventListener(`click`,()=>{r(t/(a-1)),o()}),i.append(n)}),o(),i}L(`#level-knobs`).append(I.input.el),L(`#master-slot`).append(I.master.el),L(`#preset-level`).append(I.presetLevel.el);var R=L(`#power`),Mn=L(`#status`),Nn=L(`#input-device`),Pn=L(`#input-channel`),Fn=L(`#output-device`),In=document.createElement(`div`);In.className=`fxbox cab-tile`,In.innerHTML=`<div class="fx-brand"><b>Cab</b><small>Speaker · IR</small></div>
  <div class="cab-grille" aria-hidden="true"><span></span></div>
  <select id="cab" aria-label="Cabinet impulse response"></select>
  <input id="ir-file" type="file" accept=".wav,audio/wav,audio/*" hidden />
  <button id="ir-forget" class="link" hidden>Remove this IR from the browser</button>`;var z=In.querySelector(`#cab`),Ln=In.querySelector(`#ir-file`),Rn=In.querySelector(`#ir-forget`),zn=L(`#measure`),Bn=L(`#buffer`);Pn.value=String(P.inputChannel),Bn.value=P.buffer;var Vn=[{name:`Tweed 4x10`,url:bn},{name:`Brit 4x12`,url:xn},{name:`Black 1x12`,url:Sn}],Hn=document.createElement(`optgroup`);Hn.label=`Built-in`,Vn.forEach((e,t)=>Hn.append(new Option(e.name,`builtin:${t}`)));var Un=document.createElement(`optgroup`);Un.label=`Your IRs (~/Music/PhreakGuitar/IRs)`;var Wn=document.createElement(`optgroup`);Wn.label=`Saved in this browser`,Wn.hidden=!0,z.append(Hn,Un,Wn),z.add(new Option(`Load IR file…`,`file`)),z.add(new Option(`Off (no cab)`,`off`)),P.cab===`file`&&(P.cab=`builtin:0`),z.value=P.cab;var Gn=[];async function Kn(){Gn=await sn(),Wn.replaceChildren(...Gn.map(e=>new Option(e.replace(/\.wav$/i,``),`saved:${e}`))),Wn.hidden=Gn.length===0,P.cab.startsWith(`saved:`)&&(z.value=P.cab),qn()}function qn(){Rn.hidden=!z.value.startsWith(`saved:`)}Kn();var Jn=[];async function Yn(){}var Xn=[];function B(e,t){e!==`preset`&&!Ni&&$&&($=null,Fi()),Xn.push({t:V?.ctx.currentTime??-1,what:e,value:t}),Xn.length>2e3&&Xn.splice(0,1e3)}var V=null;function Zn(e){if(!V)return;let t=I[e].value;switch(e){case`input`:V.setParam(x.inputDb,t);break;case`drive`:V.setParam(x.drive,t/10);break;case`master`:case`presetLevel`:V.setParam(x.outputDb,mi?-120:I.master.value+I.presetLevel.value),jr();break;case`gateDb`:V.setParam(x.gateDb,t);break;case`bass`:case`mid`:case`treble`:V.setTone(I.treble.value/10,I.mid.value/10,I.bass.value/10)}}function Qn(){for(let e of Object.keys(I))Zn(e);V?.setParam(x.gateOn,+!!P.gateOn)}var $n=new Map;async function er(){if(!V)return;let e=z.value;if(e===`off`)return V.setCab(null);if(e===`file`)return;if(e.startsWith(`saved:`)){let t=$n.get(e);if(!t){let n=await cn(e.slice(6));if(!n)return V.setCab(null);t=await V.ctx.decodeAudioData(n),$n.set(e,t)}return V.setCab(t)}let t=e.startsWith(`user:`)?`/__irs/${encodeURIComponent(e.slice(5))}`:(Vn[Number(e.split(`:`)[1])]??Vn[0]).url,n=$n.get(t);if(!n){let e=await fetch(t).then(e=>e.arrayBuffer());n=await V.ctx.decodeAudioData(e),$n.set(t,n)}V.setCab(n)}async function tr(){let e=await navigator.mediaDevices.enumerateDevices(),t=(t,n,r)=>{t.replaceChildren(new Option(`System default`,``));for(let r of e.filter(e=>e.kind===n&&e.deviceId!=="default"))t.add(new Option(r.label||`${n} ${t.options.length}`,r.deviceId));t.value=r&&[...t.options].some(e=>e.value===r)?r:``};t(Nn,`audioinput`,P.inputDeviceId),t(Fn,`audiooutput`,P.outputDeviceId),Fn.disabled=!(`setSinkId`in AudioContext.prototype),nr.hidden=rr(e)}var nr=L(`#device-access`),rr=e=>e.some(e=>e.kind===`audioinput`&&e.label);async function ir(){if(!await cr()){let e=await lr(`ask`);if(y(`mic_explained`,{choice:e?`continue`:`not now`,from:`devices`}),!e)return}try{(await navigator.mediaDevices.getUserMedia({audio:!0})).getTracks().forEach(e=>e.stop())}catch(e){y(`devices_blocked`,{error:e instanceof Error?e.name:`unknown`}),e instanceof DOMException&&e.name===`NotAllowedError`&&lr(`blocked`);return}await tr(),y(`devices_shown`)}L(`#device-allow`).addEventListener(`click`,()=>void ir());function ar(){let e=V?.inputChannelCount()??2;[...Pn.options].forEach(t=>t.disabled=Number(t.value)>=e),Number(Pn.value)>=e&&(Pn.value=`0`)}function H(e,t=`idle`){Mn.textContent=e,Mn.dataset.kind=t}function or(e){R.setAttribute(`aria-pressed`,String(e)),R.setAttribute(`aria-label`,e?`Power: on`:`Power: off`),R.title=e?`Power: on (click to switch off)`:`Power: off (click to switch on)`}var sr=matchMedia(`(pointer: coarse)`).matches&&Math.min(screen.width,screen.height)<820;async function cr(){try{return(await navigator.permissions.query({name:`microphone`})).state===`granted`}catch{return!1}}function lr(e){let t=document.createElement(`dialog`);t.className=`mic-dialog`;let n=/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform===`MacIntel`&&navigator.maxTouchPoints>1?`tap <b>aA</b> in the address bar → <b>Website Settings</b> → <b>Microphone</b> → <b>Allow</b>, then reload`:sr?`tap the icon at the left of the address bar → <b>Permissions</b> → <b>Microphone</b> → <b>Allow</b>`:`click the icon at the left of the address bar and allow the <b>Microphone</b>`;return t.innerHTML=e===`ask`?`<h2>Plug in, then allow the microphone</h2>
       <p>Your browser will now ask to use the <b>microphone</b>. Choose <b>Allow</b>: that's how your guitar
         gets in, through your audio interface's input.</p>
       <p class="mic-small">Everything is processed right here in this tab. Nothing is recorded, uploaded or sent anywhere.</p>
       <div class="welcome-actions"><button class="go">Continue</button><button class="link no">Not now</button></div>`:`<h2>The microphone is blocked</h2>
       <p>The rig can't hear your guitar without it. To allow it, ${n}, and try again.</p>
       <div class="welcome-actions"><button class="go">OK</button></div>`,document.body.append(t),new Promise(e=>{let n=n=>{t.close(),t.remove(),e(n)};t.querySelector(`.go`).addEventListener(`click`,()=>n(!0)),t.querySelector(`.no`)?.addEventListener(`click`,()=>n(!1)),t.addEventListener(`cancel`,e=>{e.preventDefault(),n(!1)}),t.showModal()})}var ur=0;async function dr(){if(!await cr()){let e=await lr(`ask`);if(y(`mic_explained`,{choice:e?`continue`:`not now`}),!e){P.powered=!1,F();return}}R.disabled=!0,R.classList.add(`starting`),H(`Starting…`);try{V=await re.start({inputDeviceId:P.inputDeviceId||void 0,inputChannel:P.inputChannel,outputDeviceId:P.outputDeviceId||void 0,buffer:P.buffer,onContext:e=>{if(e.state===`running`)return;H(`Click anywhere to start the sound (the browser needs one click after a reload)`);let t=()=>{e.resume(),removeEventListener(`pointerdown`,t,!0),removeEventListener(`keydown`,t,!0)};addEventListener(`pointerdown`,t,!0),addEventListener(`keydown`,t,!0)}}),V.onMeters=Gi,V.onPedalActivity=ci,V.onProbe=ri,V.onProbeSet=(e,t,n)=>{!n&&J?.slot===e&&J.node===t&&Zr&&(Zr.textContent=`${t}: waiting for the circuit (not in it, or not loaded yet)`)},J&&V.setProbe(J.slot,J.node),V.onAmpActivity=e=>Cr?.update(e),V.onLooper=Pr,P.looperOn&&V.looperEnable(!0),Qn(),await Tr(),await er(),await ui(),Ir(),await tr(),ar(),document.body.classList.add(`powered`),or(!0),zn.disabled=!1,Z.disabled=!1,Z.title=`Tuner`,L(`#send-capture`).disabled=!0,H(`Playing · ${V.inputLabel()||`default input`} · ${V.ctx.sampleRate/1e3} kHz`,`on`),fr=performance.now(),clearInterval(ur),ur=window.setInterval(()=>y(`still_playing`,{minutes_on:pr()}),3e5),y(`power_on`,{sample_rate:V.ctx.sampleRate,latency_ms:Math.round((V.ctx.baseLatency+(V.ctx.outputLatency||0))*1e3),buffer:P.buffer,amp:P.amp,preset:P.preset??null})}catch(e){await V?.stop(),V=null,H(hr(e),`error`),y(`power_on_failed`,{error:e instanceof DOMException||e instanceof Error?e.name:`unknown`}),P.powered=!1,F(),e instanceof DOMException&&e.name===`NotAllowedError`&&lr(`blocked`)}finally{R.disabled=!1,R.classList.remove(`starting`)}}var fr=0,pr=()=>Math.round((performance.now()-fr)/6e3)/10;addEventListener(`pagehide`,()=>{V&&y(`power_off`,{minutes_on:pr(),how:`closed`},!0)});async function mr(){V&&y(`power_off`,{minutes_on:pr(),how:`switch`}),clearInterval(ur),hi.close(),Z.disabled=!0,Z.title=`Tuner (power on first)`,await V?.stop(),V=null,document.body.classList.remove(`powered`),or(!1),zn.disabled=!0,L(`#send-capture`).disabled=!0;for(let e of Object.keys(Hi))delete Hi[e];if(X)for(let e of si.keys())He(X,e,0);si.clear(),Cr?.reset(),W=null,Nr.update(null,48e3),Gi({inputPeak:0,outputPeak:0,limiterGain:1,pedalFaults:0,pedalNewtonFailures:0}),H(`Standby`)}function hr(e){return e instanceof DOMException&&e.name===`NotAllowedError`?`Microphone blocked: allow it in the address bar, then switch on again.`:e instanceof DOMException&&e.name===`OverconstrainedError`?`That input device is unavailable. Pick another one.`:e instanceof Error?e.message:String(e)}R.addEventListener(`click`,()=>(P.powered=!V,F(),V?mr():dr())),Nn.addEventListener(`change`,async()=>{if(P.inputDeviceId=Nn.value||void 0,F(),V)try{await V.setInput(P.inputDeviceId,P.inputChannel),ar(),H(`Playing · ${V.inputLabel()}`,`on`)}catch(e){H(hr(e),`error`)}}),Pn.addEventListener(`change`,async()=>{P.inputChannel=Number(Pn.value),F(),V&&await V.setInput(P.inputDeviceId,P.inputChannel)}),Fn.addEventListener(`change`,async()=>{if(P.outputDeviceId=Fn.value||void 0,F(),V)try{await V.setOutputDevice(Fn.value)}catch(e){H(hr(e),`error`)}}),z.addEventListener(`change`,async()=>{z.value===`file`?Ln.click():(qn(),P.cab=z.value,F(),B(`cab`,z.value),y(`cab_changed`,{cab:z.value.startsWith(`builtin:`)?z.value:b(z.value)}),await er())}),Ln.addEventListener(`change`,async()=>{let e=Ln.files?.[0];if(Ln.value=``,!e)z.value=P.cab;else try{let t=await e.arrayBuffer(),n=await(V?.ctx??new OfflineAudioContext(1,1,48e3)).decodeAudioData(t.slice(0)),r=`saved:${e.name}`;$n.set(r,n),await ln(e.name,t)||H(`${e.name} is loaded but this browser won't keep it after a reload.`,`error`),await Kn(),[...z.options].some(e=>e.value===r)||Wn.append(new Option(e.name.replace(/\.wav$/i,``),r)),Wn.hidden=!1,z.value=r,P.cab=r,F(),qn(),B(`cab`,r),await er()}catch{H(`Couldn't read ${e.name} as audio.`,`error`),z.value=P.cab}}),Rn.addEventListener(`click`,async()=>{let e=z.value;e.startsWith(`saved:`)&&(await un(e.slice(6)),$n.delete(e),P.cab=Er(br()),F(),await Kn(),z.value=P.cab,qn(),await er())});var gr=L(`#amp-type`),_r=L(`#amp-status`),vr=new URLSearchParams(location.search).has(`experimental`),yr=e=>vr||!e.experimental||e.id===P.amp;for(let e of O)yr(e)&&gr.add(new Option(e.name,e.id));gr.value=O.some(e=>e.id===P.amp)?P.amp:O[0].id;var br=()=>O.find(e=>e.id===gr.value)??O[0],xr=(e,t)=>P.ampKnobs?.[e.id]?.[e.controls[t].name]??e.controls[t].defaultValue;function Sr(){let e=br(),t;if(!e.netlist)t=[`drive`,`bass`,`mid`,`treble`].map(e=>I[e].el);else{let n=e.face===`plexi`||e.face===`brit800`||e.face===`britclean`?`goldcap`:e.face===`classa`?`chicken`:e.face===`blackpanel`||e.face===`boutique`?`skirted`:`disc`;wr=void 0,t=e.controls.flatMap((t,r)=>{let i=n=>{((P.ampKnobs??={})[e.id]??={})[t.name]=n,F(),V?.setAmpControl(r,n),B(`amp.${t.name}`,n)};if(t.positions){let n=document.createElement(`div`);return n.className=`amp-switch`,n.append(jn(t.label,t.positions,()=>xr(e,r),i)),n.insertAdjacentHTML(`beforeend`,`<div class="knob-label">${t.label}</div>`),[n]}let a=new fe({label:t.label,min:0,max:10,value:xr(e,r)*10,defaultValue:t.defaultValue*10,step:.01,format:kn,cap:n});return a.onChange=()=>i(a.value/10),t.name===`response`?(a.el.title=`How the power supply responds: left stiffer and faster, right spongier, centre as the amp was built`,wr=a.el,[]):[a.el]})}if(Cr=Jt(e,wr),Cr){let e=Cr.el;e.classList.toggle(`compact`,!P.tubesOpen);let t=document.createElement(`button`);t.className=`link tubes-toggle`;let n=()=>t.textContent=P.tubesOpen?`Smaller`:`Bigger`;t.addEventListener(`click`,()=>{P.tubesOpen=!P.tubesOpen,F(),e.classList.toggle(`compact`,!P.tubesOpen),n()}),n(),e.append(t)}L(`#amp-face`).replaceChildren(Wt(e,t),...Cr?[Cr.el]:[])}var Cr=null,wr;async function Tr(){if(!V)return;let e=br();if(!e.netlist){V.unloadAmp(),_r.textContent=``;return}_r.textContent=`Warming up the tubes…`;let t=await V.loadAmp(e.netlist,e.controls.map((t,n)=>xr(e,n)));_r.textContent=t?`Couldn't load: ${t}`:``}gr.addEventListener(`change`,async()=>{P.amp=gr.value,P.cab=Er(br()),z.value=P.cab,F(),B(`amp`,gr.value),y(`amp_changed`,{amp:gr.value}),Sr(),await Tr(),await er()});function Er(e){let t=e.cab.userIR&&Jn.find(t=>e.cab.userIR.test(t));return t?`user:${t}`:`builtin:${e.cab.builtin}`}Sr(),Yn();var U=e=>(P.fx??={})[e.id]??={on:!1,values:{}},Dr=(e,t)=>U(e).values[e.controls[t].name]??e.controls[t].defaultValue;function Or(){L(`#fx-boards`).replaceChildren(In,...dn.map(Fr),Nr.el)}var W=null,kr=0;function Ar(){return mi?0:10**(((P.looperDb??0)+I.master.value-kr)/20)}function jr(){V?.looperGain(Ar())}function Mr(e){V&&P.looperOn&&(e===0&&(!W||W.state===`empty`)&&(kr=I.master.value,jr()),V.looperCommand(e),B(`looper`,[`press`,`stop`,`undo`,`clear`][e]),e===0&&(!W||W.state===`empty`)&&y(`looper_recorded`))}var Nr=Ot({enabled:()=>!!P.looperOn,setEnabled:e=>{P.looperOn=e,F(),V?.looperEnable(e),e&&jr(),W=null,la()},powered:()=>!!V,command:Mr,level:{get:()=>P.looperDb??0,set:e=>{P.looperDb=e,F(),jr()}}});function Pr(e){let t=e.state!==W?.state;W=e,Nr.update(e,V?.ctx.sampleRate??48e3),t&&la()}function Fr(e){{let t=document.createElement(`div`);t.className=`fxbox fx-${e.id}`,t.innerHTML=`<div class="fx-brand"><b>${e.name}</b><small>${e.maker}</small></div>
      <div class="fx-controls"></div>
      <button class="footswitch" aria-pressed="false"><span class="led" aria-hidden="true"></span><span class="fs-label"></span></button>`;let n=t.querySelector(`.fx-controls`);e.controls.forEach((t,r)=>{let i=n=>{U(e).values[t.name]=n,F(),V?.setFxControl(e.index,r,n,e.stage),B(`fx.${e.id}.${t.name}`,n)};if(t.slider){let a=document.createElement(`label`);a.className=`eq-band`;let o=e=>{let t=(e-.5)*30;return`${t>0?`+`:``}${t.toFixed(+(Math.abs(t)<10))}`};a.innerHTML=`<span class="eq-db"></span><input type="range" min="0" max="1" step="0.005" aria-label="${t.label} Hz" /><span class="eq-label">${t.label}</span>`;let s=a.querySelector(`input`),c=a.querySelector(`.eq-db`);s.value=String(Dr(e,r)),c.textContent=o(Dr(e,r)),s.addEventListener(`input`,()=>{i(Number(s.value)),c.textContent=o(Number(s.value))}),s.addEventListener(`dblclick`,()=>{s.value=`0.5`,i(.5),c.textContent=o(.5)}),n.append(a)}else if(t.positions){let a=document.createElement(`div`);a.className=`fx-switch`,a.setAttribute(`role`,`radiogroup`),a.setAttribute(`aria-label`,t.label);let o=t.positions.length;t.positions.forEach((t,n)=>{let s=document.createElement(`button`);s.textContent=t,s.setAttribute(`role`,`radio`);let c=n/(o-1),l=()=>a.querySelectorAll(`button`).forEach((t,n)=>t.setAttribute(`aria-checked`,String(n===Math.round(Dr(e,r)*(o-1)))));s.addEventListener(`click`,()=>{i(c),l()}),a.append(s),queueMicrotask(l)}),n.append(a)}else{let a=new fe({label:t.label,min:0,max:10,value:Dr(e,r)*10,defaultValue:t.defaultValue*10,step:.01,format:kn});a.onChange=()=>i(a.value/10),n.append(a.el)}});let r=t.querySelector(`.footswitch`),i=()=>{r.setAttribute(`aria-pressed`,String(U(e).on)),r.querySelector(`.fs-label`).textContent=U(e).on?`On`:`Off`};return r.addEventListener(`click`,()=>{U(e).on=!U(e).on,F(),i(),V?.setFxEnabled(e.index,U(e).on,e.stage),B(`fx.${e.id}.on`,U(e).on)}),i(),t}}function Ir(){if(V)for(let e of pn)e.controls.forEach((t,n)=>V.setFxControl(e.index,n,Dr(e,n),e.stage)),V.setFxEnabled(e.index,U(e).on,e.stage)}Or();var Lr=L(`#board`),Rr=L(`#board-status`),G=e=>P.board[e],K=Oe(),zr=()=>[...Ee,...K.map(Ae)],Br=e=>zr().find(t=>t.id===e),Vr=e=>Br(G(e)?.id),Hr=(e,t,n)=>G(e)?.knobs[t.controls[n].name]??t.controls[n].defaultValue,Ur=[,,,,].fill(``);function q(){let e=Fr(fn);e.classList.add(`stomp-comp`);let t=[Wr(),Object.assign(document.createElement(`div`),{className:`cable`,ariaHidden:`true`}),e];for(let e=0;e<4;e++)t.push(Object.assign(document.createElement(`div`),{className:`cable`,ariaHidden:`true`})),t.push(Gr(e));Lr.replaceChildren(...t),Yr()}function Wr(){let e=document.createElement(`div`);e.className=`fxbox gate-box`,e.innerHTML=`<div class="fx-brand"><b>Gate</b><small>Noise gate</small></div><div class="fx-controls"></div>
    <button class="footswitch" aria-pressed="false"><span class="led" aria-hidden="true"></span><span class="fs-label"></span></button>`,e.querySelector(`.fx-controls`).append(I.gateDb.el);let t=e.querySelector(`.footswitch`),n=()=>{t.setAttribute(`aria-pressed`,String(P.gateOn)),t.querySelector(`.fs-label`).textContent=P.gateOn?`On`:`Off`};return t.addEventListener(`click`,()=>{di(!P.gateOn),n()}),n(),e}function Gr(e){let t=Vr(e),n=G(e),r=document.createElement(`div`);r.className=`stomp${t?``:` empty`}`,r.dataset.pedal=t?je(t,zr()):``,r.innerHTML=`
    <div class="stomp-head">
      <button class="slot-move" data-dir="-1" aria-label="Move pedal ${e+1} earlier" title="Move earlier" ${e===0||!t?`disabled`:``}>◀</button>
      <label class="stomp-name" title="${t?`${t.name.replace(/"/g,``)}: change pedal`:`Add a pedal`}"><span>${t?t.name.replace(/[&<>"]/g,``):`+`}</span>${t?`<i aria-hidden="true">▾</i>`:``}
        <select aria-label="Pedal ${e+1}"></select></label>
      <button class="slot-move" data-dir="1" aria-label="Move pedal ${e+1} later" title="Move later" ${e===3||!t?`disabled`:``}>▶</button>
    </div>
    <div class="knob-row small"></div>
    <button class="footswitch" aria-pressed="false"><span class="led" aria-hidden="true"></span><span class="fs-label"></span></button>
    <button class="link-light circuit-toggle" aria-controls="circuit-panel"></button>
    <div class="hint slot-status"></div>`;let i=r.querySelector(`select`);i.add(new Option(t?`No pedal (remove)`:`Add a pedal…`,`none`));for(let e of Ee)i.add(new Option(e.name,e.id));if(K.length){let e=Object.assign(document.createElement(`optgroup`),{label:`Yours`});for(let t of K)e.append(new Option(Ae(t).name,t.id));i.append(e)}if(i.value=t?.id??`none`,i.addEventListener(`change`,async()=>{P.board[e]=i.value===`none`?null:{id:i.value,on:!0,knobs:{...P.pedalKnobs?.[i.value]}},i.value===`none`&&P.circuitSlot===e&&(P.circuitSlot=null),F(),B(`pedal${e}.type`,i.value),y(`pedal_changed`,{slot:e,pedal:i.value.startsWith(`my-`)?`my-pedal`:i.value}),q(),await li(e)}),r.querySelectorAll(`.slot-move`).forEach(t=>t.addEventListener(`click`,()=>qr(e,e+Number(t.dataset.dir)))),t&&n){let i=(r,i,a)=>{n.knobs[r.name]=a,((P.pedalKnobs??={})[t.id]??={})[r.name]=a,F(),V?.setPedalControl(e,i,a),B(`pedal${e}.${r.name}`,a)},a=t.controls.map((n,r)=>{if(n.positions)return jn(n.label,n.positions,()=>Hr(e,t,r),e=>i(n,r,e));let a=new fe({label:n.label,min:0,max:10,value:Hr(e,t,r)*10,defaultValue:n.defaultValue*10,step:.01,format:kn});return a.onChange=()=>i(n,r,a.value/10),a.el});r.querySelector(`.knob-row`).replaceChildren(...a);let o=r.querySelector(`.footswitch`);o.setAttribute(`aria-pressed`,String(n.on)),o.querySelector(`.fs-label`).textContent=n.on?`On`:`Bypassed`,o.addEventListener(`click`,()=>{n.on=!n.on,F(),B(`pedal${e}.on`,n.on),o.setAttribute(`aria-pressed`,String(n.on)),o.querySelector(`.fs-label`).textContent=n.on?`On`:`Bypassed`,V?.setPedalEnabled(e,n.on)});let s=r.querySelector(`.circuit-toggle`),c=P.circuitSlot===e;s.textContent=c?`Hide circuit`:t.parent?`Edit circuit`:`Show circuit`,s.setAttribute(`aria-expanded`,String(c)),s.addEventListener(`click`,()=>{P.circuitSlot=P.circuitSlot===e?null:e,F(),q()})}return r.querySelector(`.slot-status`).textContent=Ur[e],r}function Kr(e,t){Ur[e]=t;let n=Lr.querySelectorAll(`.stomp`)[e]?.querySelector(`.slot-status`);n&&(n.textContent=t)}function qr(e,t){if(t<0||t>=4||e===t)return;let n=P.board,[r]=n.splice(e,1);n.splice(t,0,r);let[i]=Ur.splice(e,1);Ur.splice(t,0,i);let a=P.circuitSlot;a!=null&&(a===e?P.circuitSlot=t:e<a&&a<=t?P.circuitSlot=a-1:t<=a&&a<e&&(P.circuitSlot=a+1)),F(),B(`pedal.move`,`${e}->${t}`),V?.movePedal(e,t),q()}var Jr=null;function Yr(){let e=P.circuitSlot,t=e==null?void 0:Vr(e);if(L(`#circuit-panel`).hidden=!t,!t){X=null,Jr=null,ti();return}L(`#circuit-title`).textContent=`${t.name} (pedal ${e+1})`,J&&(J.slot!==e||J.pedal!==t.id)&&ti(),X=Be(t)?Ve(t,{onNode:(t,n)=>Qr(e,t,n)}):null,L(`#circuit-view`).replaceChildren(...X?[X]:[]),L(`#circuit-view`).hidden=!X,L(`#circuit-hint`).hidden=!X,si.clear(),Jr?.id!==t.id&&(Jr={id:t.id,el:ot(t,t.parent?oi(t.id):void 0)});let n=document.createElement(`div`);n.className=`d-fork`,t.parent||(n.innerHTML=`<button>Fork this pedal</button> <span class="hint">Makes your own copy in this slot to change parts in, and hear each change as you play.</span>`,n.querySelector(`button`).addEventListener(`click`,()=>ai(e))),L(`#circuit-design`).replaceChildren(n,Jr.el),X&&ii(X),ni(t,e)}var J=null,Xr=null,Zr=null,Y=null;function Qr(e,t,n){if(!Y)ei(e,t);else if(Y.got.push({node:t,at:n}),X&&Ge(X,t),Y.got.length>=Y.need){let{got:e,resolve:t}=Y;Y=null,X?.classList.remove(`picking`),t(e)}}function $r(){if(!Y)return;let{resolve:e}=Y;Y=null,X?.classList.remove(`picking`),e(null)}document.addEventListener(`keydown`,e=>{e.key===`Escape`&&$r()});function ei(e,t){let n=Vr(e);n&&(J={slot:e,pedal:n.id,node:t},V?.setProbe(e,t),X&&Ge(X,t),ni(n,e))}function ti(){J&&V?.setProbe(J.slot,null),J=null}function ni(e,t){let n=L(`#circuit-probe`);e.netlist.match(/^\*@pedal\b.*\bdsp=/im)?n.replaceChildren():(n.innerHTML=`
    <div class="probe-head">
      <label>Probe <select class="probe-node"><option value="">off</option>${[...new Set(Je(e.netlist).filter(e=>e.letter!==`k`).flatMap(e=>e.nodes))].filter(e=>e!==`0`).sort((e,t)=>e.localeCompare(t,void 0,{numeric:!0})).map(e=>`<option ${J?.node===e?`selected`:``}>${e}</option>`).join(``)}</select></label>
      <span class="probe-readout hint">${Be(e)?`Click a wire on the drawing, or pick a point here.`:`Pick a point in the circuit.`}${V?``:` Power on to see it.`}</span>
    </div>
    <canvas class="probe-scope" width="900" height="180" ${J?``:`hidden`}></canvas>`,Xr=n.querySelector(`canvas`),Zr=n.querySelector(`.probe-readout`),n.querySelector(`.probe-node`).addEventListener(`change`,n=>{let r=n.target.value;r?ei(t,r):(ti(),X&&Ge(X,null),ni(e,t))}))}function ri(e,t,n){if(!J||J.slot!==e||J.node!==t||!Xr||n.length===0)return;let r=0,i=1/0,a=-1/0;for(let e of n)r+=e,i=Math.min(i,e),a=Math.max(a,e);let o=r/n.length,s=Math.floor(n.length/2),c=0;for(let e=1;e<n.length-s;e++)if(n[e-1]<o&&n[e]>=o){c=e;break}let l=Xr.getContext(`2d`),{width:u,height:d}=Xr,f=Math.max((a-i)*.1,.005),p=e=>d-(e-(i-f))/(a-i+2*f)*d;l.clearRect(0,0,u,d),l.strokeStyle=`rgba(232, 220, 192, 0.25)`,l.setLineDash([4,6]),l.beginPath(),l.moveTo(0,p(o)),l.lineTo(u,p(o)),l.stroke(),l.setLineDash([]),l.strokeStyle=`#7fe0a8`,l.lineWidth=2,l.beginPath();for(let e=0;e<s;e++){let t=e/(s-1)*u;e===0?l.moveTo(t,p(n[c+e])):l.lineTo(t,p(n[c+e]))}l.stroke();let m=s/(V?.ctx.sampleRate??48e3)*1e3,h=e=>Math.abs(e)>=1?`${e.toFixed(2)} V`:`${(e*1e3).toFixed(1)} mV`;Zr&&(Zr.textContent=`${t}: DC ${h(o)} · swing ${h(a-i)} peak to peak · ${m.toFixed(0)} ms across`)}function ii(e){let t=e=>Jr?.el.querySelectorAll(`tr[data-part]`).forEach(t=>t.classList.toggle(`d-hot`,!!e&&t.dataset.part===e));e.addEventListener(`mouseover`,e=>{let n=e.target.closest(`.sch-part`);t(n?.dataset.name?.toUpperCase()??null)}),e.addEventListener(`mouseleave`,()=>t(null))}function ai(e){let t=Vr(e),n=G(e);if(!t||!n)return;let r=`my-${Date.now().toString(36)}`;K.push({id:r,parent:t.id,netlist:ut(t,`My ${t.name}`)}),ke(K),P.board[e]={id:r,on:n.on,knobs:{...n.knobs}},(P.pedalKnobs??={})[r]={...n.knobs},P.circuitSlot=e,F(),B(`pedal${e}.fork`,t.id),y(`pedal_forked`,{pedal:t.id.startsWith(`my-`)?`my-pedal`:t.id}),q(),li(e)}function oi(e){return{async apply(t){let n=K.find(t=>t.id===e);if(!n)return null;n.netlist=t,ke(K),B(`designer.edit`,e);let r=Ae(n);if(X&&Be(r)&&(X=Ve(r,{onNode:(e,t)=>Qr(P.circuitSlot,e,t)}),L(`#circuit-view`).replaceChildren(X),ii(X),Ge(X,J?.node??null)),ni(r,P.circuitSlot),!V)return null;let i=null;for(let n=0;n<4;n++){if(G(n)?.id!==e)continue;let a=await V.loadPedal(n,t,r.controls.map((e,t)=>Hr(n,r,t)));V.setPedalEnabled(n,G(n)?.on??!0),Kr(n,a?`Couldn't load: ${a}`:``),i??=a}return i},rename(){q()},pick(e){return $r(),new Promise(t=>{Y={need:e,got:[],resolve:t},X?.classList.add(`picking`)})},remove(){K=K.filter(t=>t.id!==e),ke(K),P.board=P.board.map(t=>t?.id===e?null:t),P.circuitSlot=null,F(),q(),ui()}}}var X=null,si=new Map;function ci(e,t){if(!X||e!==P.circuitSlot)return;let n=We(X);t.devices.forEach((e,r)=>{let i=n.get(e);if(!i)return;let a=Math.max(Ue(i,t.values[r]),(si.get(e)??0)*.72);si.set(e,a),He(X,e,a)})}async function li(e){if(!V)return;let t=Vr(e);if(!t){V.unloadPedal(e),Kr(e,``);return}Kr(e,`Solving the circuit…`);let n=await V.loadPedal(e,t.netlist,t.controls.map((n,r)=>Hr(e,t,r)));V.setPedalEnabled(e,G(e)?.on??!0),Kr(e,n?`Couldn't load: ${n}`:``)}async function ui(){await Promise.all(Array.from({length:4},(e,t)=>li(t)))}q(),Bn.addEventListener(`change`,async()=>{P.buffer=Bn.value===`low`?`low`:`standard`,F(),V&&(await mr(),await dr())});function di(e){P.gateOn=e,F(),B(`gate.on`,e),V?.setParam(x.gateOn,+!!e)}var fi=St({outputDeviceId:()=>P.outputDeviceId||void 0});L(`#tabs-slot`).replaceWith(fi.el);var pi=L(`#tabs-btn`);pi.setAttribute(`aria-pressed`,String(fi.isOpen())),pi.addEventListener(`click`,()=>{pi.setAttribute(`aria-pressed`,String(fi.toggle())),B(`tabs.open`,fi.isOpen()),fi.isOpen()&&y(`tabs_opened`),da()});var mi=!1,Z=L(`#tuner-btn`),hi=new tn({input:()=>V?.startTuner()??null,sampleRate:()=>V?.ctx.sampleRate??48e3,mute:e=>{mi=e,Zn(`master`)}});L(`#tuner-slot`).append(hi.el),Z.addEventListener(`click`,()=>{hi.isOpen?hi.close():(hi.open(),y(`tuner_opened`)),Z.setAttribute(`aria-pressed`,String(hi.isOpen))}),hi.el.addEventListener(`close`,()=>{V?.stopTuner(),Z.setAttribute(`aria-pressed`,`false`)});var gi=L(`#preset`),_i=L(`#preset-name`),vi=L(`#preset-save`),yi=L(`#preset-delete`),Q=_n(),bi=e=>e?.startsWith(`factory:`)?hn[Number(e.slice(8))]:e?.startsWith(`user:`)?Q.find(t=>t.id===e.slice(5)):void 0;function xi(e){let t=O.find(t=>t.id===e.amp)??O[0],n=e=>Math.round(e*1e3)/1e3,r=(e,t)=>Object.fromEntries(e.map(e=>[e.name,n(t[e.name]??e.defaultValue)])),i=Array.from({length:4},(t,n)=>{let i=e.pedals[n],a=i&&Br(i.id);return i&&a?{id:i.id,on:i.on,knobs:r(a.controls,i.knobs)}:null}),a=Object.fromEntries(pn.map(t=>{let n=e.fx[t.id];return[t.id,{on:!!n?.on,values:r(t.controls,n?.values??{})}]})),o=e.cab===`amp`?Er(t):e.cab;return JSON.stringify({amp:t.id,ampKnobs:r(t.controls,e.ampKnobs),pedals:i,cab:o,fx:a,gate:{on:e.gate.on,db:n(e.gate.db)},level:n(e.level??0)})}function Si(e){let t=br();return{name:e,amp:t.id,ampKnobs:Object.fromEntries(t.controls.map((e,n)=>[e.name,xr(t,n)])),pedals:P.board.map(e=>e?{id:e.id,on:e.on,knobs:{...e.knobs}}:null),cab:P.cab,fx:structuredClone(P.fx??{}),gate:{on:P.gateOn,db:I.gateDb.value},level:I.presetLevel.value}}function Ci(){let e=new Map;hn.forEach((t,n)=>{let r=O.find(e=>e.id===t.amp);if(r&&!yr(r)&&P.preset!==`factory:${n}`)return;let i=t.group??`Factory`;e.has(i)||e.set(i,Object.assign(document.createElement(`optgroup`),{label:i})),e.get(i).append(new Option(t.group?t.name.replace(`${t.group}: `,``):t.name,`factory:${n}`))});let t=document.createElement(`optgroup`);t.label=`Yours`;for(let e of Q)t.append(new Option(e.name,`user:${e.id}`));gi.replaceChildren(new Option(`— Pick a preset —`,``),...e.values(),...Q.length?[t]:[]),gi.value=bi(P.preset)?P.preset:``;let n=bi(P.preset);_i.value=n?.name??``;let r=L(`#preset-notes`);r.textContent=n?.notes??``,r.hidden=!n?.notes;let i=!!P.preset?.startsWith(`user:`);vi.textContent=i?`Save`:`Save as mine`,vi.title=i?`Save your changes to this preset`:`Save the rig as one of your presets`,yi.hidden=!i,Ti()}function wi(){let e=bi(P.preset);return!!e&&xi(e)!==xi(Si(e.name))}function Ti(){let e=wi();L(`#preset-edited`).hidden=!e,L(`#preset-ab`).hidden=!e&&!$}async function Ei(e){let t=O.find(t=>t.id===e.amp)??O[0];P.amp=t.id,gr.value=t.id,(P.ampKnobs??={})[t.id]={...e.ampKnobs},P.board=Array.from({length:4},(t,n)=>{let r=e.pedals[n];return r&&Br(r.id)?{id:r.id,on:r.on,knobs:{...r.knobs}}:null}),P.circuitSlot!==null&&P.circuitSlot!==void 0&&!P.board[P.circuitSlot]&&(P.circuitSlot=null);let n=e.cab===`amp`?Er(t):e.cab;P.cab=[...z.options].some(e=>e.value===n)?n:Er(t),z.value=P.cab,P.fx=structuredClone(e.fx),P.gateOn=e.gate.on,I.gateDb.set(e.gate.db,!1),P.knobs.gateDb=I.gateDb.value,I.presetLevel.set(e.level??0,!1),P.presetLevel=I.presetLevel.value,F(),B(`preset`,e.name),Sr(),q(),Or(),V&&(Qn(),Ir(),await Promise.all([Tr(),ui(),er()]))}gi.addEventListener(`change`,async()=>{$=null,Fi(),ji(),P.preset=gi.value||void 0;let e=bi(P.preset);Ci(),e&&await Ei(e),e&&y(`preset_selected`,{preset:P.preset.startsWith(`user:`)?`user`:e.name,group:e.group??null}),Ti()});var Di=e=>e.group?e.name.replace(`${e.group}: `,``):e.name,Oi=L(`#preset-saving`),ki=()=>P.preset?.startsWith(`user:`)?Q.find(e=>`user:${e.id}`===P.preset):void 0;function Ai(e){let t=ki();if(t)Object.assign(t,Si(e));else{let t=Date.now().toString(36);Q.push({...Si(e),id:t}),P.preset=`user:${t}`}$=null,y(`preset_saved`,{amp:P.amp}),vn(Q),F(),Ci()}function ji(){Oi.hidden=!0,vi.hidden=!1}vi.addEventListener(`click`,()=>{let e=ki();if(e){Ai(e.name);return}let t=bi(P.preset);_i.value=t?`My ${Di(t)}`:`My tone ${Q.length+1}`,Oi.hidden=!1,vi.hidden=!0,_i.focus(),_i.select()}),L(`#preset-save-ok`).addEventListener(`click`,()=>{Ai(_i.value.trim()||`My tone ${Q.length+1}`),ji()}),L(`#preset-save-cancel`).addEventListener(`click`,ji),_i.addEventListener(`keydown`,e=>{e.key===`Enter`?L(`#preset-save-ok`).click():e.key===`Escape`&&ji()});function Mi(e){let t=[...gi.options].filter(e=>e.value);if(!t.length)return;let n=t.findIndex(e=>e.value===gi.value);gi.value=t[n<0?e>0?0:t.length-1:(n+e+t.length)%t.length].value,gi.dispatchEvent(new Event(`change`))}L(`#preset-prev`).addEventListener(`click`,()=>Mi(-1)),L(`#preset-next`).addEventListener(`click`,()=>Mi(1));var $=null,Ni=!1,Pi=L(`#preset-ab`);function Fi(){Pi.textContent=$?$.showing===`A`?`Hearing A (saved)`:`Hearing B (your edit)`:`A / B`,Pi.classList.toggle(`active`,!!$)}Pi.addEventListener(`click`,async()=>{let e=bi(P.preset);if(e){$||={edit:Si(e.name),showing:`B`},$.showing=$.showing===`A`?`B`:`A`,Ni=!0;try{await Ei($.showing===`A`?e:$.edit)}finally{Ni=!1}Fi(),Ti()}});var Ii=0;yi.addEventListener(`click`,()=>{P.preset?.startsWith(`user:`)&&(Ii?(clearTimeout(Ii),Ii=0,yi.textContent=`Delete`,Q=Q.filter(e=>`user:${e.id}`!==P.preset),P.preset=void 0,vn(Q),F(),Ci()):(yi.textContent=`Really delete?`,Ii=window.setTimeout(()=>{Ii=0,yi.textContent=`Delete`},3e3)))}),L(`#preset-export`).addEventListener(`click`,()=>{let e=document.createElement(`a`);e.href=URL.createObjectURL(new Blob([JSON.stringify(Q,null,2)],{type:`application/json`})),e.download=`phreakguitar-presets.json`,e.click(),URL.revokeObjectURL(e.href)});var Li=L(`#preset-file`);L(`#preset-import`).addEventListener(`click`,()=>Li.click()),Li.addEventListener(`change`,async()=>{let e=Li.files?.[0];if(Li.value=``,e)try{let t=JSON.parse(await e.text()),n=(Array.isArray(t)?t:[]).filter(yn),r=new Set(Q.map(e=>e.id));for(let e of n)Q.push(r.has(e.id)?{...e,id:`${e.id}-${Date.now().toString(36)}`}:e);vn(Q),Ci(),L(`#preset-note`).textContent=`Imported ${n.length} preset${n.length===1?``:`s`}.`}catch{L(`#preset-note`).textContent=`That file isn't a PhreakGuitar preset file.`}}),Dn=()=>{Ti(),la()},Ci();var Ri=-60,zi=-90,Bi=24,Vi=e=>e>0?20*Math.log10(e):-1/0,Hi={};function Ui(e,t){let n=performance.now(),r=Hi[e]??{db:-1/0,at:n},i=r.db-(n-r.at)/1e3*Bi;return Hi[e]={db:Math.max(t,i),at:n},Hi[e].db}function Wi(e,t){let n=Ui(e,Vi(t)),r=Math.max(0,Math.min(1,(n-Ri)/60));L(`#${e} .meter-fill`).style.transform=`scaleX(${r})`,L(`#${e} .meter-readout`).textContent=n>zi?`${n.toFixed(1)} dB`:`–∞`,L(`#${e}`).classList.toggle(`hot`,n>-3)}function Gi(e){Rr.textContent=e.pedalFaults>0||e.pedalNewtonFailures>0?`Solver: ${e.pedalNewtonFailures} slow samples, ${e.pedalFaults} resets`:``,Wi(`meter-in`,e.inputPeak),Wi(`meter-out`,e.outputPeak);let t=Math.max(0,Ui(`meter-limit-gr`,-Vi(e.limiterGain)));L(`#meter-limit .meter-fill`).style.transform=`scaleX(${Math.min(1,t/12)})`,L(`#meter-limit .meter-readout`).textContent=t>.05?`−${t.toFixed(1)} dB`:`0 dB`,L(`#meter-limit`).classList.toggle(`active`,t>.05),L(`#limit-led`).classList.toggle(`on`,t>.05);let n=Hi[`meter-out`]?.db??-1/0,r=Math.max(0,Math.min(1,(n-Ri)/60));for(let e of sa)e.level(r,n>-3)}var Ki=e=>`${e.toFixed(1)} ms`;function qi(){if(!V){L(`#lat-estimate`).textContent=`—`,L(`#lat-breakdown`).textContent=`Power on to see the signal path latency.`,L(`#dropouts`).textContent=`—`;return}let e=V.latency(),t=e.baseMs+e.outputMs+(e.inputMs??0)+e.engineMs;L(`#lat-estimate`).textContent=Ki(t),L(`#lat-breakdown`).textContent=`buffer ${Ki(e.baseMs)} + output ${Ki(e.outputMs)} + input ${e.inputMs===null?`n/a`:Ki(e.inputMs)} + amp ${Ki(e.engineMs)}`;let n=V.glitchStats(),r=Math.floor(n.runningSeconds/60),i=Math.floor(n.runningSeconds%60);L(`#dropouts`).textContent=`${n.dropouts} in ${r}:${String(i).padStart(2,`0`)}`,L(`#dropouts`).dataset.bad=String(n.dropouts>0)}setInterval(qi,500),qi(),L(`#dropouts-reset`).addEventListener(`click`,()=>{V?.resetGlitchStats(),qi()}),zn.addEventListener(`click`,async()=>{if(!V)return;zn.disabled=!0;let e=L(`#lat-measured`);e.textContent=`Measuring…`;try{let t=await V.measureLoopback(),n=t+V.latency().engineMs;e.textContent=`${Ki(n)} round trip`,e.dataset.ok=String(n<=12),L(`#lat-measured-note`).textContent=`device ${Ki(t)} + amp ${Ki(V.latency().engineMs)} · target ≤ 12 ms`}catch(t){e.textContent=`Failed`,delete e.dataset.ok,L(`#lat-measured-note`).textContent=hr(t)}finally{zn.disabled=!1}}),navigator.mediaDevices?.addEventListener(`devicechange`,()=>void tr()),tr();function Ji(e,t){let n=new DataView(new ArrayBuffer(44)),r=(e,t)=>[...t].forEach((t,r)=>n.setUint8(e+r,t.charCodeAt(0)));return r(0,`RIFF`),n.setUint32(4,36+e.byteLength,!0),r(8,`WAVE`),r(12,`fmt `),n.setUint32(16,16,!0),n.setUint16(20,3,!0),n.setUint16(22,1,!0),n.setUint32(24,t,!0),n.setUint32(28,t*4,!0),n.setUint16(32,4,!0),n.setUint16(34,32,!0),r(36,`data`),n.setUint32(40,e.byteLength,!0),new Blob([n,new Float32Array(e)])}async function Yi(){if(!V)throw Error(`power on first`);let e=await V.capture(),t=new Date().toISOString().replace(/[:.]/g,`-`).slice(0,19),n={capturedAt:new Date().toISOString(),sampleRate:e.sampleRate,seconds:e.dry.length/e.sampleRate,events:Xn.filter(e=>e.t>=0).map(t=>({...t,t:+(t.t-e.endTime).toFixed(3)})).filter(t=>t.t>-e.dry.length/e.sampleRate),settings:P,pedals:P.board.map(e=>e?`${e.id}${e.on?``:` (bypassed)`}`:null),latency:V.latency(),dropouts:V.glitchStats(),pedalStatus:[...Ur,Rr.textContent]},r=(e,t)=>fetch(`/__capture?file=${e}`,{method:`POST`,body:t}).then(e=>{if(!e.ok)throw Error(`save failed (${e.status})`)});return await r(`${t}-dry.wav`,Ji(e.dry,e.sampleRate)),await r(`${t}-wet.wav`,Ji(e.wet,e.sampleRate)),await r(`${t}-meta.json`,new Blob([JSON.stringify(n,null,2)])),t}L(`#send-capture`).addEventListener(`click`,async()=>{let e=L(`#capture-status`);e.textContent=`Saving…`;try{e.textContent=`Saved as captures/${await Yi()}-*. Tell Claude what you heard and roughly when.`}catch(t){e.textContent=hr(t)}});var Xi=L(`#settings`),Zi=L(`#drawer-scrim`),Qi=L(`#settings-btn`);function $i(e){Xi.hidden=!e,Zi.hidden=!e,Qi.setAttribute(`aria-expanded`,String(e))}Qi.addEventListener(`click`,()=>$i(!!Xi.hidden)),L(`#settings-close`).addEventListener(`click`,()=>$i(!1)),Zi.addEventListener(`click`,()=>$i(!1));var ea={eq7:`E`,delay:`D`,reverb:`R`};function ta(){let e=[{id:`gate`,label:`Gate`,on:P.gateOn,key:`G`},{id:`comp`,label:`Red Comp`,on:U(fn).on,key:`C`}];for(let t=0;t<4;t++){let n=Vr(t),r=G(t);n&&r&&e.push({id:`slot${t}`,label:n.name,on:r.on,key:String(t+1)})}for(let t of dn)e.push({id:t.id,label:t.name,on:U(t).on,key:ea[t.id]??``});if(P.looperOn){let t=W?.state??`empty`;e.push({id:`looper`,label:`Looper · ${Et[t]}`,on:t===`recording`||t===`playing`||t===`overdubbing`,key:`L`})}return e}function na(e){if(e===`looper`)Mr(0);else if(e===`gate`)di(!P.gateOn),q();else if(e===`comp`||dn.some(t=>t.id===e)){let t=e===`comp`?fn:dn.find(t=>t.id===e),n=U(t);n.on=!n.on,F(),V?.setFxEnabled(t.index,n.on,t.stage),B(`fx.${t.id}.on`,n.on),e===`comp`?q():Or()}else if(e.startsWith(`slot`)){let t=Number(e.slice(4)),n=G(t);if(!n)return;n.on=!n.on,F(),V?.setPedalEnabled(t,n.on),B(`pedal${t}.on`,n.on),q()}}var ra=e=>({preset:()=>{let e=bi(P.preset);return{name:e?Di(e):`No preset`,notes:e?.notes,edited:wi()}},items:ta,toggle:na,prev:()=>Mi(-1),next:()=>Mi(1),tuner:()=>{Z.disabled||Z.click()},master:{spec:An.master,get:()=>I.master.value,set:e=>I.master.set(e)},close:e}),ia=L(`#stage`),aa=wt(ra(()=>ua(!1)),`full`),oa=wt(ra(),`mini`);ia.append(aa.el),L(`#mini-slot`).append(oa.el);var sa=[aa,oa],ca=!1;function la(){ca||(ca=!0,requestAnimationFrame(()=>{ca=!1,ia.hidden||aa.refresh(),L(`#mini-slot`).hidden||oa.refresh()}))}function ua(e){ia.hidden=!e,document.body.classList.toggle(`staging`,e),L(`#stage-btn`).setAttribute(`aria-pressed`,String(e)),e&&(aa.refresh(),y(`stage_opened`))}L(`#stage-btn`).addEventListener(`click`,()=>ua(!!ia.hidden));function da(){let e=fi.isOpen()&&innerWidth>=1200;L(`#practice`).classList.toggle(`side`,e),L(`#mini-slot`).hidden=!e,e&&oa.refresh()}addEventListener(`resize`,da),da(),document.addEventListener(`keydown`,e=>{if(e.metaKey||e.ctrlKey||e.altKey)return;let t=e.target;if(e.key===`Escape`){ia.hidden?Xi.hidden||$i(!1):ua(!1);return}if(t.closest(`input, select, textarea, [contenteditable="true"], .knob`))return;let n=e.key.toLowerCase();if(e.key===`ArrowLeft`||e.key===`ArrowRight`)e.preventDefault(),Mi(e.key===`ArrowLeft`?-1:1);else if(/^[1-4]$/.test(n))na(`slot${Number(n)-1}`);else if(n===`g`)na(`gate`);else if(n===`c`)na(`comp`);else if(n===`e`)na(`eq7`);else if(n===`d`)na(`delay`);else if(n===`r`)na(`reverb`);else if(n===`t`)Z.disabled||Z.click();else if(n===`s`)ua(!!ia.hidden);else if(n===`l`)Mr(0);else if(n===`k`)Mr(1);else if(n===`u`)Mr(2);else return;la()}),L(`#capture-sec`).hidden=!0;function fa(){let e=document.createElement(`section`);e.className=`card welcome`,e.setAttribute(`aria-label`,`Welcome`),e.innerHTML=`
    <h2>Welcome to PhreakGuitar</h2>
    <p>A guitar rig in your browser: amps and pedals simulated as real circuits.</p>
    <ul>
      <li><b>Use an audio interface, and headphones or speakers.</b> A laptop's built-in microphone
        with its speakers will howl with feedback.</li>
      <li>Press <b>Choose my interface</b> below (it's also in <b>⚙ Settings</b>): allow the microphone so your browser
        can list your interface, pick its input, channel and output, then flip the <b>power switch</b> at the top right.</li>
      <li>Master starts at −12 dB. Turn it up slowly. Your audio stays on this computer.</li>
    </ul>
    <div class="welcome-actions">
      <button class="welcome-devices">Choose my interface</button>
      <button class="link welcome-ok">Got it</button>
    </div>`,sr&&e.querySelector(`ul`).insertAdjacentHTML(`afterbegin`,`<li class="welcome-phone"><b>On a phone?</b> Have a look around the amps, pedals and presets. To play, you'll want a
      computer (or a phone with an audio interface that plugs into it) and headphones.</li>`);let t=()=>{P.welcomed=!0,F(),e.remove()};e.querySelector(`.welcome-ok`).addEventListener(`click`,()=>{t(),y(`welcome_done`,{choice:`ok`})}),e.querySelector(`.welcome-devices`).addEventListener(`click`,()=>{t(),y(`welcome_done`,{choice:`devices`}),$i(!0),nr.hidden||ir()}),L(`main`).prepend(e)}!(`AudioWorkletNode`in window)||!navigator.mediaDevices?.getUserMedia||typeof WebAssembly>`u`?(H(`This browser can't run the rig (it needs AudioWorklet, WebAssembly and microphone access). Try Chrome or Edge.`,`error`),R.disabled=!0,y(`unsupported_browser`)):En&&!P.welcomed&&fa(),P.powered&&!new URLSearchParams(location.search).has(`nopower`)&&dr();