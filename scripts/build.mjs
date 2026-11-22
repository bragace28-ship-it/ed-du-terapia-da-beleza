import {rm,mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const dist=resolve(root,'dist');
const masterSource=resolve(root,'master','index.html');
const lock=JSON.parse(await readFile(resolve(root,'MASTER_APPROVED_LOCK.json'),'utf8'));
const html=await readFile(masterSource,'utf8');
const sourceBytes=Buffer.from(html,'utf8');
const sourceBlob=createHash('sha1').update(Buffer.from('blob '+sourceBytes.length+'\0','utf8')).update(sourceBytes).digest('hex');
if(sourceBlob!==lock.master_index_git_blob_sha) throw new Error('MASTER APPROVED LOCK FAILED: master/index.html changed from the approved artifact.');
if(!html.includes('ED & DU')||!html.includes('Terapia da Beleza')) throw new Error('Required ED & DU branding missing.');
const stripEmbeddedDataImages=s=>s.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/gi,'');
const legacyFree=stripEmbeddedDataImages(html);
if(/(?:V33|v33|fin33|eddu_v33)/i.test(legacyFree)) throw new Error('Legacy version reference found in Master source.');
if(/@supabase|VITE_SUPABASE|supabase\.co/i.test(legacyFree)) throw new Error('Legacy Supabase reference found in Master UI.');

const validationFiles=[
  'master/runtime-navigation-hardening.js',
  'master/runtime-real-checkout.js',
  'master/neon-live-bridge.js',
  'master/runtime-neon-persistence.js',
  'functions/api/payments.js',
  'function¶»§q«^u¹Ìémt±±½Ìémt±‰±½­Ìémt±…½Õ¹ÑÌémt±ÅÕ½Ñ•Ìémt±¹½Ñ¥™¥…Ñ¥½¹Ìémt±ÕÍ•ÉÌémt±É•™•ÉÉ…±Ìémt±¥™Ñ…É‘Ìémt±Í•ÉÙ¥•Ìémuô¤ìœì)¥˜¡½ÕÑÁÕĞ¹ÍÁ±¥Ğ¡±½…±…Ñ…5…É­•È¤¹±•¹Ñ „ôôÈ¤Ñ¡É½Ü¹•ÜÉÉ½È áÁ•Ñ••á…Ñ±ä½¹”5…ÍÑ•È±½…°‘…Ñ„‰½½ÑÍÑÉ…À¸œ¤ì)½ÕÑÁÕĞõ½ÕÑÁÕĞ¹É•Á±…”¡±½…±…Ñ…5…É­•È°‰±•ĞÑ•ÍÑMÑ…Ñ”õ±½…¡-d±íô¤°‘…Ñ„ô¡İ¥¹‘½Ü¹}}U}5MQI}1=1}Qõİ¥¹‘½Ü¹‘…Ñ„õíÁ…åµ•¹ÑÌémt±½µµ…¹‘Ìémt±É••¥Ù…‰±•Ìémt±Á…å…‰±•Ìémt±½µµ¥ÍÍ¥½¹Ìémt±±½Ìémt±‰±½­Ìémt±…½Õ¹ÑÌémt±ÅÕ½Ñ•Ìémt±¹½Ñ¥™¥…Ñ¥½¹Ìémt±ÕÍ•ÉÌémt±É•™•ÉÉ…±Ìémt±¥™Ñ…É‘Ìémt±Í•ÉÙ¥•Ìémt±…ÁÁ½¥¹Ñµ•¹ÑÌémt±±¥•¹ÑÌémt±ÁÉ½™•ÍÍ¥½¹…±Ìémt±ÁÉ½‘ÕÑÌémt±™¥¹…¹¥…±QÉ…¹Í…Ñ¥½¹Ìémuô¤ìˆ¤ì)½¹ÍĞ‘•µ½ÁÁ½¥¹Ñµ•¹ÑM••ô½¥˜p …‘…Ñ…p¹…ÁÁ½¥¹Ñµ•¹ÑÍp¹±•¹Ñ¡p¤qíqÌ©½¹ÍĞÑ½‘…ä€ô¹•Ü…Ñ•p¡p¤íqÌ©½¹ÍĞ‘¬€ôÑ½‘…åp¹Ñ½%M=MÑÉ¥¹p¡p¥p¹Í±¥•p À°ÄÁp¤íqÌ©‘…Ñ…p¹…ÁÁ½¥¹Ñµ•¹ÑÍp¹ÁÕÍ¡p¡mqÍqMt¨ıp¤íqÌ©Á•ÉÍ¥ÍÑp¡p¤íqÌ©qô¼ì)¥˜ …‘•µ½ÁÁ½¥¹Ñµ•¹ÑM••¹Ñ•ÍĞ¡½ÕÑÁÕĞ¤¤Ñ¡É½Ü¹•ÜÉÉ½È 5…ÍÑ•È‘•µ¼…ÁÁ½¥¹Ñµ•¹ĞÍ••¹½Ğ™½Õ¹ìÉ•™ÕÍ¥¹œ±½…°™¥áÑÕÉ”ÁÉ½‘ÕÑ¥½¸¸œ¤ì)½ÕÑÁÕĞõ½ÕÑÁÕĞ¹É•Á±…”¡‘•µ½ÁÁ½¥¹Ñµ•¹ÑM••°œœ¤ì)¥˜¡½ÕÑÁÕĞ¹¥¹±Õ‘•Ì APµ5<´Äœ¥ññ½ÕÑÁÕĞ¹¥¹±Õ‘•Ì APµ5<´Èœ¤¤Ñ¡É½Ü¹•ÜÉÉ½È •µ¼…ÁÁ½¥¹Ñµ•¹ÑÌÉ•µ…¥¸¥¸ÁÉ½‘ÕÑ¥½¸…ÉÑ¥™…Ğ¸œ¤ì)½¹ÍĞ¥¹©•Ñ	•™½É•±½Í¥¹	½‘äô¡‘½Õµ•¹Ğ±µ…É­ÕÀ¤ôùì(€½¹ÍĞ¥¹‘•àõ‘½Õµ•¹Ğ¹Ñ½1½İ•É…Í” ¤¹±…ÍÑ%¹‘•á=˜ œğ½‰½‘äøœ¤ì(€¥˜¡¥¹‘•àğÀ¤Ñ¡É½Ü¹•ÜÉÉ½È 5MQH‰Õ¥±¡…Ì¹¼±½Í¥¹œ‰½‘äÑ…œ¸œ¤ì(€É•ÑÕÉ¸‘½Õµ•¹Ğ¹Í±¥” À±¥¹‘•à¤­µ…É­ÕÀ­‘½Õµ•¹Ğ¹Í±¥”¡¥¹‘•à¤ì)ôì)½¹ÍĞÉÕ¹Ñ¥µ•¥±•Ìõl(€€µ…ÍÑ•È½¹•½¸µ±¥Ù”µ‰É¥‘”¹©Ìœ°(€€µ…ÍÑ•È½ÉÕ¹Ñ¥µ”µ¹•½¸µÁ•ÉÍ¥ÍÑ•¹”¹©Ìœ°(€€µ…ÍÑ•È½ÉÕ¹Ñ¥µ”µÉ•…°µ¡•­¾ÚîÆ­yÖ–ÇB–æÆ–æR67&—B7–çFƒ¢52‚r¶6†V6¶VE67&—G2²r’r“°¦6öç7B'V–ÇD'—FW3Ô'VffW"æg&öÒ†'V–ÇBÂwWFc‚r“°¦6öç7B'V–ÇE6†Ö7&VFT†6‚‚w6†#Sbr’çWFFR†'V–ÇD'—FW2’æF–vW7B‚v†W‚r“°¦–b†'V–ÇD'—FW2æÆVæwFƒÃ3’F‡&÷ræWrW'&÷"‚tÔ5DU"'V–ÆB÷WGWB—2VæW‡V7FVFÇ’6ÖÆÂâr“°¦v—Bw&—FTf–ÆR‡&W6öÇfR†F—7BÂu÷&VF—&V7G2r’Ârò¢ö–æFW‚æ‡FÖÂ#Æâr“°¦v—Bw&—FTf–ÆR‡&W6öÇfR†F—7BÂu÷&÷WFW2æ§6öâr’Ä¥4ôâç7G&–æv–g’‡·fW'6–öã£Æ–æ6ÇVFS¥²rö’ò¢uÒÆW†6ÇVFS¥µ×Ò’“°¦v—Bw&—FTf–ÆR‡&W6öÇfR†F—7BÂwfW'6–öâæ§6öâr’Ä¥4ôâç7G&–æv–g’‡°¢fW'6–öã¦Æö6²æ6æöæ–6Å÷&VÆV6RÀ¢æÖS¢tTBbERÂFW&–F&VÆW¦rÀ¢'VçF–ÖTWF†÷&—G“¢tÔ5DU%ôôäÅ’rÀ¢'F–f7C¢tÔ5DU"rÀ¢6÷W&6Tv—D&Æö%6†§6÷W&6T&Æö"À¢'V–ÇE6†#Sc¦'V–ÇE6†À¢ÆVv7•'VçF–ÖS¢tD•4$ÄTBp§ÒÆçVÆÂÃ"’“°¦6öç7BF—7Df–ÆW3Öv—B&VFF—"†F—7B“°¦6öç7BÆÆ÷vVCÖæWr6WB…²v–æFW‚æ‡FÖÂrÂu÷&VF—&V7G2rÂu÷&÷WFW2æ§6öârÂwfW'6–öâæ§6öâuÒ“°¦–b†F—7Df–ÆW2æÆVæwF‚ÓÓGÇÆF—7Df–ÆW2ç6öÖR‡ƒÓâÆÆ÷vVBæ†2‡‚’’’F‡&÷ræWrW'&÷"‚uVæW‡V7FVBF—7Bf–ÆW3¢r¶F—7Df–ÆW2æ¦ö–â‚rÂr’“°¦6öç6öÆRæÆör‚t'V–ÇB6æöæ–6ÂÖ7FW"öæÇ’âr“°