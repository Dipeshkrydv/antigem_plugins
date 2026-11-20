// DeepX Google Flow Studio — AntiGem plugin worker (MCP tools only, no side panel).
// Standard mode runs on AntiGem's native Flow engine (flow-client.js / page-helpers.js:
// trusted Android touch, request guard, job polling). Agent Mode is the DeepX engine
// (deepx-agent.js / deepx-agent-page.js). When Google Flow rejects standard generation with
// an "unusual activity / extension / captcha" block, prompts are re-sent through Agent Mode.
import { FlowClient, IMAGE_MODELS, VIDEO_MODELS } from './flow-client.js';
import { RPC } from './constants.js';
import { createFlowWorkflows } from './flow-workflows.js';
import { getDeepXKnowledgeMarkdown } from './deepx-knowledge.js';
import { analyzeAndBreakdownScript, detectProtagonistEntities, setLocalAssetIndex } from './storyboard-analyzer.js';
import { createDeepXAgent, buildAgentParts, expandBulkRequest, isBlockError, DEFAULT_MASTER_AGENT_INSTRUCTIONS, AGENT_MAX_PER_PART, agentImageModel, agentVideoModel, AGENT_IMAGE_MODELS, AGENT_VIDEO_MODELS } from './deepx-agent.js';

// Shared by every plugin that embeds DeepX (deepx-google-flow, 2d-video-editing-studio, facebook-automation).
let PLUGIN_ID = "deepx-google-flow";
let PLUGIN_VERSION = "1.1.0";
export function configureDeepX({ pluginId, version } = {}) { if (pluginId) PLUGIN_ID = pluginId; if (version) PLUGIN_VERSION = version; }

const MODEL_ALIASES = {
  'imagen-3': 'Nano Banana 2.1',
  'imagen3': 'Nano Banana 2.1',
  'nano-banana-2': 'Nano Banana 2.1',
  'nano-banana-2.1': 'Nano Banana 2.1',
  'nano banana 2': 'Nano Banana 2.1',
  'nano-banana-pro': 'Nano Banana Pro',
  'nano banana pro': 'Nano Banana Pro',
  'nano-banana-lite': 'Nano Banana 2 Lite',
  'nano-banana-2-lite': 'Nano Banana 2 Lite',
  'nano banana 2 lite': 'Nano Banana 2 Lite',
  'veo-3.1-fast': 'Veo 3.1 - Fast',
  'veo-3.1-lite': 'Veo 3.1 - Lite',
  'veo-3.1-quality': 'Veo 3.1 - Quality',
  'omni-flash': 'Omni 1.1 Flash'
};

const client = new FlowClient(chrome), jobs = new Map();
const finished = job => ['done','failed','cancelled'].includes(job.status);
const snapshot = job => Object.fromEntries(Object.entries(job).filter(([key]) => !['abort','request','completion','tabId','reserved'].includes(key)));
const workflows = createFlowWorkflows({chrome,client,execute,jobs,enqueue,normalize:request,awaitJobs,snapshot});
const sleep = ms => new Promise(r => setTimeout(r,ms));

function normalizeModel(rawModel, video) {
  if (!rawModel) return video ? VIDEO_MODELS[0] : IMAGE_MODELS[0];
  const key = String(rawModel).trim().toLowerCase();
  if (MODEL_ALIASES[key]) return MODEL_ALIASES[key];
  return rawModel;
}

function request(args, video) {
  const model = normalizeModel(args.model, video);
  if (!(video ? VIDEO_MODELS : IMAGE_MODELS).includes(model)) throw new Error('Unknown Flow model: ' + model);
  const prompt = String(args.prompt || '').trim(); if(!prompt)throw new Error('prompt is required');
  const aspect = args.aspect_ratio || '16:9'; if(!(video?['16:9','9:16']:['16:9','4:3','1:1','3:4','9:16']).includes(aspect))throw new Error('Unsupported aspect ratio');
  const count = args.count ?? 1; if(!Number.isInteger(count)||count<1||count>4)throw new Error('count must be 1–4; use items for different prompts');
  const references = args.references || []; if(!Array.isArray(references)||references.some(x=>typeof x!=='string'||!x.trim()))throw new Error('references must contain image ids or paths');
  if(args.end_frame&&!args.start_frame)throw new Error('end_frame requires start_frame'); if(video&&references.length&&args.start_frame)throw new Error('Use ingredients or start/end frames, not both');
  if(video&&references.length&&model.includes('Quality'))throw new Error('Veo Quality does not support ingredients');
  const duration = args.duration ?? 8, resolution = args.resolution || '720p'; if(video&&model.includes('Omni')&&(![4,6,8,10].includes(duration)||!['360p','720p'].includes(resolution)))throw new Error('Unsupported Omni duration or resolution');
  if(video&&!model.includes('Omni')&&(duration!==8||resolution!=='720p'))throw new Error('Veo generation supports 8 seconds at 720p');
  if(args.seed!=null)throw new Error('seed cannot be selected by the current Flow website UI');
  return {...args,prompt,video,model,aspect,count,references,duration,resolution};
}

function engineEnqueue(req) {
  const job={job_id:crypto.randomUUID().slice(0,8),status:'queued',stage:'waiting in queue',type:req.video?'video':'image',model:req.model,prompt:req.prompt?.slice(0,200)||'',files:[],request:req,abort:new AbortController()};
  jobs.set(job.job_id,job);if(jobs.size>2000)for(const [id,j] of jobs){if(finished(j))jobs.delete(id);if(jobs.size<=2000)break;}
  const submission=client.exclusive(async()=>{if(job.abort.signal.aborted)return null;job.status='running';return req.action ? client.submitEdit(job) : client.submit(job);});
  job.completion=submission.then(async sub=>{if(sub)await client.collect(job,sub);}).catch(error=>{if(job.status!=='cancelled'){job.status='failed';job.stage='failed';job.error=error.message;}});
  return job;
}

async function awaitJobs(selected,seconds=45){if(!selected.length)return[];await Promise.race([Promise.all(selected.map(j=>j.completion)),sleep(Math.max(0,Math.min(50,seconds))*1000)]);return selected.length===1?snapshot(selected[0]):selected.map(snapshot);}

async function readBlob(tabId, result, filename) {
  if(!result?.len)throw new Error('Flow export contains no file');
  try{for(let at=0;at<result.len;at+=512*1024){const data=await client.js(tabId,`s.blobChunk(${JSON.stringify(result.key)},${at},${512*1024})`);await chrome.antigem.writeFile({path:filename,data,encoding:'base64',append:at>0});}return(await chrome.antigem.stat({path:filename})).path;}finally{await client.js(tabId,`s.blobDrop(${JSON.stringify(result.key)})`);}
}


// AntiGem native Flow engine tool handlers (flow_* + compatibility deepx_* through workflows.call)
async function engineExecute(tool,args={}) {
  // Google Flow & DeepX Rapid Flow Workflows
  if(tool.startsWith("deepx_")||["flow_get_options","flow_analyze_script","flow_batch_generate","flow_storyboard","flow_character_pipeline","flow_list_characters","flow_generate_character","flow_upload_character","flow_rename_character","flow_attach_references","flow_chain_scene","flow_download_media","flow_eval_script"].includes(tool)){const value=await workflows.call(tool,args);if(!value?.__unhandled)return value;}
  if(tool==='flow_generate_image'||tool==='flow_generate_video'){
    const items=args.items?.length?args.items:[args];if(items.length>500)throw new Error('At most 500 items per call');
    const budget=args.max_credits==null?null:{limit:args.max_credits,used:0};if(budget&&(!Number.isFinite(budget.limit)||budget.limit<0))throw new Error('max_credits must be non-negative');
    const requests=items.map(item=>request({...args,...(typeof item==='string'?{prompt:item}:item),budget},tool==='flow_generate_video'));
    if(args.new_project){const project=await client.exclusive(async()=>{const tabId=await client.tab();const p=await client.createProject(tabId,args.title);await client.page(tabId,p.projectId);return p;});for(const req of requests){req.project_id=project.projectId;req.new_project=false;}}
    if(requests.length>1){
      const tab=await client.tab();await client.begin(tab);
      const selected=requests.map(enqueue);
      Promise.all(selected.map(job=>job.completion)).finally(()=>client.end(tab)).catch(console.error);
      return awaitJobs(selected,args.wait_seconds??45);
    }
    return awaitJobs(requests.map(enqueue),args.wait_seconds??45);
  }
  if(tool==='flow_get_job'){const ids=[...(args.job_ids||[]),...(args.job_id?[args.job_id]:[])];if(!ids.length)throw new Error('job_id or job_ids required');const selected=ids.map(id=>{const job=jobs.get(id);if(!job)throw new Error('Unknown job_id: '+id);return job;});return awaitJobs(selected,args.wait_seconds??45);}
  if(tool==='flow_cancel'){let count=0;const selected=new Set(args.job_id?[args.job_id]:[...jobs.keys()]);for(const id of selected)for(const child of jobs.get(id)?.child_job_ids||[])selected.add(child);for(const job of jobs.values())if(!finished(job)&&selected.has(job.job_id)){job.status='cancelled';job.stage='cancelled';job.abort.abort();count++;}return{cancelled:count};}
  if(['flow_edit_image','flow_edit_video','flow_extend_video','flow_upscale_image','flow_upscale_video'].includes(tool)){
    if(!args.media_id)throw new Error('media_id required');const video=tool.endsWith('video'),action=tool.includes('upscale')?'upscale_'+(video?'video':'image'):tool.includes('extend')?'extend':'edit';
    if(!tool.includes('upscale')&&!args.prompt?.trim())throw new Error('prompt required');
    const req={...args,action,video,references:args.references||[],resolution:args.resolution||(video?'720p':'2K'),aspect:args.aspect_ratio};
    return awaitJobs([enqueue(req)],args.wait_seconds??45);
  }
  if(tool==='flow_status'){
    const tabId=await client.tab(),ui=await client.js(tabId,'s.ui()');return{logged_in:ui.ready,account:ui.account,project_id:ui.projectId,settings:ui.settingsText,queued_jobs:[...jobs.values()].filter(j=>j.status==='queued').length,running_jobs:[...jobs.values()].filter(j=>j.status==='running').map(snapshot),extension:chrome.runtime.id};
  }
  if(tool==='flow_list_models')return client.rpc(await client.tab(),RPC.MODELS,[],'models');
  if(tool==='flow_list_projects')return client.rpc(await client.tab(),RPC.PROJECTS,['projects/*',args.limit??20,null,null,null,null,[1]],'projects');
  if(tool==='flow_get_settings')return client.js(await client.tab(),'s.ui().settingsText');
  if(tool==='flow_get_media'){const tabId=await client.tab();if(!args.media_id)throw new Error('media_id required');const file=await client.file(tabId,args.media_id);if(args.view&&file.type==='image')return{content:[{type:'text',text:JSON.stringify(file)},{type:'image',data:await chrome.antigem.readFile({path:file.path,encoding:'base64'}),mimeType:'image/jpeg'}]};return file;}
  if(tool==='flow_list_media'||tool==='flow_get_last_media'){
    const tabId=await client.tab();
    let project=args.project_id||(await client.js(tabId,'s.ui()')).projectId;
    if(!project){
      try { project=await client.project(tabId); } catch(_) {}
    }
    if(!project)throw new Error('No active project found in Flow. Please click into a project or create one.');
    let media=await client.contents(tabId,project);media=media.filter(m=>(args.include_trashed||!m.trashed)&&(!args.type||m.type===args.type)&&(!args.pending_only||m.pending)&&(!args.query||`${m.title} ${m.prompt}`.toLowerCase().includes(args.query.toLowerCase())));
    if(tool==='flow_get_last_media'){const history=client.history.filter(m=>!args.type||m.type===args.type).toReversed();const seen=new Set(history.map(m=>m.media_id));return[...history,...media.toReversed().filter(m=>!seen.has(m.mediaId))].slice(0,args.count??1);}
    return media;
  }
  if(tool==='flow_video_status'){const tabId=await client.tab();if(!args.media_ids?.length)throw new Error('media_ids required');const statuses=await client.statusVideos(tabId,args.media_ids);return Promise.all(statuses.map(async m=>({...m,state:m.status===3?'done':[1,2,6].includes(m.status)?'pending':'failed',...(m.status===3&&args.download!==false?await client.file(tabId,m.mediaId):{})})));}
  return client.exclusive(async()=>{
    const tabId=await client.tab();await client.begin(tabId);
    try{
      if(tool==='flow_create_project'){const p=await client.createProject(tabId,args.title);if(args.open!==false)await client.page(tabId,p.projectId);return p;}
      if(tool==='flow_open_project'){if(!args.project_id)throw new Error('project_id required');await client.page(tabId,args.project_id);return{project_id:args.project_id};}
      if(tool==='flow_rename_project')return client.rpc(tabId,RPC.RENAME_PROJECT,[`projects/${args.project_id}`,[args.title],[['project_title']],[null,22]],'renamed');
      if(tool==='flow_upload_media'){if(!args.file_paths?.length)throw new Error('file_paths required');await client.project(tabId,args.project_id);const output=[];for(const file of args.file_paths)output.push({file,media_id:await client.resolveReference(tabId,file)});return output;}
      if(tool==='flow_rename_media'){const m=await client.media(tabId,args.media_id);return client.rpc(tabId,RPC.RENAME_WORKFLOW,[[m.workflowId,null,null,[args.title],m.projectId],[['metadata.display_name']]],'ok');}
      if(tool==='flow_trash_media'||tool==='flow_restore_media'){if(!args.media_ids?.length)throw new Error('media_ids required');const entries=[];for(const id of args.media_ids){const m=await client.media(tabId,id);entries.push([m.workflowId,null,null,[null,null,tool==='flow_trash_media'],m.projectId]);}await client.rpc(tabId,RPC.UPDATE_WORKFLOWS,[entries,[['metadata.archived']]],'ok');return{updated:entries.length};}
      if(tool==='flow_lock_tab'){await chrome.antigem.automation({tabId,locked:!!args.locked});return{locked:!!args.locked};}
      if(tool==='flow_extract_frame'){const video=await client.file(tabId,args.media_id);const result=await chrome.antigem.mediaFrame({path:video.path,at_seconds:args.at_seconds});if(args.upload){await client.project(tabId,args.project_id);result.media_id=await client.resolveReference(tabId,result.path);}return result;}
      if(tool==='flow_video_to_gif'){const result=await client.rpc(tabId,RPC.GIF,[null,args.media_id],'gif',120000);return{path:await readBlob(tabId,result,`~/flow-media/flow_${args.media_id}.gif`)};}
      if(tool==='flow_combine_videos'){if(!args.clips?.length)throw new Error('clips required');const clips=[];for(const clip of args.clips){let end=clip.end;if(end==null){const file=await client.file(tabId,clip.media_id);end=(await chrome.antigem.mediaInfo({path:file.path})).duration;}clips.push([clip.media_id,null,clip.start==null?[]:[clip.start],[end]]);}const started=await client.rpc(tabId,RPC.CONCAT,[clips],'concatStart');const result=await client.wait(async()=>{const r=await client.rpc(tabId,RPC.CONCAT_STATUS,[[[started.job]]],'concatStatus');return r.state===3&&r.len&&r;},300000,2000);const file=await readBlob(tabId,result,`~/flow-media/combined_${Date.now()}.mp4`);return{path:file,...(args.upload_back?{media_id:await client.resolveReference(tabId,file)}:{})};}
      if(tool==='flow_create_scene'){if(!args.media_ids?.length)throw new Error('media_ids required');const medias=await Promise.all(args.media_ids.map(id=>client.media(tabId,id)));if(medias.some(m=>m.projectId!==medias[0].projectId))throw new Error('Scene media must belong to the same project');return client.rpc(tabId,RPC.CREATE_SCENE,[`projects/${medias[0].projectId}`,medias.map(m=>m.workflowId),null,args.aspect_ratio==='9:16'?1:2],'scene');}
      throw new Error('Unknown DeepX Flow tool: '+tool);
    }finally{await client.end(tabId);}
  });
}


// ============================================================================
// DeepX layer: mode choice, Agent Mode, 24-per-part chunking, block fallback
// ============================================================================
const agent = createDeepXAgent({ chrome, client, jobs, awaitJobs });
const BLOCK_REROUTE_MS = 15 * 60 * 1000;
let lastBlock = null; // { at, text }
const recentlyBlocked = () => !!lastBlock && Date.now() - lastBlock.at < BLOCK_REROUTE_MS;
const markBlocked = text => { lastBlock = { at: Date.now(), text: String(text || '').slice(0, 300) }; };

const IMAGE_WORDS = /\b(image|images|photo|photos|picture|pictures|portrait|illustration|drawing|wallpaper|cutout|sticker|thumbnail|poster|logo|icon|render|still)\b/i;
const VIDEO_WORDS = /\b(video|videos|clip|clips|animation|animate|animated|footage|reel|shorts?|cinematic shot|scene video|veo|omni)\b/i;

function normMode(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return null;
  if (/^(agent|agent[_ -]?mode|flow[_ -]?agent|with[_ -]?agent)$/.test(s)) return 'agent';
  if (/^(standard|normal|direct|without[_ -]?agent|no[_ -]?agent|non[_ -]?agent|classic)$/.test(s)) return 'standard';
  return null;
}

function detectMedia(args, text = '') {
  const m = String(args.media_type || '').toLowerCase();
  if (m === 'video' || m === 'image') return m;
  if (args.mode === 'textToVideo') return 'video';
  if (args.mode === 'textToImage') return 'image';
  const model = String(args.model || args.video_model || args.image_model || '').toLowerCase();
  if (/veo|omni/.test(model) && !args.image_model) return 'video';
  if (/banana|imagen|narwhal/.test(model)) return 'image';
  if (VIDEO_WORDS.test(text) && !IMAGE_WORDS.test(text)) return 'video';
  return 'image';
}

function splitScript(text) {
  const t = String(text || '').trim();
  if (!t) return [];
  let parts = t.split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean);
  if (parts.length === 1) {
    const lines = t.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
    const listy = lines.filter(l => /^(?:\d+[\.\):-]|[-*•]|(?:scene|shot|image|prompt|item|दृश्य|सीन)\s*#?\d+)/i.test(l)).length;
    if (lines.length > 1 && listy >= Math.max(2, Math.ceil(lines.length * 0.6))) parts = lines;
  }
  return parts;
}

async function collectItems(args) {
  if (Array.isArray(args.prompts) && args.prompts.length) return { items: args.prompts.map(p => (typeof p === 'string' ? p : p?.prompt || '')).map(s => s.trim()).filter(Boolean) };
  if (Array.isArray(args.items) && args.items.length) return { items: args.items.map(p => (typeof p === 'string' ? p : p?.prompt || '')).map(s => s.trim()).filter(Boolean) };
  const raw = args.script_text || args.storyboard_text || args.raw_input || args.prompt_or_storyboard || '';
  if (raw && args.auto_breakdown) {
    const files = [];
    for (const dir of args.asset_dirs || ['~/assets']) { try { files.push(...await chrome.antigem.listFiles({ path: dir, recursive: true, limit: 1000 })); } catch (_) {} }
    setLocalAssetIndex(files);
    const analysis = analyzeAndBreakdownScript({ ...args, raw_input: raw });
    return { items: (analysis.storyboard || []).map(s => s.prompt).filter(Boolean), analysis };
  }
  if (raw) return { items: splitScript(raw) };
  if (args.prompt) return { items: [String(args.prompt).trim()].filter(Boolean) };
  return { items: [] };
}

const STD_IMAGE = v => { const s = String(v || '').replace(/^🍌\s*/, '').toLowerCase(); if (s.includes('pro')) return 'Nano Banana Pro'; if (s.includes('lite') || s === 'nano banana 2') return 'Nano Banana 2 Lite'; return 'Nano Banana 2.1'; };
const STD_VIDEO = v => { const s = String(v || '').toLowerCase(); if (s.includes('quality')) return 'Veo 3.1 - Quality'; if (s.includes('fast')) return 'Veo 3.1 - Fast'; if (s.includes('lite')) return 'Veo 3.1 - Lite'; return 'Omni 1.1 Flash'; };

function standardRequest(args, prompt, media) {
  const video = media === 'video';
  const model = video ? STD_VIDEO(args.video_model || args.model) : STD_IMAGE(args.image_model || args.model);
  let aspect = args.aspect_ratio || '16:9';
  if (video && !['16:9', '9:16'].includes(aspect)) aspect = '16:9';
  if (!video && !['16:9', '4:3', '1:1', '3:4', '9:16'].includes(aspect)) aspect = '16:9';
  let duration = 8;
  if (video && model.includes('Omni')) { const d = Number(args.duration) || 8; duration = [4, 6, 8, 10].reduce((a, b) => Math.abs(b - d) < Math.abs(a - d) ? b : a, 8); }
  const references = args.no_references ? [] : (args.references || args.reference_media_ids || args.hero_references || args.reference_assets || []);
  return request({
    prompt, model, aspect_ratio: aspect, count: Math.max(1, Math.min(4, Number(args.count) || 1)), references,
    duration, resolution: video ? (args.resolution === '360p' ? '360p' : '720p') : undefined,
    start_frame: args.start_frame, end_frame: args.end_frame, project_id: args.project_id, dry_run: args.dry_run,
    max_credits: args.max_credits, no_agent_fallback: true
  }, video);
}

function agentOptions(args, media, extra = {}) {
  return {
    mediaType: media, aspectRatio: args.aspect_ratio || (media === 'video' ? '16:9' : '16:9'), quality: args.quality,
    imageModel: args.image_model || (media === 'image' ? args.model : null), videoModel: args.video_model || (media === 'video' ? args.model : null),
    duration: args.duration, maxPerPart: args.max_per_part || args.max_per_batch || AGENT_MAX_PER_PART,
    customInstructions: args.custom_instructions, autopilot: args.autopilot !== false, projectId: args.project_id,
    download: !!args.download, styleLock: args.style_lock || args.genre_or_style || '', partTimeoutSec: args.part_timeout_sec, ...extra
  };
}

async function looksBlocked(errorText, tabId, mark) {
  if (isBlockError(errorText)) return true;
  if (/cancel/i.test(String(errorText || ''))) return false;
  try { const scan = await agent.blockScan(tabId || await client.tab(), mark || { texts: [] }); return !!scan?.blocked; } catch (_) { return false; }
}

// ---- Global watchdog: any standard generation (legacy deepx_*/flow_* tools too) that Google blocks
// is collected and re-sent through Agent Mode automatically.
const pendingFallback = { timer: null, jobs: [] };
function enqueue(req) {
  const job = engineEnqueue(req);
  if (!req.no_agent_fallback && !req.dry_run && !req.action) {
    job.completion.then(async () => {
      if (job.status !== 'failed' || !(await looksBlocked(job.error))) return;
      markBlocked(job.error);
      job.stage = 'blocked by Google Flow; re-sending in Agent Mode';
      pendingFallback.jobs.push(job);
      clearTimeout(pendingFallback.timer);
      pendingFallback.timer = setTimeout(flushFallback, 2500);
    }).catch(() => {});
  }
  return job;
}
function flushFallback() {
  const failed = pendingFallback.jobs.splice(0);
  const groups = new Map();
  for (const j of failed) { const key = `${j.type}|${j.request?.aspect || '16:9'}`; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(j); }
  for (const [key, list] of groups) {
    const [type, aspect] = key.split('|');
    try {
      const aj = agent.runAgentJob({ ...agentOptions({ aspect_ratio: aspect, model: list[0].request?.model, duration: list[0].request?.duration }, type === 'video' ? 'video' : 'image'), items: list.map(j => j.request?.prompt).filter(Boolean), fallbackFrom: list.map(j => j.job_id), kind: 'auto_fallback', note: `Standard mode was blocked by Google Flow (${lastBlock?.text || 'unusual activity'}). Re-sent ${list.length} prompt(s) in Agent Mode.` });
      for (const j of list) { j.fallback = { mode: 'agent', job_id: aj.job_id }; j.stage = `switched to Agent Mode: poll job ${aj.job_id}`; }
    } catch (e) { for (const j of list) j.fallback_error = e.message; }
  }
}

function askMode(args, items, media) {
  const n = items.length || 1;
  return {
    action_required: 'ASK_GENERATION_MODE', generated: false,
    question: 'Generate with Google Flow Agent Mode, or Standard mode (without Agent)?',
    options: [
      { value: 'agent', label: 'Agent Mode', description: `Pastes prompts into Google Flow Agent${n > AGENT_MAX_PER_PART ? `, split into ${Math.ceil(n / AGENT_MAX_PER_PART)} parts of ≤24 sent back-to-back` : ''}. Best for big batches and when Google blocks standard generation.` },
      { value: 'standard', label: 'Standard (without Agent)', description: 'Direct prompt-by-prompt generation with exact model/ratio/count and per-item files. Auto-switches to Agent Mode if Google shows an unusual-activity / extension error.' }
    ],
    detected: { items: n, media_type: media, agent_parts: Math.ceil(n / AGENT_MAX_PER_PART) },
    agent_instruction: 'Ask the user ONLY this question with your multiple-choice question tool, then immediately call deepx_generate again with the same arguments plus generation_mode ("agent" or "standard"). Do not ask anything else.'
  };
}

function snapshotWithChildren(job) {
  const s = snapshot(job);
  if (job.fallback_job_id && jobs.get(job.fallback_job_id)) s.fallback_job = snapshot(jobs.get(job.fallback_job_id));
  return s;
}

function runStandard(args, items, media) {
  const reqs = items.map(p => standardRequest(args, p, media)); // validates before anything is sent
  const parent = {
    job_id: crypto.randomUUID().slice(0, 8), type: 'workflow', kind: 'deepx_standard', mode: 'standard', media_type: media,
    status: 'running', stage: `standard mode: sending ${items.length} prompt(s)`, total: items.length, completed: 0,
    scenes: items.map((p, index) => ({ index, prompt: p.slice(0, 160), status: 'queued' })), child_job_ids: [], media_ids: [], files: [],
    auto_fallback: args.auto_fallback !== false, request: args, abort: new AbortController()
  };
  jobs.set(parent.job_id, parent);
  parent.completion = (async () => {
    const tabId = await client.tab();
    const mark = await agent.blockMark(tabId);
    await client.begin(tabId);
    let blockReason = null;
    const children = [];
    // First block: stop every prompt that has not been sent yet; the switch happens once in-flight ones settle.
    const onBlock = reason => {
      if (blockReason || !parent.auto_fallback) return;
      blockReason = String(reason || 'unusual activity');
      markBlocked(blockReason);
      parent.stage = `Google Flow blocked standard mode (${blockReason.slice(0, 120)}) → switching to Agent Mode`;
      for (const c of children) if (c.status === 'queued') { c.abort.abort(); c.status = 'cancelled'; c.stage = 'cancelled: will be re-sent in Agent Mode'; }
    };
    try {
      reqs.forEach((r, i) => {
        if (parent.abort.signal.aborted) return;
        const c = enqueue(r); children.push(c); parent.child_job_ids.push(c.job_id); parent.scenes[i].job_id = c.job_id;
        c.completion.then(async () => {
          if (c.status === 'done') { parent.completed++; parent.media_ids.push(...(c.media_ids || [])); parent.files.push(...(c.files || [])); parent.scenes[i].media_ids = c.media_ids || []; parent.scenes[i].files = c.files || []; }
          else if (c.status === 'failed') { parent.scenes[i].error = c.error; if (await looksBlocked(c.error, tabId, mark)) onBlock(c.error); }
        }).catch(() => {});
      });
      parent.abort.signal.addEventListener('abort', () => { for (const c of children) if (!['done', 'failed', 'cancelled'].includes(c.status)) { c.abort.abort(); c.status = 'cancelled'; c.stage = 'cancelled'; } }, { once: true });
      await Promise.all(children.map(c => c.completion.catch(() => {})));
      await sleep(300);
      children.forEach((c, i) => { parent.scenes[i].status = c.status; });
      if (!blockReason && children.some(c => c.status === 'failed') && parent.auto_fallback) {
        const scan = await agent.blockScan(tabId, mark);
        if (scan?.blocked) onBlock(scan.texts[0]);
      }
      parent.abort.signal.throwIfAborted();
      const redo = blockReason ? children.map((c, i) => (c.status === 'failed' || c.status === 'cancelled') ? i : -1).filter(i => i >= 0) : [];
      if (redo.length) {
        redo.forEach(i => { parent.scenes[i].status = 'rerouted_to_agent'; });
        const aj = agent.runAgentJob({ ...agentOptions({ ...args, download: true }, media), items: redo.map(i => items[i]), fallbackFrom: [parent.job_id], kind: 'auto_fallback', note: `Google Flow blocked standard mode (${blockReason.slice(0, 160)}). Re-sent ${redo.length} prompt(s) in Agent Mode.` });
        parent.fallback_job_id = aj.job_id; parent.child_job_ids.push(aj.job_id);
        parent.stage = `standard mode blocked → Agent Mode job ${aj.job_id} (${redo.length} prompt(s), ${aj.total_parts} part(s))`;
        await aj.completion;
        redo.forEach((i, k) => { const it = aj.items?.[k]; parent.scenes[i].status = aj.status === 'done' ? (it?.media_ids?.length ? 'done_in_agent_mode' : 'sent_in_agent_mode') : `agent_${aj.status}`; if (it) { parent.scenes[i].media_ids = it.media_ids; parent.scenes[i].files = it.files; } });
        parent.status = aj.status === 'done' ? 'done' : 'failed';
        parent.stage = `${parent.completed}/${items.length} done in standard mode; ${redo.length} re-sent in Agent Mode → ${aj.status}: ${aj.stage}`;
        if (aj.error) parent.error = aj.error;
        parent.media_ids.push(...(aj.media_ids || []));
        parent.files.push(...(aj.files || []));
        return;
      }
      const bad = children.filter(c => c.status === 'failed');
      parent.status = bad.length && !parent.completed ? 'failed' : 'done';
      parent.stage = `standard mode done: ${parent.completed}/${items.length} succeeded${bad.length ? `, ${bad.length} failed` : ''}`;
      if (bad.length) parent.error = bad.map(c => c.error).filter(Boolean).slice(0, 3).join('; ');
    } finally { await client.end(tabId); }
  })().catch(e => { parent.status = parent.abort.signal.aborted ? 'cancelled' : 'failed'; parent.stage = parent.status; parent.error = e.message; });
  return parent;
}

// ---- Google account login check (no generation without a signed-in Flow tab)
let loginOkAt = 0, loginAccount = null;
const isFlowUrl = u => { try { const x = new URL(u); return x.hostname === 'flow.google.com' || (x.hostname.includes('labs.google') && x.pathname.includes('/flow')); } catch { return false; } };
async function loginCheck({ open = true, force = false } = {}) {
  if (!force && Date.now() - loginOkAt < 3 * 60 * 1000) return { logged_in: true, account: loginAccount, cached: true };
  const tabs = await chrome.tabs.query({});
  let tab = tabs.find(t => isFlowUrl(t.url)) || tabs.find(t => /accounts\.google\.com/.test(t.url || '') && /flow|labs\.google/i.test(decodeURIComponent(t.url || '')));
  if (!tab) {
    if (!open) return { logged_in: false, flow_tab_open: false };
    tab = await chrome.tabs.create({ url: 'https://flow.google.com/', active: true });
  }
  const probe = async () => {
    try {
      const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: () => {
        const acc = document.querySelector('[aria-label^="Google Account:"]');
        const signIn = Array.from(document.querySelectorAll('a, button, [role="button"]')).some(e => /^\s*(sign\s*in|log\s*in|get started)\b/i.test(e.innerText || e.textContent || ''));
        const w = window.WIZ_global_data;
        return { url: location.href, accounts: /accounts\.google\.com/.test(location.hostname), account: acc ? acc.getAttribute('aria-label').replace(/^Google Account:\s*/, '') : null, signIn, ready: !!(w && w.SNlM0e), loaded: document.readyState === 'complete' };
      } });
      return r?.result || null;
    } catch (e) { return { error: e.message }; }
  };
  let last = null;
  for (let i = 0; i < 40; i++) {
    last = await probe();
    if (last?.account) break;
    if (last?.accounts || (last?.loaded && last?.signIn && i >= 6)) break;
    if (last?.loaded && last?.ready && !last?.signIn && i >= 10) break;
    await sleep(500);
  }
  const logged = !!last?.account || (!!last?.ready && !last?.signIn && !last?.accounts);
  if (logged) { loginOkAt = Date.now(); loginAccount = last?.account || null; return { logged_in: true, account: loginAccount, url: last?.url }; }
  loginOkAt = 0;
  await chrome.tabs.update(tab.id, { active: true }).catch(() => {});
  return {
    logged_in: false, action_required: 'LOGIN_REQUIRED', generated: false, url: last?.url || null,
    message: 'Google Flow is open in the AntiGem browser, but no Google account is signed in. Please sign in to your Google account in that tab, then say "continue".',
    agent_instruction: 'Tell the user exactly this one message and STOP. Do not generate, do not retry, do not ask anything else. When the user says continue, call the same tool again.'
  };
}

async function deepxGenerate(args) {
  if (!args.dry_run && args.skip_login_check !== true) {
    const login = await loginCheck();
    if (!login.logged_in) return login;
  }
  const { items: collected, analysis } = await collectItems(args);
  let items = collected;
  const text = items.join('\n');
  const media = detectMedia(args, text);
  const mode = normMode(args.generation_mode);
  if (!items.length) throw new Error('Give prompt, prompts[] or script_text.');
  if (!mode) return askMode(args, items, media);

  let bulk = null;
  if (items.length === 1 && args.expand_bulk !== false) bulk = expandBulkRequest(items[0]);
  if (args.range_end) bulk = { type: 'range', start: Number(args.range_start) || 1, end: Number(args.range_end), subject: items[0], total: Number(args.range_end) - (Number(args.range_start) || 1) + 1 };
  else if (args.total_count > 1 && items.length === 1) bulk = { type: 'count', start: 1, end: Number(args.total_count), subject: items[0], total: Number(args.total_count) };

  let useMode = mode, note = null;
  if (mode === 'standard' && recentlyBlocked() && args.auto_fallback !== false) {
    useMode = 'agent';
    note = `Google Flow blocked standard mode ${Math.round((Date.now() - lastBlock.at) / 60000)} min ago (${lastBlock.text.slice(0, 120)}); using Agent Mode directly.`;
  }

  if (useMode === 'agent') {
    if ((bulk?.total || items.length) > 5000) throw new Error('At most 5000 items per Agent Mode job.');
    const job = agent.runAgentJob({ ...agentOptions(args, media), items, bulk, kind: 'deepx_generate', note, keywords: (bulk?.subject || items[0] || '').slice(0, 120) });
    const snap = await awaitJobs([job], args.wait_seconds ?? 8);
    return { mode_used: 'agent', requested_mode: mode, note, analysis_used: !!analysis, ...snap, poll: `deepx_job_status {"job_id":"${job.job_id}"}` };
  }

  if (bulk && bulk.total > 1) items = Array.from({ length: bulk.total }, (_, k) => bulk.type === 'range' ? `${bulk.subject}: number ${bulk.start + k}` : `${bulk.subject} (variation ${k + 1} of ${bulk.total})`);
  if (items.length > 500) throw new Error('Standard mode accepts at most 500 prompts per call. Use generation_mode "agent" for bigger batches.');
  if (args.new_project) {
    const project = await client.exclusive(async () => { const tabId = await client.tab(); const p = await client.createProject(tabId, args.title); await client.page(tabId, p.projectId); return p; });
    args = { ...args, project_id: project.projectId };
  }
  const parent = runStandard(args, items, media);
  const waited = await Promise.race([parent.completion, sleep(Math.max(0, Math.min(45, args.wait_seconds ?? 40)) * 1000)]);
  void waited;
  return { mode_used: 'standard', ...snapshotWithChildren(parent), poll: `deepx_job_status {"job_id":"${parent.job_id}"}` };
}

function agentQueueFromArgs(args, kind) {
  return (async () => {
    const raw = args.prompt_or_storyboard || args.storyboard_text || args.prompt || args.script_text || '';
    const { items } = await collectItems({ ...args, script_text: raw, prompt: undefined });
    const media = detectMedia(args, raw);
    let bulk = null;
    if (args.range_end) bulk = { type: 'range', start: Number(args.range_start) || 1, end: Number(args.range_end), subject: raw, total: Number(args.range_end) - (Number(args.range_start) || 1) + 1 };
    else if (args.total_count > 1 && items.length <= 1) bulk = { type: 'count', start: 1, end: Number(args.total_count), subject: raw, total: Number(args.total_count) };
    else if (items.length === 1) bulk = expandBulkRequest(items[0]);
    if (!items.length && !bulk) throw new Error('storyboard_text / prompt_or_storyboard is required');
    const handles = (args.character_names || []).map(n => '@' + String(n).replace(/^@/, '').trim()).filter(h => h.length > 1);
    const styleLock = [args.style_lock || '', handles.length ? `Use these characters/references in every item: ${handles.join(', ')}` : ''].filter(Boolean).join('. ');
    const job = agent.runAgentJob({ ...agentOptions({ ...args, style_lock: styleLock }, media), items, bulk, kind, keywords: raw.slice(0, 120) });
    return { mode_used: 'agent', ...(await awaitJobs([job], args.wait_seconds ?? 8)), poll: `deepx_job_status {"job_id":"${job.job_id}"}` };
  })();
}

async function deepxStatus() {
  let flow = null, agentState = null;
  const login = await loginCheck({ force: true });
  if (!login.logged_in) return { plugin: PLUGIN_ID, version: PLUGIN_VERSION, ready: false, ...login };
  try { flow = await engineExecute('flow_status', {}); } catch (e) { flow = { error: e.message }; }
  try { agentState = await agent.status(); } catch (e) { agentState = { error: e.message }; }
  const ready = !!flow?.logged_in || login.logged_in;
  return {
    plugin: PLUGIN_ID, version: PLUGIN_VERSION, ready,
    message: ready ? 'Connected! I can generate images and videos on Google Flow now — Agent Mode or Standard mode.' : (flow?.error || 'Google Flow tab is open but not signed in. Sign in to Google once in the AntiGem browser tab, then retry.'),
    account: flow?.account || login.account || null, project_id: flow?.project_id || null, settings: flow?.settings || null,
    agent_mode: agentState, standard_mode_blocked_recently: recentlyBlocked() ? lastBlock : null,
    running_jobs: [...jobs.values()].filter(j => j.status === 'running').length,
    modes: { agent: `Google Flow Agent Mode, ≤${AGENT_MAX_PER_PART} items per part, back-to-back`, standard: 'Direct generation; auto-switches to Agent Mode on unusual-activity/extension blocks' }
  };
}

const KNOWLEDGE_EXTRA = `

## DeepX Google Flow Studio (AntiGem plugin) — modes

| | Agent Mode | Standard mode (without Agent) |
| --- | --- | --- |
| How | Pastes prompts into Google Flow Agent; Agent plans & renders | AntiGem native composer: exact settings, trusted touch, request guard |
| Batch size | Any size: auto-split into parts of ≤${AGENT_MAX_PER_PART}, pasted back-to-back | Up to 500 prompts per call (count 1–4 outputs each) |
| Best for | Big batches, storyboards, when Google blocks standard mode | Exact model/ratio/count control, per-item media IDs & files |
| Block fallback | — | "Unusual activity / extension / captcha" error → automatic switch to Agent Mode |

Always ask the user which mode before a generation (deepx_generate returns ASK_GENERATION_MODE when generation_mode is missing).

Agent image models: ${AGENT_IMAGE_MODELS.join(', ')}. Agent video models: ${AGENT_VIDEO_MODELS.join(', ')}.
Standard image models: ${IMAGE_MODELS.join(', ')}. Standard video models: ${VIDEO_MODELS.join(', ')}.
`;

async function execute(tool, args = {}) {
  switch (tool) {
    case 'deepx_generate': return deepxGenerate(args);
    case 'deepx_status': return deepxStatus();
    case 'deepx_check_login': return loginCheck({ force: true });
    case 'deepx_get_options':
    case 'flow_get_options': return { content: [{ type: 'text', text: getDeepXKnowledgeMarkdown() + KNOWLEDGE_EXTRA }] };
    case 'deepx_job_status': {
      const ids = [...(args.job_ids || []), ...(args.job_id ? [args.job_id] : [])];
      if (!ids.length) throw new Error('job_id or job_ids required');
      const sel = ids.map(id => { const j = jobs.get(id); if (!j) throw new Error('Unknown job_id (jobs reset when the plugin reloads): ' + id); return j; });
      await Promise.race([Promise.all(sel.map(j => j.completion)), sleep(Math.max(0, Math.min(50, args.wait_seconds ?? 30)) * 1000)]);
      const out = sel.map(snapshotWithChildren);
      return out.length === 1 ? out[0] : out;
    }
    case 'deepx_cancel_job': case 'deepx_cancel': {
      const id = args.job_id || args.batch_id;
      const res = await engineExecute('flow_cancel', id ? { job_id: id } : {});
      for (const j of jobs.values()) if (j.mode === 'agent' && j.status === 'running' && (!id || j.job_id === id || j.fallback_from?.includes(id))) { j.abort.abort(); j.status = 'cancelled'; j.stage = 'cancelled'; res.cancelled = (res.cancelled || 0) + 1; }
      return res;
    }
    case 'flow_agent_status': case 'deepx_flow_agent_status': return agent.status();
    case 'flow_agent_toggle': case 'deepx_flow_agent_toggle': return agent.toggle(args.active ?? args.enable);
    case 'flow_agent_configure': case 'deepx_flow_agent_configure': {
      const media = args.media_type === 'image' ? 'image' : 'video';
      return agent.configure({ autopilot: args.autopilot !== false, aspectRatio: args.aspect_ratio, quality: args.quality, agentVideoModel: media === 'video' || args.video_model ? agentVideoModel(args.video_model) : null, agentImageModel: media === 'image' || args.image_model ? agentImageModel(args.image_model) : null });
    }
    case 'flow_agent_set_instructions': case 'deepx_flow_agent_set_instructions': return agent.setInstructions(args.instructions_text || args.text, args.title);
    case 'flow_agent_approve_all': case 'deepx_flow_agent_approve_all': return agent.approveAll(args.keywords);
    case 'flow_agent_dispatch': case 'deepx_flow_agent_dispatch': return agentQueueFromArgs(args, 'agent_dispatch');
    case 'flow_agent_batch_queue': case 'deepx_flow_agent_batch_queue': return agentQueueFromArgs(args, 'agent_batch_queue');
    case 'deepx_upscale_media': {
      let id = args.media_id, type = args.type;
      if (!id) { const last = await engineExecute('flow_get_last_media', { count: 1, type: args.type }); const m = last?.[0]; id = m?.media_id || m?.mediaId; type = type || m?.type; }
      if (!id) throw new Error('No media found to upscale; pass media_id.');
      if (!type) { try { const tabId = await client.tab(); type = (await client.media(tabId, id))?.type; } catch (_) {} }
      const video = type === 'video';
      const q = String(args.quality || (video ? '1080p' : '2K'));
      return engineExecute(video ? 'flow_upscale_video' : 'flow_upscale_image', { media_id: id, resolution: video ? (/4k/i.test(q) ? '4K' : '1080p') : (/4k/i.test(q) ? '4K' : '2K'), wait_seconds: args.wait_seconds });
    }
    case 'deepx_extract_last_frame': return engineExecute('flow_extract_frame', { media_id: args.media_id, upload: args.upload !== false, project_id: args.project_id });
    case 'deepx_set_zoom': { const tabId = await client.tab(); await chrome.tabs.setZoom(tabId, Number(args.zoom_factor) || 0.8); return { success: true, zoom: await chrome.tabs.getZoom(tabId) }; }
    case 'deepx_get_zoom': { const tabId = await client.tab(); return { zoom: await chrome.tabs.getZoom(tabId) }; }
    case 'deepx_reload_tab': { const tabId = await client.tab(); await chrome.tabs.reload(tabId); client.readyTab = null; return { reloaded: true, tabId }; }
    case 'deepx_doctor': {
      const out = { plugin: PLUGIN_ID, version: PLUGIN_VERSION, apis: { antigem: !!chrome.antigem, automation: !!chrome.antigem?.automation, scripting: !!chrome.scripting, debugger: !!chrome.debugger } };
      try { const tabId = await client.tab(); out.tab_id = tabId; out.ui = await client.js(tabId, 's.ui()'); out.agent = await agent.page(tabId, 'status'); out.block_notices = (await agent.blockScan(tabId, { texts: [] }))?.all || []; } catch (e) { out.error = e.message; }
      out.standard_mode_blocked_recently = recentlyBlocked() ? lastBlock : null;
      out.jobs = { total: jobs.size, running: [...jobs.values()].filter(j => j.status === 'running').map(j => ({ job_id: j.job_id, kind: j.kind || j.type, stage: j.stage })) };
      return out;
    }
    case 'deepx_get_master_instructions': return { title: 'DeepX Master Autopilot Director', instructions: DEFAULT_MASTER_AGENT_INSTRUCTIONS };
    case 'deepx_detect_entities': return detectProtagonistEntities(args.raw_input || args.script_text || '', args.protagonist_override || null);
    default: return engineExecute(tool, args);
  }
}

export { execute as deepxExecute, deepxGenerate, loginCheck, client, jobs, agent, awaitJobs, snapshot, snapshotWithChildren, sleep };

/** Standard MCP listener helper used by plugin workers. */
export function mcpListener(handler) {
  return (message, sender, sendResponse) => {
    if (!message || message.type !== 'mcp_tool_call') return;
    handler(message.tool, message.args || {}).then(sendResponse, error => sendResponse({
      isError: true,
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message, agent_instruction: 'Report this error to the user in one sentence. Do not read plugin source files. If it mentions sign-in, ask the user to sign in to Google Flow once in the AntiGem browser tab.' }) }]
    }));
    return true;
  };
}
