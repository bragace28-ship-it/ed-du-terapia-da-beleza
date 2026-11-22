/* ED & DU â€” Neon write-through persistence. Neon PostgreSQL is the only source of truth. */
(function () {
  'use strict';
  const TABLES = {
    clients:'clients', professionals:'professionals', services:'services', products:'products',
    appointments:'appointments', commands:'commands', command_items:'command_items',
    financialTransactions:'financial_transactions', blocks:'agenda_blocks', payments:'payments',
    payables:'payables', receivables:'receivables', commissions:'commissions', coupons:'coupons',
    giftCards:'gift_cards', referrals:'referrals', cardInvoices:'card_invoices',
    receivableInstallments:'receivable_installments', notifications:'notifications', quotes:'quotes',
    loyaltyAccounts:'loyalty_accounts', loyaltyTransactions:'loyalty_transactions',
    creditAccounts:'credit_accounts', creditAlerts:'credit_alerts', recurringPayments:'recurring_payments',
    ocrDocuments:'ocr_documents', beforeAfterGallery:'before_after_gallery',
    openFinanceConnections:'open_finance_connections', accountActions:'account_actions',
    anamneses:'anamneses', terms:'terms'
  };
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let running = Promise.resolve();
  const notify = message => {
    window.dispatchEvent(new CustomEvent('eddu-neon-persistence-error', { detail:{ message } }));
    try { if (typeof window.toast === 'function') window.toast('Neon: ' + message); } catch (_) {}
  };
  const iso = (date, time) => {
¶»§q«^u½™•ÍÍ¥½¹…±}¥€ôÉ½Ü¹ÁÉ½™•ÍÍ¥½¹…±}¥ñğÉ½Ü¹ÁÉ½™•ÍÍ¥½¹…±%ì(€€€€€É½Ü¹ÍÑ…ÉÑÍ}…Ğ€ôÉ½Ü¹ÍÑ…ÉÑÍ}…ĞñğÉ½Ü¹ÍÑ…ÉÑÍĞñğ¥Í¼¡É½Ü¹‘…Ñ”°É½Ü¹ÍÑ…ÉĞ¤ì(€€€€€É½Ü¹•¹‘Í}…Ğ€ôÉ½Ü¹•¹‘Í}…ĞñğÉ½Ü¹•¹‘ÍĞñğ¥Í¼¡É½Ü¹‘…Ñ”°É½Ü¹•¹¤ì(€€€ô•±Í”¥˜€¡•¹Ñ¥Ñä€ôôô€…•¹‘…}‰±½­Ìœ¤ì(€€€€€É½Ü¹ÁÉ½™•ÍÍ¥½¹…±}¥€ôÉ½Ü¹ÁÉ½™•ÍÍ¥½¹…±}¥ñğÉ½Ü¹ÁÉ½™•ÍÍ¥½¹…±%ì(€€€€€É½Ü¹ÍÑ…ÉÑÍ}…Ğ€ôÉ½Ü¹ÍÑ…ÉÑÍ}…ĞñğÉ½Ü¹ÍÑ…ÉÑÍĞñğ¥Í¼¡É½Ü¹‘…Ñ”°É½Ü¹ÍÑ…ÉĞ¤ì(€€€€€É½Ü¹•¹‘Í}…Ğ€ôÉ½Ü¹•¹‘Í}…ĞñğÉ½Ü¹•¹‘ÍĞñğ¥Í¼¡É½Ü¹‘…Ñ”°É½Ü¹•¹ñğ€œÈÌèÔäœ¤ì(€€€ô•±Í”¥˜€¡•¹Ñ¥Ñä€ôôô€½µµ…¹‘Ìœ¤ì(€€€€€É½Ü¹±¥•¹Ñ}¥€ôÉ½Ü¹±¥•¹Ñ}¥ñğÉ½Ü¹±¥•¹Ñ%ì(€€€€€É½Ü¹ÁÉ½™•ÍÍ¥½¹…±}¥€ôÉ½Ü¹ÁÉ½™•ÍÍ¥½¹…±}¥ñğÉ½Ü¹ÁÉ½™•ÍÍ¥½¹…±%ì(€€€€€É½Ü¹…ÁÁ½¥¹Ñµ•¹Ñ}¥€ôÉ½Ü¹…ÁÁ½¥¹Ñµ•¹Ñ}¥ñğÉ½Ü¹…ÁÁ½¥¹Ñµ•¹Ñ%ì(€€€ô•±Í”¥˜€¡•¹Ñ¥Ñä€ôôô€½µµ…¹‘}¥Ñ•µÌœ¤ì(€€€€€É½Ü¹½µµ…¹‘}¥€ôÉ½Ü¹½µµ…¹‘}¥ñğÉ½Ü¹½µµ…¹‘%ì(€€€€€É½Ü¹Í•ÉÙ¥•}¥€ôÉ½Ü¹Í•ÉÙ¥•}¥ñğÉ½Ü¹Í•ÉÙ¥•%ì(€€€€€É½Ü¹ÁÉ½‘ÕÑ}¥€ôÉ½Ü¹ÁÉ½‘ÕÑ}¥ñğÉ½Ü¹ÁÉ½‘ÕÑ%ì(€€€€€É½Ü¹ÁÉ½™•ÍÍ¥½¹…±}¥€ôÉ½Ü¹ÁÉ½™•ÍÍ¥½¹…±}¥ñğÉ½Ü¹ÁÉ½™•ÍÍ¥½¹…±%ì(€€€€€É½Ü¹Õ¹¥Ñ}ÁÉ¥”€ôÉ½Ü¹Õ¹¥Ñ}ÁÉ¥”€üüÉ½Ü¹ÁÉ¥”ì(€€€ô•±Í”¥˜€¡•¹Ñ¥Ñä€ôôô€™¥¹…¹¥…±}ÑÉ…¹Í…Ñ¥½¹Ìœ¤ì(€€€€€É½Ü¹±¥•¹Ñ}¥€ôÉ½Ü¹±¥•¹Ñ}¥ñğÉ½Ü¹±¥•¹Ñ%ì(€€€€€É½Ü¹½µµ…¹‘}¥€ôÉ½Ü¹½µµ…¹‘}¥ñğÉ½Ü¹½µµ…¹‘%ì(€€€€€É½Ü¹‘¥É•Ñ¥½¸€ôÉ½Ü¹‘¥É•Ñ¥½¸ñğ€¡É½Ü¹ÑåÁ”€ôôô€•áÁ•¹Í”œ€ü€½ÕĞœ€èÉ½Ü¹ÑåÁ”€ôôô€¥¹½µ”œ€ü€¥¸œ€èÕ¹‘•™¥¹•¤ì(€€€€€É½Ü¹‘•ÍÉ¥ÁÑ¥½¸€ôÉ½Ü¹‘•ÍÉ¥ÁÑ¥½¸ñğÉ½Ü¹¹…µ”ì(€€€ô•±Í”¥˜€¡•¹Ñ¥Ñä€ôôô€Á…åµ•¹ÑÌœñğ•¹Ñ¥Ñä€ôôô€Á…å…‰±•Ìœñğ•¹Ñ¥Ñä€ôôô€É••¥Ù…‰±•Ìœ¤ì(€€€€€É½Ü¹±¦ÚîÆ­yÒv–æ7F—fRuÒæ–æ6ÇVFW2…7G&–ær‡&÷rç7FGW2ÇÂrr’çFôÆ÷vW$66R‚’“°¢&÷ræÖWFFFÒ&÷ræÖWFFFÇÂ²6Æ–VçC§&÷ræ6Æ–VçBÇÂçVÆÂÂ6÷W&6S§&÷rç6÷W&6RÇÂvÆVv7’×V’rÓ°¢ÒVÇ6R–b†VçF—G’ÓÓÒv6&Eö–çfö–6W2r’°¢&÷ræ6&EöæÖRÒ&÷ræ6&EöæÖRÇÂ&÷rææÖRÇÂtfGW&&V6V&–Fs°¢&÷ræÖWFFFÒ&÷ræÖWFFFÇÂ²f–ÆVæÖS§&÷rææÖRÇÂçVÆÂÂÖ–ÖS§&÷ræÖ–ÖRÇÂçVÆÂÂ6—¦S§&÷rç6—¦RÇÂçVÆÂÂ7FGW3§&÷rç7FGW2ÇÂçVÆÂÓ°¢ÒVÇ6R–b†VçF—G’ÓÓÒwFW&×2r’°¢&÷ræ6Æ–VçEö–BÒ&÷ræ6Æ–VçEö–BÇÂ&÷ræ6Æ–VçD–C°¢&÷rç6–væVEöBÒ&÷rç6–væVEöBÇÂ&÷rç6–væVDC°¢&÷rç–ÆöBÒ&÷rç–ÆöBÇÂ²7FGW3§&÷rç7FGW2ÇÂçVÆÂÓ°¢ÒVÇ6R–b†VçF—G’ÓÓÒv&Vf÷&UögFW%övÆÆW'’r’°¢&÷ræ6Æ–VçEö–BÒ&÷ræ6Æ–VçEö–BÇÂ&÷ræ6Æ–VçD–BÇÂFF6Æ–VçD–B‡&÷ræ6Æ–VçB“°¢&÷ræ&Vf÷&U÷&VbÒ&÷ræ&Vf÷&U÷&VbÇÂ&÷ræ&Vf÷&U&VbÇÂ&÷ræ&Vf÷&RÇÂçVÆÃ°¢&÷rægFW%÷&VbÒ&÷rægFW%÷&VbÇÂ&÷rægFW%&VbÇÂ&÷rægFW"ÇÂçVÆÃ°¢&÷ræ6öÆÆvU÷&VbÒ&÷ræ6öÆÆvU÷&VbÇÂ&÷ræ6öÆÆvU&VbÇÂ&÷ræ6öÆÆvRÇÂçVÆÃ°¢Ğ¢&WGW&â&÷s°¢Ğ¢ÆWBW'6—7FVD–G2ÒçVÆÃ°¢gVæ7F–öâ6GW&UW'6—7FVD–G2‚’°¢6öç7BFFÒv–æF÷ræFFbbG—Vöbv–æF÷ræFFÓÓÒvö&¦V7Bròv–æF÷ræFF¢·Ó°¢W'6—7FVD–G2Ò·Ó°¢f÷"†6öç7B¶¶W’ÂVçF—G•Òöbö&¦V7BæVçG&–W2…D$ÄU2’’W'6—7FVD–G5¶VçF—G•ÒÒæWr6WB‚„'&’æ—4'&’†FF¶¶W•Ò’òFF¶¶W•Ò¢µÒ’æÖ‡&÷rÓâ7G&–ær‡&÷sòæ–BÇÂrr’’æf–ÇFW"†–BÓâUT”BçFW7B†–B’’“°¢Ğ¢v–æF÷ræFDWfVçDÆ—7FVæW"‚vVFGRÖæVöâ×7–æ2Ö6ö×ÆWFRrÂWfVçBÓâ²–b†WfVçBæFWF–Ãòæ6öææV7FVB’6GW&UW'6—7FVD›kºwµçKÛİ\˜ÙKšY^[ØY
Bˆˆ]ØZ]Ú[™İË‘QWÓ‘SÓ—ĞTKš[œÙ\
[]K^[ØY
NÂˆYˆ
\Ø]™YËšY
H›İÈ™]È\œ›ÜŠ	Ó‘SÓ—ÕÔ’UWÑQÓ“ÕÔ‘UT“—ÒQ‰È
È[]JNÂˆÛİ\˜ÙKšYHØ]™YšYÂˆ™\Üœ\Ú
È[]KYœØ]™YšYÜ\˜][Û‰İ\Ù\	ÈJNÂˆBˆ\œÚ\İYYÖÙ[]WHH™]ÈÙ]
›İÜË›X\
›İÈOˆİš[™Ê›İÏËšY	ÉÊJK™š[\ŠYOˆURQ\İ
Y
JJNÂˆBˆÚ[™İË—×ÑQWÓ‘SÓ—ÓTÕÔT”ÒTÕHÈ]›™]È]J
KÒTÓÔİš[™Ê
KÜš]\Îœ™\Ü›[™İ›İÜÎœ™\ÜNÂˆÚ[™İË™\Ü]Ú]™[
™]Èİ\İÛQ]™[
	ÙYK[™[Û‹\\œÚ\İXÛÛ\]IËÈ]Z[Ú[™İË—×ÑQWÓ‘SÓ—ÓTÕÔT”ÒTÕJJNÂˆ™]\›ˆÚ[™İË—×ÑQWÓ‘SÓ—ÓTÕÔT”ÒTÕÂˆBˆ[˜İ[Ûˆ\œÚ\İ

HÂˆ[›š[™ÈH[›š[™Ë[Š\œÚ\İÛ˜\Úİ
K˜Ø]Ú
\œ›ÜˆOˆÂˆ›İYJİš[™Ê\œ›ÜË›Y\ÜØYÙH\œ›ÜŠJNÂˆ›İÈ\œ›ÜÂˆJNÂˆ™]\›ˆ[›š[™ÎÂˆBˆÚ[™İË‘QWÓ‘SÓ—ÔT”ÒTÕÔÓTÒÕH\œÚ\İÛ˜\ÚİÂˆÚ[™İËœ\œÚ\İH\œÚ\İÂ‚ˆÛÛœİ˜]]™TÙ]][HHİÜ˜YÙKœ›İİ\KœÙ]][NÂˆÛÛœİ˜]]™QÙ]][HHİÜ˜YÙKœ›İİ\K™Ù]][NÂˆÛÛœİ˜]]™T™[[İ™R][HHİÜ˜YÙKœ›İİ\Kœ™[[İ™R][NÂˆÛÛœİİX\™YÙ^\ÈH™]ÈÙ]
Âˆ	ÙYWÙ]IË	ÙYWÙš[˜[˜ÙIË	ÙYWÜİ]IË	ÙYWÛX\İ\—Ù]WİŒIË	ÙYWÛX\İ\‘š[˜[˜ÙIËˆ	ÙYWİ—ÛX[X[ØÛİ\ÛœÉË	ÙYWÛX\İ\—ØÛİ\Ûœ×İ‰Ëˆ	ÙYWİ—ØØ\™Ú[›ÚXÙ\ÉË	ÙYWÛX\İ\—ØØ\™Ú[›ÚXÙ\×İ‰Ëˆ	ÙYWÛ\İØ[˜[[™\Ú\ÉË	ÙYWØ™Y›Ü™WØY\—ÙØ[\IË	ÙYWØØ][ÙÛ×ÜÙ\šXÛÜ×İŒM‰ÂˆJNÂˆİÜ˜YÙKœ›İİ\K™Ù]][HH[˜İ[Ûˆ
Ù^JHÂˆYˆ
İš[™ÊÙ^JHOOH	ÙYWÛX\İ\‘š[˜[˜ÙIí®éÜj×catch (_) { throw new Error('NEON_ONLY_INVALID_JSON:' + key); }
      if (!window.data || typeof window.data !== 'object') window.data = {};
      if (key === 'eddu_data') Object.assign(window.data, parsed);
      if (key === 'eddu_master_data_v1') {
        for (const field of Object.keys(window.data)) delete window.data[field];
        Object.assign(window.data, parsed);
      }
      if (key === 'eddu_masterFinance') {
        if (Array.isArray(parsed.payables)) window.data.payables = parsed.payables;
        if (Array.isArray(parsed.receivables)) window.data.receivables = parsed.receivables;
        if (Array.isArray(parsed.commissions)) window.data.commissions = parsed.commissions;
      }
      if (key === 'eddu_finance') {
        if (Array.isArray(parsed.payables)) window.data.payables = parsed.payables;
        if (Array.isArray(parsed.receivables)) window.data.receivables = parsed.receivables;
      }
      if (key === 'eddu_state') {
        if (Array.isArray(parsed.coupons)) window.data.coupons = parsed.coupons;
        if (Array.isArray(parsed.terms)) window.data.terms = parsed.terms;
      }
      if (key.includes('coupons')) window.data.coupons = Array.isArray(parsed) ? parsed : [];
      if (key.includes('card_invoices')) window.data.cardInvoices = Array.isArray(parsed) ? parsed : [];
      if (key === 'eddu_last_anamnesis') {
        const current = Array.isArray(window.data.anamneses) ? window.data.anamneses : [];
        window.data.anamneses = [parsed, ...¶»§q«^