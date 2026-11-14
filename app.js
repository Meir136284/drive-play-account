/* Drive Play – accounts, profiles and personal storage.
   This page runs as a small frame inside every page of the site. It keeps the
   sign-in and each profile's data (lists, settings, history, CineAI memory)
   and hands them to the page that embedded it. Passwords are handled by
   Google Firebase Authentication and never leave this frame. */
'use strict';
(() => {
const CFG = { key: 'AIzaSyAJijGrpQ6rIjhtjkHmMrUKxVfoh6o7v2w', project: 'bustling-walker-439912-m7' };
const SITE = 'https://sites.google.com/view/drive-play-tv/';
const PRIVACY_URL = SITE + '%D7%AA%D7%A0%D7%90%D7%99-%D7%A9%D7%99%D7%9E%D7%95%D7%A9-%D7%95%D7%9E%D7%93%D7%99%D7%A0%D7%99%D7%95%D7%AA-%D7%A4%D7%A8%D7%98%D7%99%D7%95%D7%AA-drive-play';
const PCOLS = ['#2F7BFF', '#EE2B23', '#3DDC6B', '#FFB020', '#B04BFF', '#22B5FF', '#FF5C8A', '#8BC34A'];
const MAX_PROFILES = 6, MAX_ACCTS = 5;
const PROD_ORIGIN = /^https:\/\/[0-9a-z-]+-atari-embeds\.googleusercontent\.com$/;
const DEV = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const KEY_OK = /^(dp_|cineai_)[A-Za-z0-9_@.-]{1,60}$|^theme$/;
const MAX_VAL = 300000;
/* Everyone signs in: no guest mode. Set to false to bring back "continue without an account". */
const REQUIRE_ACCOUNT = true;
/* Sign-in with Google / Facebook / Apple goes through Google's Firebase SDK, loaded only on the sign-in screens. */
const FB_VER = '10.12.2';
const AUTH_DOMAIN = CFG.project + '.firebaseapp.com';
const SOCIAL = ['google', 'apple', 'facebook'];
/* Drive Play Pro. PAY_API is the address of the payments web app (server/Code.gs) once it is deployed. */
const PAY_API = 'https://script.google.com/macros/s/AKfycbz2NNQCeAG4gL6UERqDdiFD0Y7OxfrsnpTWuBeHNoaf6FH6ULprv84bN_VLYJPG-mRY/exec';
/* Pro gating is off until payments are connected (PAY_API). Set to true to lock Pro pages. */
const PRO_ENABLED = false;
const PRO_PRICE = { m: '₪14.90', y: '₪119' };
/* Pages that need Pro. A page can also ask for it by sending pro:1 in its init message.
   Only CineAI. The library, free watching, the TV channels and the YouTube playlists stay free for everyone
   (YouTube does not allow charging to watch its embedded player). Selling CineAI needs a commercial licence from TMDB. */
const PRO_PAGES = /cine/i;

/* ---------- tiny helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => Date.now();
const rid = (n = 12) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => (b % 36).toString(36)).join('');
const day = (t = now()) => { const d = new Date(t); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };
const still = () => document.documentElement.classList.contains('still') || matchMedia('(prefers-reduced-motion: reduce)').matches;
const P = (d) => ({
  user: 'M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.4 0-9 2.2-9 5v2h18v-2c0-2.8-4.6-5-9-5z',
  close: 'M18.3 5.7L12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7l-1.4-1.4L9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z',
  back: 'M14 7l-5 5 5 5V7z',
  eye: 'M12 5c-5 0-9.3 3.1-11 7 1.7 3.9 6 7 11 7s9.3-3.1 11-7c-1.7-3.9-6-7-11-7zm0 11.5a4.5 4.5 0 110-9 4.5 4.5 0 010 9zm0-7a2.5 2.5 0 100 5 2.5 2.5 0 000-5z',
  eyeoff: 'M2 4.3L3.3 3 21 20.7 19.7 22l-3.3-3.3c-1.4.5-2.9.8-4.4.8-5 0-9.3-3.1-11-7 .8-1.9 2.2-3.6 3.9-4.9L2 4.3zM12 6.5c5 0 9.3 3.1 11 7-.6 1.4-1.5 2.7-2.6 3.8l-3-3c.1-.4.1-.7.1-1.1A4.5 4.5 0 0013 8.7l-2.1-2.1c.4-.1.7-.1 1.1-.1z',
  lock: 'M12 2a5 5 0 00-5 5v3H5v12h14V10h-2V7a5 5 0 00-5-5zm-3 8V7a3 3 0 016 0v3H9z',
  people: 'M16 11a4 4 0 10-4-4 4 4 0 004 4zM8 11a3 3 0 10-3-3 3 3 0 003 3zm8 2c-2.7 0-8 1.3-8 4v3h16v-3c0-2.7-5.3-4-8-4zM8 13c-.3 0-.7 0-1.1.1C4.4 13.4 0 14.6 0 17v3h6v-3c0-1.6.8-2.9 2-3.9V13z',
  chart: 'M4 20h16v2H2V2h2v18zm3-3h3V9H7v8zm5 0h3V5h-3v12zm5 0h3v-6h-3v6z',
  device: 'M4 5h16v10H4V5zm-2-2v14h8v2H7v2h10v-2h-3v-2h8V3H2z',
  shield: 'M12 1L3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5l-9-4zm-1.2 15.2l-3.9-3.9 1.4-1.4 2.5 2.5 5.3-5.3 1.4 1.4-6.7 6.7z',
  key: 'M7 14a2 2 0 110-4 2 2 0 010 4zm5.6-4A6 6 0 101 12a6 6 0 0011.6 2H16v3h3v-3h2v-4h-8.4z',
  out: 'M10 17l1.4-1.4-2.6-2.6H20v-2H8.8l2.6-2.6L10 7l-5 5 5 5zM4 5h8V3H4a2 2 0 00-2 2v14a2 2 0 002 2h8v-2H4V5z',
  cam: 'M9 3L7.2 5H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V7a2 2 0 00-2-2h-3.2L15 3H9zm3 15a5 5 0 110-10 5 5 0 010 10z',
  phone: 'M7 1h10a2 2 0 012 2v18a2 2 0 01-2 2H7a2 2 0 01-2-2V3a2 2 0 012-2zm0 4v14h10V5H7z',
  swap: 'M7 7h11l-3-3 1.4-1.4L22 8l-5.6 5.4L15 12l3-3H7V7zm10 10H6l3 3-1.4 1.4L2 16l5.6-5.4L9 12l-3 3h11v2z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
  dl: 'M11 3h2v9l3.3-3.3 1.4 1.4L12 15.8 6.3 10.1l1.4-1.4L11 12V3zM4 19h16v2H4z',
  trash: 'M9 3h6l1 2h4v2H4V5h4l1-2zM6 9h12l-1 12H7L6 9z',
  play: 'M8 5v14l11-7z',
  mail: 'M2 5h20v14H2V5zm2 2v.5l8 5 8-5V7H4zm16 2.8l-8 5-8-5V17h16V9.8z',
  crown: 'M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7zm2.4 14h13.2v2H5.4v-2z',
  check: 'M9 16.2l-4.2-4.2-1.4 1.4L9 19 21 7l-1.4-1.4z'
}[d]);
const BRAND = {
  google: '<svg class="bm" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>',
  apple: '<svg class="bm" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.3-1.2 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4zM13.9 5c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z"/></svg>',
  facebook: '<svg class="bm" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M24 12a12 12 0 10-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0024 12z"/></svg>'
};
const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P(n)}"/></svg>`;

/* ---------- words (Hebrew first, English for every other interface language) ---------- */
const STR = {
  he: {
    dir: 'rtl', loading: 'טוען…', detecting: 'מזהה את החשבון שלך…', hello: 'שלום, {n}', welcomeBack: 'ברוך שובך ל-Drive Play',
    entering: 'נכנסים…', enter: 'כניסה', tag: 'חוויית צפייה בלתי נשכחת',
    welcomeT: 'ברוכים הבאים ל-Drive Play', welcomeS: 'התחברו כדי לשמור את הרשימות, ההגדרות, היסטוריית הצפייה והזיכרון של CineAI – בכל מכשיר.',
    signin: 'התחברות', signup: 'יצירת חשבון חדש', guest: 'המשך בלי חשבון', guestNote: 'כאורחים הנתונים נשמרים רק בדפדפן הזה.',
    savedHere: 'החשבונות שלכם במכשיר הזה', connected: 'מחובר', needPw: 'נדרשת סיסמה',
    email: 'אימייל', password: 'סיסמה', name: 'השם שלך', confirmPw: 'אימות סיסמה', show: 'הצגת הסיסמה', hide: 'הסתרת הסיסמה',
    forgot: 'שכחתי את הסיסמה', noAcct: 'אין לכם חשבון?', haveAcct: 'כבר יש לכם חשבון?', createIt: 'יצירת חשבון', signinIt: 'התחברות',
    signinT: 'התחברות לחשבון', signupT: 'יצירת חשבון', forgotT: 'איפוס סיסמה', forgotS: 'נשלח לכם קישור לבחירת סיסמה חדשה.',
    send: 'שליחת קישור', sent: 'אם קיים חשבון עם הכתובת הזו, נשלח אליה קישור לאיפוס. בדקו גם בתיקיית הספאם.',
    pwReq: ['לפחות 8 תווים', 'אות', 'ספרה', 'בלי רווחים'], weak: 'חלשה', fair: 'סבירה', good: 'טובה', strong: 'חזקה',
    agree: 'קראתי ואני מסכים/ה ל<a href="{u}" target="_blank" rel="noopener">תנאי השימוש ולמדיניות הפרטיות</a>',
    moveGuest: 'להעביר לחשבון את מה ששמרתי כאורח', create: 'יצירת החשבון', doSignin: 'התחברות',
    errEmail: 'כתובת האימייל לא תקינה.', errPw: 'הסיסמה צריכה לכלול לפחות 8 תווים, אות וספרה, בלי רווחים.', errMatch: 'הסיסמאות לא זהות.',
    errName: 'כתבו שם (עד 30 תווים).', errAgree: 'צריך לאשר את תנאי השימוש.', errCreds: 'האימייל או הסיסמה שגויים.',
    errExists: 'כבר יש חשבון עם האימייל הזה. אפשר להתחבר אליו.', errMany: 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.',
    errNet: 'אין חיבור לשרת. בדקו את החיבור לאינטרנט ונסו שוב.', errGeneric: 'משהו השתבש. נסו שוב.', errDisabled: 'החשבון הזה הושבת.',
    errOld: 'מטעמי אבטחה צריך להזין שוב את הסיסמה.', errLock: 'יותר מדי ניסיונות שגויים. אפשר לנסות שוב בעוד {s} שניות.',
    whoT: 'מי צופה עכשיו?', manage: 'ניהול פרופילים', done: 'סיום', newProf: 'פרופיל חדש', kids: 'ילדים',
    switchAcct: 'החלפת חשבון', signout: 'התנתקות',
    pinT: 'הפרופיל נעול', pinS: 'הקלידו את הקוד בן 4 הספרות של {n}', pinBad: 'הקוד שגוי.',
    profEdit: 'עריכת פרופיל', profNew: 'פרופיל חדש', profName: 'שם הפרופיל', color: 'צבע', photo: 'תמונה', upload: 'העלאת תמונה',
    removePhoto: 'הסרת התמונה', kidsT: 'פרופיל ילדים', kidsS: 'תוכן מתאים לילדים בלבד, בלי גישה להגדרות החשבון',
    pinOn: 'נעילה בקוד', pinOnS: 'קוד בן 4 ספרות לפני הכניסה לפרופיל', setPin: 'בחירת קוד', save: 'שמירה', cancel: 'ביטול',
    delProf: 'מחיקת הפרופיל', delProfQ: 'למחוק את הפרופיל "{n}" וכל מה שנשמר בו?', delete: 'מחיקה',
    imgBad: 'לא הצלחנו לקרוא את התמונה. נסו קובץ אחר.',
    center: 'החשבון שלי', tProfiles: 'פרופילים', tAccount: 'פרטי החשבון', tStats: 'צפייה ונתונים', tDevices: 'מכשירים', tPrivacy: 'פרטיות ואבטחה',
    profilesS: 'לכל פרופיל יש זיכרון משלו: רשימות, הגדרות, היסטוריה ושיחות עם CineAI.', current: 'הפרופיל הנוכחי', switchTo: 'מעבר לפרופיל',
    acctS: 'השם, התמונה והסיסמה של החשבון.', acctName: 'שם החשבון', acctPhoto: 'תמונת החשבון',
    verified: 'מאומת', notVerified: 'לא מאומת', resend: 'שליחת אימות', verifySent: 'נשלח מייל אימות. פתחו את הקישור שבו.',
    changePw: 'שינוי סיסמה', curPw: 'הסיסמה הנוכחית', newPw: 'סיסמה חדשה', pwChanged: 'הסיסמה עודכנה. מכשירים אחרים יצטרכו להתחבר מחדש.',
    signoutS: 'ההתנתקות היא רק מהמכשיר הזה.', signoutAll: 'התנתקות מכל המכשירים', signoutAllQ: 'להתנתק מכל המכשירים האחרים? יהיה צריך להתחבר בהם מחדש.',
    signoutAllDone: 'כל המכשירים האחרים נותקו.', addAcct: 'הוספת חשבון', removeHere: 'הסרה מהמכשיר',
    dangerT: 'מחיקת החשבון', dangerS: 'מוחק לצמיתות את החשבון, כל הפרופילים וכל הנתונים שלהם. אי אפשר לשחזר.',
    delAcct: 'מחיקת החשבון לצמיתות', delAcctQ: 'כדי למחוק, הקלידו את הסיסמה וכתבו את המילה "מחיקה".', delWord: 'מחיקה', delDone: 'החשבון נמחק.',
    statsS: 'הנתונים של הפרופיל {n}.', watch: 'זמן צפייה', site: 'זמן באתר', week: 'השבוע', streak: 'ימים ברצף', member: 'חבר מאז',
    lists: 'כותרים ברשימות', chats: 'שיחות עם CineAI', last7: '7 הימים האחרונים', legendW: 'צפייה', legendS: 'גלישה', recent: 'נצפו לאחרונה',
    noRecent: 'עוד לא נצפו סרטונים בפרופיל הזה.', pages: 'הדפים שבהם ביליתם הכי הרבה', exportT: 'הנתונים שלי', exportS: 'הורדת כל מה שנשמר בחשבון לקובץ אחד.',
    export: 'הורדת הנתונים', clearProf: 'איפוס נתוני הפרופיל', clearProfQ: 'למחוק את הרשימות, ההגדרות וההיסטוריה של הפרופיל הזה?', cleared: 'נתוני הפרופיל נמחקו.',
    storage: 'נפח בשימוש', devicesS: 'המכשירים שמחוברים לחשבון. אם אתם לא מזהים מכשיר – נתקו אותו והחליפו סיסמה.',
    thisDev: 'המכשיר הזה', lastSeen: 'פעילות אחרונה', disconnect: 'ניתוק', disconnected: 'המכשיר נותק.',
    privS: 'מה נשמר, איפה, ואיך זה מוגן.', storedT: 'מה נשמר בחשבון', stored: ['השם, האימייל והתמונה שבחרתם', 'הפרופילים והקודים שלהם (הקוד נשמר מוצפן בגיבוב)', 'הרשימות, ההגדרות, היסטוריית הצפייה והשיחות עם CineAI', 'זמני צפייה וגלישה, ורשימת המכשירים המחוברים'],
    whereT: 'איפה ואיך', where: ['הנתונים נשמרים ב-Google Firebase, במרכז הנתונים של Google בתל אביב', 'הסיסמה מנוהלת על ידי Google ואף אחד – גם לא אנחנו – לא יכול לראות אותה', 'רק אתם יכולים לקרוא ולשנות את הנתונים של החשבון שלכם', 'תמונות שמעלים עוברות דחיסה, והמידע הנסתר שבהן (כמו מיקום) נמחק'],
    loginsT: 'כניסות אחרונות לחשבון', tipsT: 'טיפים לאבטחה', tips: ['בחרו סיסמה שאתם לא משתמשים בה באתרים אחרים', 'נעלו בקוד פרופילים שאתם לא רוצים שילדים ייכנסו אליהם', 'התנתקו כשאתם משתמשים במחשב ציבורי', 'אם משהו נראה חשוד – נתקו את כל המכשירים והחליפו סיסמה'],
    policy: 'למדיניות הפרטיות המלאה', guestT: 'אתם גולשים כאורחים', guestS: 'הנתונים שלכם נשמרים רק בדפדפן הזה. עם חשבון הם נשמרים בענן, זמינים בכל מכשיר ומוגנים בסיסמה.',
    guestClear: 'מחיקת הנתונים מהדפדפן', guestClearQ: 'למחוק את כל מה שנשמר בדפדפן הזה (רשימות, הגדרות, היסטוריה)?',
    saved: 'נשמר', close: 'סגירה', back: 'חזרה', mins: '{n} דק\'', hours: '{h} שע\' {m} דק\'', hoursOnly: '{h} שע\'', zero: '0 דק\'',
    days: ['א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\'', 'ש\''], remote: 'החשבון נותק מהמכשיר הזה מרחוק. התחברו שוב.',
    offline: 'אין חיבור לשרת – משתמשים בנתונים השמורים במכשיר.', kidsLocked: 'בפרופיל ילדים אפשר רק להחליף פרופיל.',
    topOnly: 'מערכת החשבונות של Drive Play פועלת מתוך האתר.', toSite: 'מעבר לאתר', unknownDev: 'מכשיר לא מזוהה',
    stayHint: 'אפשר לסגור עם Esc', prof: 'פרופיל', you: 'אתם', pinSet: 'הקוד נשמר', welcomeNew: 'החשבון נוצר. ברוכים הבאים, {n}',
    verifyNote: 'שלחנו מייל לאימות הכתובת. אפשר להמשיך לגלוש כבר עכשיו.',
    welcomeReq: 'כדי לצפות ב-Drive Play צריך חשבון. ההרשמה בחינם ולוקחת כמה שניות.',
    withGoogle: 'המשך עם Google', withApple: 'המשך עם Apple', withFacebook: 'המשך עם Facebook', orEmail: 'או עם אימייל',
    socialAgree: 'בהמשך אתם מסכימים ל<a href="{u}" target="_blank" rel="noopener">תנאי השימוש ולמדיניות הפרטיות</a>.',
    errPopup: 'הדפדפן חסם את חלון ההתחברות. אפשרו חלונות קופצים לאתר ונסו שוב.',
    errOtherMethod: 'כבר יש חשבון עם האימייל הזה, בדרך התחברות אחרת. התחברו בדרך שבה נרשמתם.',
    errNotEnabled: 'ההתחברות בדרך הזו עוד לא הופעלה. אפשר להתחבר עם אימייל בינתיים.',
    errSdk: 'לא הצלחנו לטעון את שירות ההתחברות. בדקו את החיבור ונסו שוב.',
    viaProvider: 'מחובר דרך {p}', reauthQ: 'כדי למחוק, אשרו שוב את ההתחברות דרך {p} וכתבו את המילה "מחיקה".',
    proName: 'Drive Play Pro', tPro: 'Drive Play Pro', proS: 'כל השאר באתר נשאר בחינם. Pro מוסיף את CineAI.',
    proOn: 'Pro פעיל', proOff: 'החשבון בגרסה החינמית', proUntil: 'פעיל עד {d}',
    proFeat: ['CineAI – העוזר החכם להמלצות', 'כל הפרופילים בחשבון נהנים מ-Pro'],
    planM: 'חודש', planY: 'שנה', perM: 'לחודש', perY: 'לשנה', save2: 'חודשיים מתנה', buy: 'רכישה', extend: 'הארכה',
    payNote: 'תשלום מאובטח בכרטיס אשראי, Bit, Apple Pay או Google Pay. אין חיוב חוזר – מאריכים מתי שרוצים.',
    payOpen: 'פתחנו את דף התשלום בחלון חדש. אחרי התשלום Pro יופעל כאן אוטומטית.', payWait: 'מחכים לאישור התשלום…',
    payDone: 'התשלום התקבל. Drive Play Pro פעיל עד {d}.', payName: 'שם מלא', payPhone: 'טלפון נייד', payWhy: 'חברת הסליקה Grow מבקשת שם וטלפון נייד לכל תשלום, והקבלה נשלחת לאימייל של החשבון.', payNameErr: 'כתבו שם פרטי ושם משפחה.', payPhoneErr: 'כתבו מספר נייד ישראלי, למשל 0501234567.', payOff: 'הרכישה עוד לא נפתחה. נסו שוב בקרוב.',
    payErr: 'לא הצלחנו לפתוח את דף התשלום. נסו שוב.', proPage: 'הדף הזה חלק מ-Drive Play Pro', proPageS: 'שדרגו כדי לפתוח את {n}.',
    toHome: 'חזרה לדף הבית', kidsPro: 'בקשו ממבוגר בבית לשדרג את החשבון.', proBadge: 'PRO'
  },
  en: {
    dir: 'ltr', loading: 'Loading…', detecting: 'Checking your account…', hello: 'Hi, {n}', welcomeBack: 'Welcome back to Drive Play',
    entering: 'Entering…', enter: 'Enter', tag: 'An unforgettable viewing experience',
    welcomeT: 'Welcome to Drive Play', welcomeS: 'Sign in to keep your lists, settings, watch history and CineAI memory on every device.',
    signin: 'Sign in', signup: 'Create a new account', guest: 'Continue without an account', guestNote: 'As a guest, your data stays in this browser only.',
    savedHere: 'Your accounts on this device', connected: 'Signed in', needPw: 'Password needed',
    email: 'Email', password: 'Password', name: 'Your name', confirmPw: 'Confirm password', show: 'Show password', hide: 'Hide password',
    forgot: 'Forgot your password?', noAcct: 'No account yet?', haveAcct: 'Already have an account?', createIt: 'Create one', signinIt: 'Sign in',
    signinT: 'Sign in to your account', signupT: 'Create an account', forgotT: 'Reset your password', forgotS: 'We will email you a link to choose a new password.',
    send: 'Send link', sent: 'If an account exists for this address, a reset link is on its way. Check your spam folder too.',
    pwReq: ['8+ characters', 'a letter', 'a number', 'no spaces'], weak: 'Weak', fair: 'Fair', good: 'Good', strong: 'Strong',
    agree: 'I have read and agree to the <a href="{u}" target="_blank" rel="noopener">terms of use and privacy policy</a>',
    moveGuest: 'Move what I saved as a guest into the account', create: 'Create account', doSignin: 'Sign in',
    errEmail: 'That email address is not valid.', errPw: 'Use at least 8 characters with a letter and a number, no spaces.', errMatch: 'The passwords do not match.',
    errName: 'Enter a name (up to 30 characters).', errAgree: 'Please accept the terms of use.', errCreds: 'Wrong email or password.',
    errExists: 'An account with this email already exists. You can sign in to it.', errMany: 'Too many attempts. Try again in a few minutes.',
    errNet: 'Cannot reach the server. Check your connection and try again.', errGeneric: 'Something went wrong. Please try again.', errDisabled: 'This account was disabled.',
    errOld: 'For your security, please enter your password again.', errLock: 'Too many wrong attempts. Try again in {s} seconds.',
    whoT: 'Who is watching?', manage: 'Manage profiles', done: 'Done', newProf: 'New profile', kids: 'Kids',
    switchAcct: 'Switch account', signout: 'Sign out',
    pinT: 'This profile is locked', pinS: 'Enter the 4-digit code for {n}', pinBad: 'Wrong code.',
    profEdit: 'Edit profile', profNew: 'New profile', profName: 'Profile name', color: 'Color', photo: 'Photo', upload: 'Upload a photo',
    removePhoto: 'Remove photo', kidsT: 'Kids profile', kidsS: 'Kid-friendly content only, no access to account settings',
    pinOn: 'Lock with a code', pinOnS: 'Ask for a 4-digit code before entering this profile', setPin: 'Choose code', save: 'Save', cancel: 'Cancel',
    delProf: 'Delete profile', delProfQ: 'Delete the profile "{n}" and everything saved in it?', delete: 'Delete',
    imgBad: 'We could not read that image. Try another file.',
    center: 'My account', tProfiles: 'Profiles', tAccount: 'Account details', tStats: 'Watching & data', tDevices: 'Devices', tPrivacy: 'Privacy & security',
    profilesS: 'Every profile has its own memory: lists, settings, history and CineAI chats.', current: 'Current profile', switchTo: 'Switch to profile',
    acctS: 'Your account name, photo and password.', acctName: 'Account name', acctPhoto: 'Account photo',
    verified: 'Verified', notVerified: 'Not verified', resend: 'Send verification', verifySent: 'Verification email sent. Open the link inside.',
    changePw: 'Change password', curPw: 'Current password', newPw: 'New password', pwChanged: 'Password updated. Other devices will need to sign in again.',
    signoutS: 'Signing out only affects this device.', signoutAll: 'Sign out of all devices', signoutAllQ: 'Sign out of all other devices? You will need to sign in on them again.',
    signoutAllDone: 'All other devices were signed out.', addAcct: 'Add account', removeHere: 'Remove from this device',
    dangerT: 'Delete account', dangerS: 'Permanently deletes the account, all profiles and all their data. This cannot be undone.',
    delAcct: 'Delete account permanently', delAcctQ: 'To delete, enter your password and type the word "DELETE".', delWord: 'DELETE', delDone: 'The account was deleted.',
    statsS: 'Data for the profile {n}.', watch: 'Watch time', site: 'Time on site', week: 'This week', streak: 'Day streak', member: 'Member since',
    lists: 'Titles in lists', chats: 'CineAI chats', last7: 'Last 7 days', legendW: 'Watching', legendS: 'Browsing', recent: 'Recently watched',
    noRecent: 'No videos watched on this profile yet.', pages: 'Pages you spend the most time on', exportT: 'My data', exportS: 'Download everything saved in the account as one file.',
    export: 'Download my data', clearProf: 'Reset profile data', clearProfQ: 'Delete the lists, settings and history of this profile?', cleared: 'Profile data deleted.',
    storage: 'Storage used', devicesS: 'Devices signed in to your account. If you do not recognise one, sign it out and change your password.',
    thisDev: 'This device', lastSeen: 'Last active', disconnect: 'Sign out', disconnected: 'The device was signed out.',
    privS: 'What is saved, where, and how it is protected.', storedT: 'What the account stores', stored: ['The name, email and photo you chose', 'Your profiles and their codes (codes are stored hashed)', 'Lists, settings, watch history and CineAI chats', 'Watching and browsing time, and the list of signed-in devices'],
    whereT: 'Where and how', where: ['Data is stored in Google Firebase, in Google\'s Tel Aviv data center', 'Your password is handled by Google and nobody – including us – can see it', 'Only you can read and change your account data', 'Uploaded photos are compressed and their hidden metadata (such as location) is removed'],
    loginsT: 'Recent sign-ins', tipsT: 'Security tips', tips: ['Use a password you do not use anywhere else', 'Lock profiles you do not want kids to open', 'Sign out when you use a public computer', 'If something looks suspicious, sign out all devices and change your password'],
    policy: 'Full privacy policy', guestT: 'You are browsing as a guest', guestS: 'Your data is saved in this browser only. With an account it is kept in the cloud, available on every device and protected by a password.',
    guestClear: 'Delete data from this browser', guestClearQ: 'Delete everything saved in this browser (lists, settings, history)?',
    saved: 'Saved', close: 'Close', back: 'Back', mins: '{n} min', hours: '{h} h {m} min', hoursOnly: '{h} h', zero: '0 min',
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], remote: 'This device was signed out remotely. Please sign in again.',
    offline: 'Server not reachable – using the data saved on this device.', kidsLocked: 'Kids profiles can only switch profiles.',
    topOnly: 'The Drive Play account system runs inside the site.', toSite: 'Go to the site', unknownDev: 'Unknown device',
    stayHint: 'Press Esc to close', prof: 'Profile', you: 'You', pinSet: 'Code saved', welcomeNew: 'Account created. Welcome, {n}',
    verifyNote: 'We sent you an email to verify the address. You can keep browsing right away.',
    welcomeReq: 'You need an account to watch Drive Play. Signing up is free and takes a few seconds.',
    withGoogle: 'Continue with Google', withApple: 'Continue with Apple', withFacebook: 'Continue with Facebook', orEmail: 'or with email',
    socialAgree: 'By continuing you agree to the <a href="{u}" target="_blank" rel="noopener">terms of use and privacy policy</a>.',
    errPopup: 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.',
    errOtherMethod: 'An account with this email already exists with a different sign-in method. Use the method you signed up with.',
    errNotEnabled: 'This sign-in method is not available yet. You can sign in with email meanwhile.',
    errSdk: 'Could not load the sign-in service. Check your connection and try again.',
    viaProvider: 'Signed in with {p}', reauthQ: 'To delete, confirm your sign-in with {p} again and type the word "DELETE".',
    proName: 'Drive Play Pro', tPro: 'Drive Play Pro', proS: 'Everything else on the site stays free. Pro adds CineAI.',
    proOn: 'Pro is active', proOff: 'Your account is on the free plan', proUntil: 'Active until {d}',
    proFeat: ['CineAI – the smart recommendation assistant', 'Every profile in the account gets Pro'],
    planM: 'Month', planY: 'Year', perM: 'per month', perY: 'per year', save2: '2 months free', buy: 'Buy', extend: 'Extend',
    payNote: 'Secure payment by card, Bit, Apple Pay or Google Pay. No automatic renewal – extend whenever you like.',
    payOpen: 'The payment page opened in a new window. Pro turns on here automatically after you pay.', payWait: 'Waiting for the payment…',
    payDone: 'Payment received. Drive Play Pro is active until {d}.', payName: 'Full name', payPhone: 'Mobile phone', payWhy: 'Our payment provider, Grow, needs a name and an Israeli mobile number for every payment. The receipt goes to your account email.', payNameErr: 'Enter your first and last name.', payPhoneErr: 'Enter an Israeli mobile number, for example 0501234567.', payOff: 'Purchases are not open yet. Please try again soon.',
    payErr: 'Could not open the payment page. Please try again.', proPage: 'This page is part of Drive Play Pro', proPageS: 'Upgrade to unlock {n}.',
    toHome: 'Back to the home page', kidsPro: 'Ask a grown-up to upgrade the account.', proBadge: 'PRO'
  }
};
let LANG = 'he', EXTRA = null;
const T = (k, v) => { let s = (EXTRA && EXTRA[k] != null ? EXTRA[k] : (STR[LANG] || STR.en)[k]); if (s == null) s = STR.he[k]; if (typeof s === 'string' && v) s = s.replace(/\{(\w+)\}/g, (m, x) => v[x] != null ? v[x] : m); return s; };
function setLang(l) {
  l = String(l || '').replace(/["']/g, '').toLowerCase().split('-')[0];
  const nl = l === 'he' || l === 'iw' ? 'he' : (l || 'he');
  if (nl !== LANG) EXTRA = null;
  LANG = nl;
  document.documentElement.lang = LANG; document.documentElement.dir = T('dir') === 'ltr' && !['ar', 'fa', 'ur', 'yi'].includes(LANG) ? 'ltr' : 'rtl';
  if (LANG !== 'he' && LANG !== 'en') fetch('i18n/' + LANG + '.json', { cache: 'force-cache' }).then(r => r.ok ? r.json() : null).then(j => { if (j) { EXTRA = j; if (VIEW.redraw) VIEW.redraw(); } }).catch(() => {});
}
const fmtDur = sec => { sec = Math.max(0, Math.round(sec || 0)); const m = Math.round(sec / 60); if (m < 1) return T('zero'); if (m < 60) return T('mins', { n: m }); const h = Math.floor(m / 60), r = m % 60; return r ? T('hours', { h, m: r }) : T('hoursOnly', { h }); };
const fmtDate = t => { try { return new Date(t).toLocaleDateString(LANG === 'he' ? 'he-IL' : LANG, { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { return new Date(t).toDateString(); } };
const fmtWhen = t => { try { return new Date(t).toLocaleString(LANG === 'he' ? 'he-IL' : LANG, { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return new Date(t).toString(); } };
const maskEmail = e => { e = String(e || ''); const [u, d] = e.split('@'); if (!d) return e; return (u.length <= 2 ? u[0] + '•' : u.slice(0, 2) + '•'.repeat(Math.min(6, u.length - 2))) + '@' + d; };

/* ---------- device storage (this browser, inside the site only) ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const SS = {
  get(k, d) { try { const v = sessionStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
};
let DEVSTORE_OK = true;
try { localStorage.setItem('dpa_t', '1'); localStorage.removeItem('dpa_t'); } catch (e) { DEVSTORE_OK = false; }
const D = LS.get('dpa1', null) || { accts: {}, order: [], cur: null, prof: {}, guest: null, did: rid(10) };
if (!D.did) D.did = rid(10);
const saveD = () => LS.set('dpa1', D);
const kvKey = (uid, pid) => 'dpa_kv_' + uid + '_' + pid;
const udKey = uid => 'dpa_u_' + uid;
function guestData() { if (!D.guest) D.guest = { n: 'אורח', col: '#2F7BFF', st: newStats() }; return D.guest; }

/* ---------- Firebase (REST, no SDK – loads fast and keeps the frame small) ---------- */
const AUTH = 'https://identitytoolkit.googleapis.com/v1/accounts:';
const TOKEN = 'https://securetoken.googleapis.com/v1/token?key=' + CFG.key;
const FS = 'https://firestore.googleapis.com/v1/projects/' + CFG.project + '/databases/(default)/documents/';
const DOCNAME = p => 'projects/' + CFG.project + '/databases/(default)/documents/' + p;
class ApiErr extends Error { constructor(code, status) { super(code); this.code = code; this.status = status; } }
async function jfetch(url, opt = {}, tries = 2) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), opt.timeout || 12000);
      const r = await fetch(url, Object.assign({ signal: ctl.signal }, opt)); clearTimeout(tm);
      const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : {}; } catch (e) { j = {}; }
      if (!r.ok) { const code = (j && j.error && (j.error.message || j.error.status)) || ('HTTP_' + r.status); throw new ApiErr(String(code).split(' : ')[0].trim(), r.status); }
      return j;
    } catch (e) {
      last = e;
      if (e instanceof ApiErr && e.status && e.status < 500 && e.status !== 429) throw e;
      if (i < tries - 1) await sleep(500 * (i + 1));
    }
  }
  if (last instanceof ApiErr) throw last;
  throw new ApiErr('NETWORK', 0);
}
const authCall = (m, body) => jfetch(AUTH + m + '?key=' + CFG.key, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 1);
const TOK = {};      // uid -> { id, exp }
async function idToken(uid, force) {
  const a = D.accts[uid]; if (!a || !a.rt) throw new ApiErr('SIGNED_OUT', 401);
  const t = TOK[uid]; if (!force && t && t.exp > now() + 60000) return t.id;
  try {
    const j = await jfetch(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(a.rt) });
    TOK[uid] = { id: j.id_token, exp: now() + (+j.expires_in || 3600) * 1000 };
    if (j.refresh_token && j.refresh_token !== a.rt) { a.rt = j.refresh_token; saveD(); }
    return j.id_token;
  } catch (e) {
    if (/TOKEN_EXPIRED|USER_DISABLED|USER_NOT_FOUND|INVALID_REFRESH_TOKEN|INVALID_GRANT_TYPE|MISSING_REFRESH_TOKEN/.test(e.code)) { a.rt = null; saveD(); throw new ApiErr('SIGNED_OUT', 401); }
    throw e;
  }
}
function storeSession(j, extra) {
  const uid = j.localId;
  const a = D.accts[uid] || { uid };
  Object.assign(a, { uid, em: j.email || a.em, rt: j.refreshToken, last: now() }, extra || {});
  if (!a.sid) a.sid = D.did + rid(6);
  D.accts[uid] = a; D.order = [uid, ...D.order.filter(x => x !== uid)].slice(0, MAX_ACCTS + 3);
  TOK[uid] = { id: j.idToken, exp: now() + (+j.expiresIn || 3600) * 1000 };
  saveD(); return a;
}
/* Firestore value encoding */
function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  if (typeof v === 'object') { const f = {}; for (const k of Object.keys(v)) f[k] = enc(v[k]); return { mapValue: { fields: f } }; }
  return { stringValue: String(v) };
}
function dec(x) {
  if (!x) return null;
  if ('stringValue' in x) return x.stringValue;
  if ('integerValue' in x) return +x.integerValue;
  if ('doubleValue' in x) return +x.doubleValue;
  if ('booleanValue' in x) return x.booleanValue;
  if ('nullValue' in x) return null;
  if ('timestampValue' in x) return Date.parse(x.timestampValue);
  if ('arrayValue' in x) return (x.arrayValue.values || []).map(dec);
  if ('mapValue' in x) return decFields(x.mapValue.fields || {});
  return null;
}
const decFields = f => { const o = {}; for (const k of Object.keys(f || {})) o[k] = dec(f[k]); return o; };
const encFields = o => { const f = {}; for (const k of Object.keys(o)) f[k] = enc(o[k]); return f; };
const fp = s => s.split('.').map(seg => /^[A-Za-z_][A-Za-z0-9_]*$/.test(seg) ? seg : '`' + seg.replace(/\\/g, '\\\\').replace(/`/g, '\\`') + '`').join('.');
async function fsReq(uid, method, path, body, qs, keep) {
  const tok = await idToken(uid);
  const url = FS + path + (qs ? '?' + qs : '');
  try {
    return await jfetch(url, { method, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, keepalive: !!keep });
  } catch (e) {
    if (e.status === 401) { await idToken(uid, true); return jfetch(url, { method, headers: { Authorization: 'Bearer ' + TOK[uid].id, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); }
    throw e;
  }
}
async function fsGet(uid, path) { try { const j = await fsReq(uid, 'GET', path); return decFields(j.fields || {}); } catch (e) { if (e.status === 404 || e.code === 'NOT_FOUND') return null; throw e; } }
async function fsPatch(uid, path, obj, mask, keep) {
  const qs = (mask || Object.keys(obj)).map(m => 'updateMask.fieldPaths=' + encodeURIComponent(fp(m))).join('&');
  return fsReq(uid, 'PATCH', path, { fields: encFields(obj) }, qs, keep);
}
async function fsDel(uid, path) { try { await fsReq(uid, 'DELETE', path); } catch (e) { if (e.status !== 404) throw e; } }
async function fsList(uid, path) { try { const j = await fsReq(uid, 'GET', path, null, 'pageSize=100'); return (j.documents || []).map(d => ({ id: d.name.split('/').pop(), ...decFields(d.fields || {}) })); } catch (e) { if (e.status === 404) return []; throw e; } }
async function fsCommitReal(uid, writes, keep) {
  const tok = await idToken(uid);
  return jfetch(FS.replace(/\/documents\/$/, '/documents:commit'), { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ writes }), keepalive: !!keep });
}

/* ---------- account model ---------- */
let CUR = null;          // { type:'acct'|'guest', uid, user, prof, kv }
const newStats = () => ({ w: 0, s: 0, D: {}, pg: {}, r: [], f: now() });
const devInfo = () => {
  const u = navigator.userAgent;
  const os = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Mac OS X/.test(u) ? 'Mac' : /CrOS/.test(u) ? 'ChromeOS' : /Linux/.test(u) ? 'Linux' : '';
  const br = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /SamsungBrowser/.test(u) ? 'Samsung Internet' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : '';
  const kind = /iPhone|Android.+Mobile|Mobile/.test(u) ? 'phone' : /iPad|Android|Tablet/.test(u) ? 'tablet' : 'desktop';
  return { os, br, kind };
};
function profView(p) { return p ? { id: p.id, n: p.n, col: p.col, kids: !!p.kids, img: p.img || '', lock: !!p.pin } : null; }
function acctView() {
  if (!CUR) return { type: 'none' };
  if (CUR.type === 'guest') return { type: 'guest', n: T('guest') };
  const u = CUR.user || {}; return { type: 'acct', n: u.n || '', img: u.img || '' };
}
async function loadUser(uid, fresh) {
  const cached = LS.get(udKey(uid), null);
  if (!fresh && cached) return cached;
  const u = await fsGet(uid, 'users/' + uid);
  if (u) LS.set(udKey(uid), u);
  return u;
}
function cacheUser(uid, u) { LS.set(udKey(uid), u); if (D.accts[uid]) { D.accts[uid].n = u.n; D.accts[uid].img = u.img || ''; saveD(); } }
async function saveUser(uid, patch) {
  const u = Object.assign(LS.get(udKey(uid), {}) || {}, patch);
  cacheUser(uid, u);
  if (CUR && CUR.uid === uid) CUR.user = u;
  await fsPatch(uid, 'users/' + uid, patch);
  return u;
}
function getKV(uid, pid) { return uid === 'guest' ? (LS.get('dpa_gkv', {}) || {}) : (LS.get(kvKey(uid, pid), {}) || {}); }
function setKVCache(uid, pid, kv) { if (uid === 'guest') LS.set('dpa_gkv', kv); else LS.set(kvKey(uid, pid), kv); }
async function fetchKV(uid, pid) { const d = await fsGet(uid, 'users/' + uid + '/kv/' + pid); return d && d.d ? d.d : {}; }

/* ---------- talking to the page ---------- */
let PARENT = null, PAGE = { page: '', label: '' }, ENTERED = false;
function post(msg) { if (PARENT) window.parent.postMessage(Object.assign({ dp: 1 }, msg), PARENT); }
function ui(on) { post({ t: 'ui', on }); }
function sendEnter() {
  if (CUR && CUR.type === 'acct' && pageNeedsPro() && !isPro()) { paywall(); return; }
  if (ENTERED) { SS.set('dpa_visit', { u: CUR.type === 'guest' ? 'guest' : CUR.uid, p: CUR.prof && CUR.prof.id }); reloadPage(); return; }
  ENTERED = true;
  const kv = CUR.kv || {};
  /* once inside, the account screens use the same language as the site (Hebrew unless the profile chose another) */
  if (CUR.type === 'acct') setLang(kv.dp_lang || 'he');
  post({ t: 'enter', kv, prof: profView(CUR.prof), acct: acctView(), pro: proView(), lang: kv.dp_lang || '', persist: DEVSTORE_OK });
  SS.set('dpa_visit', { u: CUR.type === 'guest' ? 'guest' : CUR.uid, p: CUR.prof && CUR.prof.id });
  hideAll(); ui(false);
}
function reloadPage() { flushAll(true); post({ t: 'reload' }); }

/* ---------- write-back of the page's saved data ---------- */
let pendKV = {}, kvTimer = 0, kvFirst = 0;
function onSet(ch) {
  if (!CUR || !ch || typeof ch !== 'object') return;
  let n = 0;
  for (const k of Object.keys(ch)) {
    if (++n > 200) break;
    if (!KEY_OK.test(k)) continue;
    const v = ch[k];
    if (v !== null && (typeof v !== 'string' || v.length > MAX_VAL)) continue;
    if (v === null) delete CUR.kv[k]; else CUR.kv[k] = v;
    pendKV[k] = v;
    /* the page changed its language: the account screens follow it */
    if (k === 'dp_lang') setLang(v || 'he');
  }
  setKVCache(CUR.type === 'guest' ? 'guest' : CUR.uid, CUR.prof.id, CUR.kv);
  if (CUR.type !== 'acct') { pendKV = {}; return; }
  if (!kvFirst) kvFirst = now();
  clearTimeout(kvTimer);
  kvTimer = setTimeout(flushKV, now() - kvFirst > 6000 ? 0 : 1500);
}
async function flushKV(keep) {
  clearTimeout(kvTimer); kvFirst = 0;
  if (!CUR || CUR.type !== 'acct') return;
  const ch = pendKV; pendKV = {};
  const keys = Object.keys(ch); if (!keys.length) return;
  const fields = { u: now() }; const d = {}; for (const k of keys) if (ch[k] !== null) d[k] = ch[k];
  if (Object.keys(d).length) fields.d = d;
  const mask = ['u', ...keys.map(k => 'd.' + k)];
  try { await fsPatch(CUR.uid, 'users/' + CUR.uid + '/kv/' + CUR.prof.id, fields, mask, keep); }
  catch (e) { if (e.code === 'SIGNED_OUT') return; for (const k of keys) if (!(k in pendKV)) pendKV[k] = ch[k]; if (!keep) kvTimer = setTimeout(flushKV, 15000); }
}
/* watching and browsing time */
let pendST = { w: 0, s: 0, pg: {}, v: [] }, stTimer = 0;
function onStat(m) {
  if (!CUR) return;
  const w = Math.min(600, Math.max(0, +m.w || 0)), s = Math.min(600, Math.max(0, +m.s || 0));
  pendST.w += w; pendST.s += s;
  const pg = String(m.pg || PAGE.page || 'site').slice(0, 30); pendST.pg[pg] = (pendST.pg[pg] || 0) + s + w;
  if (Array.isArray(m.v)) for (const x of m.v.slice(0, 10)) if (x && x.id) pendST.v.push({ id: String(x.id).slice(0, 20), t: String(x.t || '').slice(0, 120), sec: Math.min(600, +x.sec || 0), at: now(), pg });
  if (!stTimer) stTimer = setTimeout(() => flushStats(), 60000);
}
function mergeRecent(list, adds) {
  list = Array.isArray(list) ? list.slice() : [];
  for (const a of adds) {
    const i = list.findIndex(x => x.id === a.id);
    if (i >= 0) { const o = list.splice(i, 1)[0]; a.sec = (o.sec || 0) + (a.sec || 0); if (!a.t) a.t = o.t; }
    list.unshift(a);
  }
  return list.slice(0, 30);
}
async function flushStats(keep) {
  clearTimeout(stTimer); stTimer = 0;
  if (!CUR) return;
  const p = pendST; pendST = { w: 0, s: 0, pg: {}, v: [] };
  if (!p.w && !p.s && !p.v.length) return;
  const dk = day();
  if (CUR.type === 'guest') {
    const g = guestData(); const st = g.st || (g.st = newStats());
    st.w += p.w; st.s += p.s; st.D[dk] = st.D[dk] || { w: 0, s: 0 }; st.D[dk].w += p.w; st.D[dk].s += p.s;
    for (const k in p.pg) st.pg[k] = (st.pg[k] || 0) + p.pg[k];
    st.r = mergeRecent(st.r, p.v);
    const keys = Object.keys(st.D).sort(); while (keys.length > 120) delete st.D[keys.shift()];
    saveD(); return;
  }
  const uid = CUR.uid, pid = CUR.prof.id;
  const rk = 'dpa_rec_' + uid + '_' + pid;
  const tr = [];
  const inc = (f, n) => { if (n) tr.push({ fieldPath: fp(f), increment: { integerValue: String(Math.round(n)) } }); };
  inc('w', p.w); inc('s', p.s); inc('D.' + dk + '.w', p.w); inc('D.' + dk + '.s', p.s);
  for (const k in p.pg) inc('pg.' + k, p.pg[k]);
  tr.push({ fieldPath: 'f', minimum: { integerValue: String(now()) } });
  const write = { update: { name: DOCNAME('users/' + uid + '/stats/' + pid), fields: {} }, updateMask: { fieldPaths: [] }, updateTransforms: tr };
  if (p.v.length) { const r = mergeRecent(LS.get(rk, []), p.v); LS.set(rk, r); write.update.fields.r = enc(r); write.updateMask.fieldPaths.push('r'); }
  try { await fsCommitReal(uid, [write], keep); }
  catch (e) { if (!keep && e.code !== 'SIGNED_OUT') { pendST.w += p.w; pendST.s += p.s; for (const k in p.pg) pendST.pg[k] = (pendST.pg[k] || 0) + p.pg[k]; } }
}
function flushAll(keep) { flushKV(keep); flushStats(keep); }
addEventListener('pagehide', () => flushAll(true));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushAll(true); });

/* ---------- screen building ---------- */
const VIEW = { name: '', redraw: null };
function stage(html, opts = {}) {
  hideCenter();
  let st = $('#stage');
  if (!st) { st = document.createElement('div'); st.id = 'stage'; document.body.appendChild(st); }
  st.className = opts.dim ? 'dim' : '';
  st.hidden = false;
  st.innerHTML = `<div class="box ${opts.wide ? 'wide' : ''}">${html}</div>`;
  ui(true);
  if (opts.fx !== false && !opts.dim) particles(); else stopFx();
  const f = $('[autofocus]', st) || $('input,button', st); if (f && opts.focus !== false) setTimeout(() => { try { f.focus({ preventScroll: true }); } catch (e) {} }, 60);
  return st;
}
function hideStage() { const st = $('#stage'); if (st) { st.hidden = true; st.innerHTML = ''; } stopFx(); }
function hideCenter() { const c = $('#center'); if (c) { c.hidden = true; c.innerHTML = ''; } }
function hideAll() { hideStage(); hideCenter(); closeModal(); }
let fxRun = null;
function particles() {
  if (fxRun || still()) return;
  const c = document.createElement('canvas'); $('#stage').prepend(c);
  const x = c.getContext('2d'); let w, h, run = true; const dp = Math.min(2, devicePixelRatio || 1);
  const size = () => { w = c.width = innerWidth * dp; h = c.height = innerHeight * dp; };
  size(); addEventListener('resize', size);
  const Pp = Array.from({ length: Math.min(60, Math.round(innerWidth / 20)) }, () => ({ x: Math.random(), y: Math.random(), r: .6 + Math.random() * 1.6, s: .00012 + Math.random() * .00035, a: .15 + Math.random() * .45, hue: Math.random() < .7 ? '33,150,243' : '139,195,74', ph: Math.random() * 6.28 }));
  const tick = t => {
    if (!run) return; x.clearRect(0, 0, w, h);
    for (const p of Pp) { p.y -= p.s; if (p.y < -.02) { p.y = 1.02; p.x = Math.random(); } x.beginPath(); x.arc(p.x * w + Math.sin(t / 2400 + p.ph) * 14, p.y * h, p.r * dp, 0, 6.283); x.fillStyle = 'rgba(' + p.hue + ',' + (p.a * (.6 + .4 * Math.sin(t / 900 + p.ph))).toFixed(3) + ')'; x.fill(); }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  fxRun = { stop() { run = false; removeEventListener('resize', size); c.remove(); } };
}
function stopFx() { if (fxRun) { fxRun.stop(); fxRun = null; } }
const avatar = (p, cls = '') => `<span class="av ${cls}" style="--pc:${esc((p && p.col) || '#2F7BFF')}" aria-hidden="true">${esc(((p && p.n) || '?').trim().charAt(0).toUpperCase())}${p && p.img && /^data:image\/(webp|jpeg|png);base64,/.test(p.img) ? `<img alt="" src="${p.img}">` : ''}</span>`;
let toastT = 0;
function toast(msg) { let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); } t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3600); }
function closeModal() { const m = $('#modal'); if (m) m.remove(); }
function modal(html, onOpen) {
  closeModal();
  const m = document.createElement('div'); m.id = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
  m.innerHTML = `<div class="card">${html}</div>`; document.body.appendChild(m);
  m.addEventListener('click', e => { if (e.target === m) closeModal(); });
  if (onOpen) onOpen(m);
  const f = $('[autofocus]', m) || $('input,button', m); if (f) setTimeout(() => f.focus(), 40);
  return m;
}
function ask(msg, opts = {}) {
  return new Promise(res => {
    const m = modal(`<h2>${esc(opts.title || '')}</h2><p class="muted" style="margin:6px 0 16px">${esc(msg)}</p>
      ${opts.pw ? `<label class="fld"><span>${T('password')}</span><div class="pw"><input class="inp ltr" type="password" id="mPw" autocomplete="current-password" autofocus></div></label>` : ''}
      ${opts.word ? `<label class="fld"><span>${esc(opts.wordLabel || '')}</span><input class="inp" id="mWord" autocomplete="off"></label>` : ''}
      <div class="err" id="mErr" hidden></div>
      <div class="row end wrap"><button class="btn ghost" type="button" data-a="no">${T('cancel')}</button><button class="btn ${opts.danger ? 'danger' : 'pri'}" type="button" data-a="yes">${esc(opts.yes || T('save'))}</button></div>`);
    m.addEventListener('click', async e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'no') { closeModal(); res(null); return; }
      if (opts.word && $('#mWord').value.trim() !== opts.word) { const er = $('#mErr'); er.textContent = '"' + opts.word + '"'; er.hidden = false; return; }
      const val = { pw: opts.pw ? $('#mPw').value : null };
      if (opts.check) { b.disabled = true; const er = await opts.check(val).catch(x => errMsg(x)); b.disabled = false; if (er) { $('#mErr').textContent = er; $('#mErr').hidden = false; return; } }
      closeModal(); res(val);
    });
    m.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); $('[data-a=yes]', m).click(); } });
  });
}
function errMsg(e) {
  const c = (e && (e.code || e.message)) || '';
  if (/EMAIL_EXISTS/.test(c)) return T('errExists');
  if (/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND|INVALID_IDP_RESPONSE/.test(c)) return T('errCreds');
  if (/TOO_MANY_ATTEMPTS|QUOTA|RESOURCE_EXHAUSTED/.test(c)) return T('errMany');
  if (/INVALID_EMAIL|MISSING_EMAIL/.test(c)) return T('errEmail');
  if (/WEAK_PASSWORD|PASSWORD_DOES_NOT_MEET/.test(c)) return T('errPw');
  if (/USER_DISABLED/.test(c)) return T('errDisabled');
  if (/CREDENTIAL_TOO_OLD|REQUIRES_RECENT_LOGIN/.test(c)) return T('errOld');
  if (/NETWORK|HTTP_0|Failed to fetch|aborted/i.test(c)) return T('errNet');
  return T('errGeneric');
}
/* client-side brake on repeated wrong passwords (Firebase also limits on its side) */
const brake = {
  fails() { return SS.get('dpa_fail', { n: 0, until: 0 }); },
  wait() { const f = this.fails(); return f.until > now() ? Math.ceil((f.until - now()) / 1000) : 0; },
  bad() { const f = this.fails(); f.n++; if (f.n >= 5) { f.until = now() + Math.min(300000, 30000 * Math.pow(2, f.n - 5)); } SS.set('dpa_fail', f); },
  good() { SS.del('dpa_fail'); }
};
const pwRules = p => [p.length >= 8, /[A-Za-z\u0590-\u05FF]/.test(p), /\d/.test(p), !/\s/.test(p)];
const pwScore = p => { if (!p) return 0; let s = pwRules(p).filter(Boolean).length; if (p.length >= 12) s++; if (/[^A-Za-z0-9\u0590-\u05FF]/.test(p)) s++; if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++; return Math.min(4, Math.max(1, s - 2)); };
const emailOk = e => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e);
function pwField(id, label, ac, extra = '') {
  return `<label class="fld"><span>${label}</span><div class="pw"><input class="inp ltr" type="password" id="${id}" autocomplete="${ac}" required ${extra}><button class="eye" type="button" data-eye="${id}" aria-label="${T('show')}">${ic('eye')}</button></div></label>`;
}
function wireEyes(root) {
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-eye]'); if (!b) return;
    const i = document.getElementById(b.dataset.eye); const show = i.type === 'password';
    i.type = show ? 'text' : 'password'; b.innerHTML = ic(show ? 'eyeoff' : 'eye'); b.setAttribute('aria-label', show ? T('hide') : T('show'));
  });
}
const busy = (btn, on) => { if (!btn) return; btn.disabled = on; if (on) { btn.dataset.t = btn.innerHTML; btn.innerHTML = '<span class="spin" aria-hidden="true"></span>'; } else if (btn.dataset.t) btn.innerHTML = btn.dataset.t; };

/* ---------- Drive Play Pro ----------
   The Pro end date lives in ent/{uid}. Only the payments server can write it
   (see firestore.rules); this frame only reads it. */
let PRO = { until: 0 };
const proKey = uid => 'dpa_pro_' + uid;
const isPro = () => (PRO.until || 0) > now();
const proView = () => ({ on: isPro(), until: PRO.until || 0 });
const pageNeedsPro = () => PRO_ENABLED && !!(PAGE.pro || PRO_PAGES.test(PAGE.page + ' ' + PAGE.label));
async function loadPro(uid, offline) {
  PRO = LS.get(proKey(uid), null) || { until: 0 };
  if (offline) return PRO;
  try { const e = await withTimeout(fsGet(uid, 'ent/' + uid), 5000); PRO = { until: (e && +e.until) || 0, plan: (e && e.plan) || '' }; LS.set(proKey(uid), PRO); } catch (x) {}
  return PRO;
}
const PAY_URL_OK = /^https:\/\/([a-z0-9-]+\.)*(meshulam\.co\.il|grow\.link|grow\.business)\//;
function proOffer() {
  const kids = CUR && CUR.prof && CUR.prof.kids;
  const on = isPro();
  return `<ul class="feats">${T('proFeat').map(f => `<li>${ic('check')}<span>${esc(f)}</span></li>`).join('')}</ul>
    ${kids ? `<p class="hint" style="text-align:center">${T('kidsPro')}</p>` : `${payerForm()}<div class="plans">
      <div class="plan"><b>${T('planM')}</b><span class="price">${PRO_PRICE.m}</span><small>${T('perM')}</small><button class="btn ghost block sm" type="button" data-buy="m">${on ? T('extend') : T('buy')}</button></div>
      <div class="plan best"><span class="ribbon">${T('save2')}</span><b>${T('planY')}</b><span class="price">${PRO_PRICE.y}</span><small>${T('perY')}</small><button class="btn pri block sm" type="button" data-buy="y">${on ? T('extend') : T('buy')}</button></div>
    </div>
    <p class="hint" style="text-align:center">${T('payNote')}</p>
    <p class="status" id="payState" role="status" hidden></p>`}`;
}
/* Grow needs the payer's full name (two words at least) and an Israeli mobile number */
const payerKey = uid => 'dpa_payer_' + uid;
function payerForm() {
  const sv = (CUR && CUR.uid && LS.get(payerKey(CUR.uid), null)) || {};
  const nm = sv.n || (CUR && CUR.user && CUR.user.n) || '';
  return `<div class="payer">
      <label class="fld"><span>${T('payName')}</span><input class="inp" id="payName" type="text" autocomplete="name" maxlength="60" value="${esc(nm)}"></label>
      <label class="fld"><span>${T('payPhone')}</span><input class="inp ltr" id="payPhone" type="tel" inputmode="tel" autocomplete="tel" maxlength="16" placeholder="0501234567" value="${esc(sv.p || '')}"></label>
      <p class="hint">${T('payWhy')}</p>
    </div>`;
}
const cleanName = v => String(v || '').replace(/[^\p{L}\p{M}' -]/gu, ' ').replace(/\s+/g, ' ').trim();
function cleanPhone(v) { let d = String(v || '').replace(/\D/g, ''); if (d.startsWith('972')) d = '0' + d.slice(3); return d; }
function payerCheck() {
  const ni = $('#payName'), pi = $('#payPhone'), ps = $('#payState');
  const n = cleanName(ni && ni.value), p = cleanPhone(pi && pi.value);
  const bad = (el, msg) => { if (ps) { ps.textContent = msg; ps.hidden = false; } if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); } return null; };
  [ni, pi].forEach(el => el && el.removeAttribute('aria-invalid'));
  if (n.split(' ').filter(w => w.replace(/[' -]/g, '').length >= 2).length < 2) return bad(ni, T('payNameErr'));
  if (!/^05\d{8}$/.test(p)) return bad(pi, T('payPhoneErr'));
  LS.set(payerKey(CUR.uid), { n, p });
  return { n, p };
}
let payWatch = 0;
async function buy(plan, btn) {
  if (!PAY_API) { toast(T('payOff')); return; }
  const payer = payerCheck(); if (!payer) return;
  const w = window.open('', '_blank');   /* opened inside the click so it is not blocked */
  busy(btn, true);
  try {
    const tok = await idToken(CUR.uid);
    const r = await fetch(PAY_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ a: 'checkout', plan, idToken: tok, name: payer.n, phone: payer.p, lang: LANG }) });
    const j = await r.json();
    if (!j || !j.url || !PAY_URL_OK.test(j.url)) throw new Error(j && j.err || 'pay');
    if (w && !w.closed) { try { w.opener = null; } catch (e) {} w.location.href = j.url; } else window.open(j.url, '_blank', 'noopener');
    const ps = $('#payState'); if (ps) { ps.textContent = T('payOpen'); ps.hidden = false; }
    watchPay();
  } catch (x) { if (w) try { w.close(); } catch (e) {} toast(T('payErr')); }
  busy(btn, false);
}
/* after the payment page opens, check every few seconds until the server turns Pro on */
function watchPay() {
  clearInterval(payWatch);
  const uid = CUR.uid, before = PRO.until || 0, end = now() + 20 * 60000;
  payWatch = setInterval(async () => {
    if (!CUR || CUR.uid !== uid || now() > end) { clearInterval(payWatch); return; }
    const ps = $('#payState'); if (ps && !ps.hidden) ps.textContent = T('payWait');
    await loadPro(uid);
    if ((PRO.until || 0) > before && isPro()) {
      clearInterval(payWatch);
      toast(T('payDone', { d: fmtDate(PRO.until) }));
      post({ t: 'pro', pro: proView() });
      if (VIEW.name === 'paywall') sendEnter(); else if (VIEW.name === 'center' && TAB === 'pro') drawTab();
    }
  }, 5000);
}
function paywall() {
  VIEW.name = 'paywall'; VIEW.redraw = paywall;
  const st = stage(`<img class="logo sm" src="logo.webp" alt="Drive Play" width="96" height="96">
    <span class="probadge">${ic('crown')}${T('proBadge')}</span>
    <h1>${T('proPage')}</h1><p class="sub">${esc(T('proPageS', { n: PAGE.label || T('proName') }))}</p>
    <div class="card">${proOffer()}</div>
    <p class="small mt" style="text-align:center"><a class="link" href="${SITE}" target="_top" rel="noopener">${T('toHome')}</a> · <button class="link" type="button" data-go="switch">${T('switchAcct')}</button></p>`);
  st.onclick = e => {
    const b = e.target.closest('[data-buy]'); if (b) { buy(b.dataset.buy, b); return; }
    const g = e.target.closest('[data-go]'); if (g && g.dataset.go === 'switch') picker(CUR.user, {});
  };
}
function tabPro(m) {
  const on = isPro();
  m.innerHTML = `<h2>${T('tPro')}</h2><p class="lead">${T('proS')}</p>
    <div class="sec prostat ${on ? 'on' : ''}"><span class="probadge">${ic('crown')}${T('proBadge')}</span><div><b>${on ? T('proOn') : T('proOff')}</b>${on ? `<small>${esc(T('proUntil', { d: fmtDate(PRO.until) }))}</small>` : ''}</div></div>
    <div class="sec">${proOffer()}</div>`;
  m.onclick = e => { const b = e.target.closest('[data-buy]'); if (b) buy(b.dataset.buy, b); };
  loadPro(CUR.uid).then(() => { if (VIEW.name === 'center' && TAB === 'pro' && isPro() !== on) drawTab(); });
}

/* ---------- entrance screens ---------- */
function splash(msg) {
  VIEW.name = 'splash'; VIEW.redraw = null;
  stage(`<img class="logo float" src="logo.webp" alt="Drive Play" width="220" height="220">
    <p class="page">${esc(PAGE.label || '')}</p>
    <div class="line" aria-hidden="true"><span></span></div>
    <p class="status" role="status">${esc(msg || T('loading'))}</p>`, { focus: false });
}
function welcome(note) {
  VIEW.name = 'welcome'; VIEW.redraw = () => welcome(note);
  const saved = D.order.map(u => D.accts[u]).filter(Boolean);
  const st = stage(`<img class="logo sm rise" src="logo.webp" alt="Drive Play" width="96" height="96">
    <h1 class="rise d1">${T('welcomeT')}</h1>
    <p class="sub rise d1">${REQUIRE_ACCOUNT ? T('welcomeReq') : T('welcomeS')}</p>
    <div class="card rise d2">
      ${note ? `<div class="err" role="alert">${esc(note)}</div>` : ''}
      ${saved.length ? `<p class="small muted" style="margin:0 0 8px">${T('savedHere')}</p><div class="accts">${saved.map(a => `<button class="acct" type="button" data-acct="${esc(a.uid)}">${avatar({ n: a.n || a.em, col: '#2F7BFF', img: a.img }, 'round')}<span class="who"><b>${esc(a.n || a.em)}</b><small>${esc(maskEmail(a.em))}</small></span><span class="tag ${a.rt ? '' : 'off'}">${a.rt ? T('connected') : (a.pv && a.pv !== 'password' ? PNAME[a.pv] : T('needPw'))}</span></button>`).join('')}</div><div class="sep">•</div>` : ''}
      <div class="err" id="wErr" role="alert" hidden></div>
      ${socialBlock()}
      <div class="col">
        <button class="btn pri block" type="button" data-go="signup">${T('signup')}</button>
        <button class="btn ghost block" type="button" data-go="signin">${T('signin')}</button>
      </div>
      <p class="hint" style="text-align:center;margin-top:12px">${T('socialAgree', { u: PRIVACY_URL })}</p>
      ${REQUIRE_ACCOUNT ? '' : `<div class="mt" style="text-align:center"><button class="link" type="button" data-go="guest">${T('guest')}</button><p class="hint" style="text-align:center">${T('guestNote')}</p></div>`}
    </div>`);
  st.onclick = e => {
    const s = e.target.closest('[data-soc]'); if (s) { socialSignIn(s.dataset.soc, s, $('#wErr')); return; }
    const a = e.target.closest('[data-acct]');
    if (a) { const ac = D.accts[a.dataset.acct]; if (ac && ac.rt) { D.cur = ac.uid; saveD(); startAccount(ac.uid, true); } else if (ac && ac.pv && ac.pv !== 'password') { const k = Object.keys(PID).find(x => PID[x] === ac.pv); socialSignIn(k, a, $('#wErr')); } else signin(ac && ac.em); return; }
    const g = e.target.closest('[data-go]'); if (!g) return;
    if (g.dataset.go === 'signup') signup(); else if (g.dataset.go === 'signin') signin(); else if (!REQUIRE_ACCOUNT) enterGuest();
  };
}
function formShell(title, sub, body) {
  return `<button class="back" type="button" data-go="welcome" aria-label="${T('back')}">${ic('back')}</button>
    <img class="logo sm" src="logo.webp" alt="Drive Play" width="96" height="96"><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : '<div style="height:10px"></div>'}
    <form class="card" novalidate>${body}</form>`;
}
function signin(email) {
  VIEW.name = 'signin'; VIEW.redraw = null;
  const st = stage(formShell(T('signinT'), '', `
    <div class="err" id="fErr" role="alert" hidden></div>
    ${email ? '' : socialBlock()}
    <label class="fld"><span>${T('email')}</span><input class="inp ltr" type="email" id="fEm" autocomplete="username" inputmode="email" required value="${esc(email || '')}"></label>
    ${pwField('fPw', T('password'), 'current-password', email ? 'autofocus' : '')}
    <div class="row between" style="margin:-4px 0 14px"><button class="link" type="button" data-go="forgot">${T('forgot')}</button></div>
    <button class="btn pri block" type="submit">${T('doSignin')}</button>
    <p class="small muted mt" style="text-align:center">${T('noAcct')} <button class="link" type="button" data-go="signup">${T('createIt')}</button></p>`), { fx: false });
  wireEyes(st);
  st.onclick = e => { const so = e.target.closest('[data-soc]'); if (so) { socialSignIn(so.dataset.soc, so, $('#fErr')); return; } const g = e.target.closest('[data-go]'); if (!g) return; if (g.dataset.go === 'welcome') welcome(); else if (g.dataset.go === 'signup') signup(); else forgot($('#fEm').value.trim()); };
  $('form', st).onsubmit = async e => {
    e.preventDefault();
    const em = $('#fEm').value.trim(), pw = $('#fPw').value, er = $('#fErr'), btn = $('button[type=submit]', st);
    er.hidden = true;
    const w = brake.wait(); if (w) { er.textContent = T('errLock', { s: w }); er.hidden = false; return; }
    if (!emailOk(em)) { er.textContent = T('errEmail'); er.hidden = false; $('#fEm').setAttribute('aria-invalid', 'true'); return; }
    if (!pw) { er.textContent = T('errCreds'); er.hidden = false; return; }
    busy(btn, true);
    try {
      const j = await authCall('signInWithPassword', { email: em, password: pw, returnSecureToken: true });
      brake.good(); const a = storeSession(j, { pv: 'password' }); D.cur = a.uid; saveD();
      await startAccount(a.uid, true, { justIn: true });
    } catch (x) { if (/INVALID_LOGIN|INVALID_PASSWORD|EMAIL_NOT_FOUND/.test(x.code)) brake.bad(); busy(btn, false); er.textContent = errMsg(x); er.hidden = false; }
  };
}
function signup() {
  VIEW.name = 'signup'; VIEW.redraw = null;
  const hasGuest = Object.keys(getKV('guest')).length > 0;
  const st = stage(formShell(T('signupT'), '', `
    <div class="err" id="fErr" role="alert" hidden></div>
    <label class="fld"><span>${T('name')}</span><input class="inp" id="fNm" maxlength="30" autocomplete="nickname" autofocus required></label>
    <label class="fld"><span>${T('email')}</span><input class="inp ltr" type="email" id="fEm" autocomplete="username" inputmode="email" required></label>
    ${pwField('fPw', T('password'), 'new-password')}
    <div class="meter" aria-hidden="true"><i id="fMt"></i></div>
    <ul class="reqs" id="fRq">${T('pwReq').map(r => `<li>${esc(r)}</li>`).join('')}</ul>
    <div style="height:10px"></div>
    ${pwField('fPw2', T('confirmPw'), 'new-password')}
    ${hasGuest ? `<label class="chk"><input type="checkbox" id="fMv" checked><span>${T('moveGuest')}</span></label>` : ''}
    <label class="chk"><input type="checkbox" id="fAg"><span>${T('agree', { u: PRIVACY_URL })}</span></label>
    <button class="btn pri block" type="submit">${T('create')}</button>
    <p class="small muted mt" style="text-align:center">${T('haveAcct')} <button class="link" type="button" data-go="signin">${T('signinIt')}</button></p>`), { fx: false });
  wireEyes(st);
  st.onclick = e => { const g = e.target.closest('[data-go]'); if (!g) return; if (g.dataset.go === 'welcome') welcome(); else signin(); };
  const pw = $('#fPw');
  pw.addEventListener('input', () => {
    const v = pw.value, r = pwRules(v), s = pwScore(v);
    $$('#fRq li').forEach((li, i) => li.classList.toggle('on', r[i]));
    const m = $('#fMt'); m.style.width = (v ? s * 25 : 0) + '%'; m.style.backgroundColor = ['#ff5a52', '#ff9f43', '#f5c518', '#3ddc6b'][s - 1] || 'transparent';
  });
  $('form', st).onsubmit = async e => {
    e.preventDefault();
    const nm = $('#fNm').value.trim(), em = $('#fEm').value.trim(), p1 = pw.value, p2 = $('#fPw2').value, er = $('#fErr'), btn = $('button[type=submit]', st);
    const fail = (m, el) => { er.textContent = m; er.hidden = false; if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); } };
    er.hidden = true; $$('[aria-invalid]', st).forEach(x => x.removeAttribute('aria-invalid'));
    if (!nm || nm.length > 30) return fail(T('errName'), $('#fNm'));
    if (!emailOk(em)) return fail(T('errEmail'), $('#fEm'));
    if (!pwRules(p1).every(Boolean)) return fail(T('errPw'), pw);
    if (p1 !== p2) return fail(T('errMatch'), $('#fPw2'));
    if (!$('#fAg').checked) return fail(T('errAgree'));
    busy(btn, true);
    try {
      const j = await authCall('signUp', { email: em, password: p1, returnSecureToken: true });
      const a = storeSession(j, { n: nm, pv: 'password' }); D.cur = a.uid; saveD();
      authCall('update', { idToken: j.idToken, displayName: nm, returnSecureToken: false }).catch(() => {});
      authCall('sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: j.idToken }).catch(() => {});
      const pid = 'p' + rid(8);
      const g = D.guest || {};
      const user = { n: nm, img: '', c: now(), ep: 0, P: [{ id: pid, n: nm, col: g.col || PCOLS[0], kids: false, img: '' }], L: [loginEntry()], v: 1 };
      await fsPatch(a.uid, 'users/' + a.uid, user);
      cacheUser(a.uid, user);
      const mv = $('#fMv') && $('#fMv').checked;
      if (mv) { const gkv = getKV('guest'); if (Object.keys(gkv).length) { await fsPatch(a.uid, 'users/' + a.uid + '/kv/' + pid, { d: gkv, u: now() }); setKVCache(a.uid, pid, gkv); LS.del('dpa_gkv'); } }
      D.prof[a.uid] = pid; saveD();
      await startAccount(a.uid, true, { justIn: true, isNew: true });
    } catch (x) { busy(btn, false); fail(errMsg(x)); }
  };
}
function forgot(email) {
  VIEW.name = 'forgot'; VIEW.redraw = null;
  const st = stage(formShell(T('forgotT'), T('forgotS'), `
    <div class="err" id="fErr" role="alert" hidden></div><div class="ok" id="fOk" role="status" hidden></div>
    <label class="fld"><span>${T('email')}</span><input class="inp ltr" type="email" id="fEm" autocomplete="username" inputmode="email" required autofocus value="${esc(email || '')}"></label>
    <button class="btn pri block" type="submit">${T('send')}</button>
    <p class="small mt" style="text-align:center"><button class="link" type="button" data-go="signin">${T('signinIt')}</button></p>`), { fx: false });
  st.onclick = e => { const g = e.target.closest('[data-go]'); if (!g) return; if (g.dataset.go === 'welcome') welcome(); else signin($('#fEm').value.trim()); };
  $('form', st).onsubmit = async e => {
    e.preventDefault();
    const em = $('#fEm').value.trim(), er = $('#fErr'), ok = $('#fOk'), btn = $('button[type=submit]', st);
    er.hidden = ok.hidden = true;
    if (!emailOk(em)) { er.textContent = T('errEmail'); er.hidden = false; return; }
    busy(btn, true);
    try { await authCall('sendOobCode', { requestType: 'PASSWORD_RESET', email: em }); ok.textContent = T('sent'); ok.hidden = false; }
    catch (x) { if (/EMAIL_NOT_FOUND/.test(x.code)) { ok.textContent = T('sent'); ok.hidden = false; } else { er.textContent = errMsg(x); er.hidden = false; } }
    busy(btn, false);
  };
}
function loginEntry() { const d = devInfo(); return { at: now(), d: [d.os, d.br].filter(Boolean).join(' · ') || T('unknownDev'), k: d.kind }; }

/* ---------- sign-in with Google / Apple / Facebook ----------
   The Firebase SDK opens the provider's window and returns a normal Firebase
   session, which is then kept exactly like an email sign-in (REST tokens).
   The SDK is loaded ahead of time so the click opens the window at once. */
const PNAME = { google: 'Google', apple: 'Apple', facebook: 'Facebook', 'google.com': 'Google', 'apple.com': 'Apple', 'facebook.com': 'Facebook', password: 'Email' };
const PID = { google: 'google.com', apple: 'apple.com', facebook: 'facebook.com' };
let FBP = null;
function loadSdk() {
  if (!FBP) FBP = Promise.all([import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app.js`), import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-auth.js`)]).then(([A, M]) => {
    const app = A.initializeApp({ apiKey: CFG.key, authDomain: AUTH_DOMAIN, projectId: CFG.project }, 'dp-social');
    const auth = M.initializeAuth(app, { persistence: M.inMemoryPersistence, popupRedirectResolver: M.browserPopupRedirectResolver });
    try { auth.languageCode = LANG; } catch (e) {}
    return { auth, M };
  }).catch(e => { FBP = null; throw e; });
  return FBP;
}
function provider(M, k) {
  if (k === 'google') { const p = new M.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); return p; }
  if (k === 'facebook') { const p = new M.FacebookAuthProvider(); p.addScope('email'); return p; }
  const p = new M.OAuthProvider('apple.com'); p.addScope('email'); p.addScope('name'); if (LANG) p.setCustomParameters({ locale: LANG === 'he' ? 'he_IL' : LANG }); return p;
}
function socialErr(e) {
  const c = (e && e.code) || '';
  if (/popup-closed|cancelled-popup|user-cancelled/.test(c)) return '';
  if (/popup-blocked/.test(c)) return T('errPopup');
  if (/account-exists-with-different-credential|credential-already-in-use|email-already-in-use/.test(c)) return T('errOtherMethod');
  if (/operation-not-allowed|unauthorized-domain|invalid-oauth|configuration-not-found|admin-restricted/.test(c)) return T('errNotEnabled');
  if (/network|internal-error/.test(c)) return T('errNet');
  if (/user-disabled/.test(c)) return T('errDisabled');
  if (/too-many-requests/.test(c)) return T('errMany');
  return e && e.code ? T('errGeneric') : T('errSdk');
}
/* opens the provider's window and returns a session in the same shape as the REST sign-in */
async function socialPopup(k) {
  const { auth, M } = await loadSdk();
  const res = await M.signInWithPopup(auth, provider(M, k));
  const u = res.user, info = M.getAdditionalUserInfo(res) || {};
  const j = { localId: u.uid, email: u.email || (u.providerData[0] && u.providerData[0].email) || '', idToken: await u.getIdToken(), refreshToken: u.refreshToken, expiresIn: 3600 };
  const nm = String(u.displayName || (u.providerData[0] && u.providerData[0].displayName) || j.email.split('@')[0] || '').trim().slice(0, 30);
  M.signOut(auth).catch(() => {});
  return { j, nm, isNew: !!info.isNewUser };
}
async function socialSignIn(k, btn, er) {
  if (er) er.hidden = true;
  busy(btn, true);
  try {
    const { j, nm } = await socialPopup(k);
    const a = storeSession(j, { n: nm, pv: PID[k] }); D.cur = a.uid; saveD();
    let user = await fsGet(a.uid, 'users/' + a.uid).catch(() => null);
    const isNew = !user;
    if (isNew) {
      const pid = 'p' + rid(8), g = D.guest || {};
      user = { n: nm || 'Drive Play', img: '', c: now(), ep: 0, P: [{ id: pid, n: nm || 'Drive Play', col: g.col || PCOLS[0], kids: false, img: '' }], L: [loginEntry()], v: 1 };
      await fsPatch(a.uid, 'users/' + a.uid, user);
      cacheUser(a.uid, user);
      const gkv = getKV('guest'); if (Object.keys(gkv).length) { await fsPatch(a.uid, 'users/' + a.uid + '/kv/' + pid, { d: gkv, u: now() }).catch(() => {}); setKVCache(a.uid, pid, gkv); LS.del('dpa_gkv'); }
      D.prof[a.uid] = pid; saveD();
    }
    await startAccount(a.uid, true, { justIn: true, isNew });
  } catch (x) {
    busy(btn, false);
    const m = socialErr(x); if (m && er) { er.textContent = m; er.hidden = false; }
  }
}
const socialButtons = (list = SOCIAL) => `<div class="col soc">${list.map(k => `<button class="btn block sbtn ${k}" type="button" data-soc="${k}">${BRAND[k]}<span>${T('with' + k[0].toUpperCase() + k.slice(1))}</span></button>`).join('')}</div>`;
/* Only show the providers that are actually switched on in Firebase, so nobody meets a button that cannot work.
   Firebase answers createAuthUri only for an enabled provider on an authorized domain. Checked once an hour. */
const SOC_KEY = 'dpa_soc';
let SOC_ON = (() => { const c = LS.get(SOC_KEY, null); return c && c.t > now() - 3600000 && Array.isArray(c.on) ? c.on.filter(k => SOCIAL.includes(k)) : null; })();
let socP = null;
function probeSocial() {
  if (SOC_ON) return Promise.resolve(SOC_ON);
  if (!socP) {
    let sure = true;
    socP = Promise.all(SOCIAL.map(k => authCall('createAuthUri', { providerId: PID[k], continueUri: location.origin + location.pathname })
      .then(j => (j && j.authUri ? k : null))
      .catch(e => { if (!(e instanceof ApiErr) || !e.status || e.status >= 500) sure = false; return null; })))
      .then(r => { const on = r.filter(Boolean); if (sure) { SOC_ON = on; LS.set(SOC_KEY, { t: now(), on }); } socP = null; return on; });
  }
  return socP;
}
/* the social buttons plus the "or with email" line; filled in as soon as we know which providers are on */
function socialBlock() {
  const inner = list => list.length ? socialButtons(list) + `<div class="sep">${T('orEmail')}</div>` : '';
  if (!SOC_ON) probeSocial().then(on => { const b = $('#socBlk'); if (b && !b.dataset.done) { b.dataset.done = 1; b.innerHTML = inner(on); if (on.length) loadSdk().catch(() => {}); } });
  else if (SOC_ON.length) loadSdk().catch(() => {});
  return `<div id="socBlk"${SOC_ON ? ' data-done="1"' : ''}>${SOC_ON ? inner(SOC_ON) : ''}</div>`;
}

/* who is watching */
function picker(user, opts = {}) {
  VIEW.name = 'picker'; VIEW.redraw = () => picker(CUR.user, opts);
  const profs = (user.P || []);
  const st = stage(`<h1 class="who-h">${T('whoT')}</h1>
    <div class="profs" id="pList">${profs.map((p, i) => `<button class="prof" type="button" data-pid="${esc(p.id)}" style="--i:${i}"><span style="position:relative;width:100%">${avatar(p)}${p.kids ? `<span class="bdg">${T('kids')}</span>` : ''}${p.pin ? `<span class="lock">${ic('lock')}</span>` : ''}</span><span class="pn">${esc(p.n)}</span></button>`).join('')}
      ${profs.length < MAX_PROFILES && !(CUR.prof && CUR.prof.kids && opts.fromPage) ? `<button class="prof add" type="button" data-pid="+" style="--i:${profs.length}"><span style="position:relative;width:100%"><span class="av">+</span></span><span class="pn">${T('newProf')}</span></button>` : ''}</div>
    <div class="who-foot">
      ${!(CUR.prof && CUR.prof.kids && opts.fromPage) ? `<button class="btn ghost sm" type="button" data-go="manage">${T('manage')}</button>` : ''}
      <span class="who-acct">${avatar({ n: user.n, img: user.img, col: '#2F7BFF' }, 'round')}<span>${esc(user.n || '')}</span></span>
      ${!(CUR.prof && CUR.prof.kids && opts.fromPage) ? `<button class="link" type="button" data-go="switch">${T('switchAcct')}</button>` : ''}
      ${opts.fromPage ? `<button class="link" type="button" data-go="close">${T('close')}</button>` : ''}
    </div>`, { wide: true, dim: !!opts.fromPage });
  const list = $('#pList');
  st.onclick = async e => {
    const g = e.target.closest('[data-go]');
    if (g) {
      if (g.dataset.go === 'manage') { list.classList.toggle('manage'); g.textContent = list.classList.contains('manage') ? T('done') : T('manage'); }
      else if (g.dataset.go === 'switch') { D.cur = null; saveD(); SS.del('dpa_visit'); welcome(); }
      else if (g.dataset.go === 'close') { hideAll(); ui(false); }
      return;
    }
    const b = e.target.closest('[data-pid]'); if (!b) return;
    if (b.dataset.pid === '+') { editProfile(null, () => picker(CUR.user, opts)); return; }
    const p = profs.find(x => x.id === b.dataset.pid); if (!p) return;
    if (list.classList.contains('manage')) { editProfile(p, () => picker(CUR.user, opts)); return; }
    if (p.pin && !(await askPin(p))) { picker(CUR.user, opts); return; }
    choose(p, opts);
  };
  const first = $('.prof', st); if (first) setTimeout(() => first.focus({ preventScroll: true }), 120);
}
async function choose(p, opts = {}) {
  const uid = CUR.uid;
  D.prof[uid] = p.id; saveD();
  if (opts.fromPage) { SS.set('dpa_visit', { u: uid, p: p.id }); reloadPage(); return; }
  CUR.prof = p;
  splash(T('entering'));
  CUR.kv = getKV(uid, p.id);
  try { CUR.kv = await withTimeout(fetchKV(uid, p.id), 5000); setKVCache(uid, p.id, CUR.kv); } catch (e) {}
  await loadPro(uid);
  sendEnter();
}
function askPin(p) {
  return new Promise(res => {
    const m = modal(`<div style="text-align:center">${avatar(p, 'lg')}</div><h2 style="text-align:center;margin-top:10px">${T('pinT')}</h2><p class="muted" style="text-align:center;margin:4px 0 0">${esc(T('pinS', { n: p.n }))}</p>
      <div class="pin">${[0, 1, 2, 3].map(i => `<input inputmode="numeric" maxlength="1" pattern="[0-9]" aria-label="${i + 1}" ${i ? '' : 'autofocus'}>`).join('')}</div>
      <div class="err" id="pErr" hidden style="text-align:center">${T('pinBad')}</div>
      <div class="row end"><button class="btn ghost" type="button" data-a="no">${T('cancel')}</button></div>`);
    const ins = $$('.pin input', m);
    ins.forEach((inp, i) => {
      inp.addEventListener('input', async () => {
        inp.value = inp.value.replace(/\D/g, '').slice(-1);
        if (inp.value && i < 3) ins[i + 1].focus();
        const code = ins.map(x => x.value).join('');
        if (code.length === 4) {
          const ok = (await pinHash(CUR.uid, p.id, code)) === p.pin;
          if (ok) { closeModal(); res(true); } else { brake.bad(); $('#pErr').hidden = false; ins.forEach(x => { x.value = ''; }); ins[0].focus(); }
        }
      });
      inp.addEventListener('keydown', e => { if (e.key === 'Backspace' && !inp.value && i) ins[i - 1].focus(); });
    });
    m.addEventListener('click', e => { if (e.target.closest('[data-a=no]')) { closeModal(); res(false); } });
  });
}
async function pinHash(uid, pid, pin) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('dp-pin:' + uid + ':' + pid + ':' + pin)); return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join(''); }
async function readPhoto(file) {
  if (!file || !/^image\//.test(file.type) || file.size > 15e6) throw new Error('img');
  const bmp = await createImageBitmap(file);
  const S = 192, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'); const s = Math.min(bmp.width, bmp.height);
  x.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, S, S);
  let q = .85, url = c.toDataURL('image/webp', q);
  if (!/^data:image\/webp/.test(url)) url = c.toDataURL('image/jpeg', q);
  while (url.length > 45000 && q > .4) { q -= .15; url = c.toDataURL(/webp/.test(url) ? 'image/webp' : 'image/jpeg', q); }
  if (url.length > 60000) throw new Error('img');
  return url;
}
function editProfile(p, back) {
  const isNew = !p;
  const user = CUR.user; const list = user.P || [];
  const ed = { n: p ? p.n : '', col: p ? p.col : PCOLS[list.length % PCOLS.length], kids: p ? !!p.kids : false, img: p ? p.img || '' : '', pin: p ? p.pin || '' : '', newPin: null };
  const m = modal(`<h2>${isNew ? T('profNew') : T('profEdit')}</h2><div style="height:12px"></div>
    <div class="photo-row"><span id="eAv">${avatar({ n: ed.n || '?', col: ed.col, img: ed.img }, 'lg')}</span>
      <div class="col" style="gap:6px;align-items:flex-start"><label class="btn ghost sm" style="cursor:pointer">${ic('cam')}${T('upload')}<input type="file" accept="image/*" id="eFile" class="sr"></label>
      <button class="link small" type="button" id="eNoImg" ${ed.img ? '' : 'hidden'}>${T('removePhoto')}</button></div></div>
    <label class="fld"><span>${T('profName')}</span><input class="inp" id="eNm" maxlength="20" value="${esc(ed.n)}" autofocus></label>
    <div class="fld"><span>${T('color')}</span><div class="sw" id="eSw">${PCOLS.map(c => `<button type="button" style="--c:${c}" data-c="${c}" aria-label="${c}" aria-pressed="${c === ed.col}"></button>`).join('')}</div></div>
    <div class="tg"><span><b>${T('kidsT')}</b><small>${T('kidsS')}</small></span><span class="sw-t"><input type="checkbox" id="eKids" ${ed.kids ? 'checked' : ''}><i></i></span></div>
    <div class="tg"><span><b>${T('pinOn')}</b><small>${T('pinOnS')}</small></span><span class="sw-t"><input type="checkbox" id="ePinOn" ${ed.pin ? 'checked' : ''}><i></i></span></div>
    <div id="ePinBox" hidden><div class="pin">${[0, 1, 2, 3].map(i => `<input inputmode="numeric" maxlength="1" aria-label="${i + 1}">`).join('')}</div></div>
    <div class="err" id="eErr" hidden></div>
    <div class="row between wrap mt">${!isNew && list.length > 1 ? `<button class="btn danger sm" type="button" data-a="del">${ic('trash')}${T('delProf')}</button>` : '<span></span>'}
      <span class="row"><button class="btn ghost" type="button" data-a="no">${T('cancel')}</button><button class="btn pri" type="button" data-a="ok">${T('save')}</button></span></div>`);
  const redrawAv = () => { $('#eAv', m).innerHTML = avatar({ n: $('#eNm', m).value || '?', col: ed.col, img: ed.img }, 'lg'); $('#eNoImg', m).hidden = !ed.img; };
  $('#eNm', m).addEventListener('input', redrawAv);
  $('#eSw', m).addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; ed.col = b.dataset.c; $$('#eSw button', m).forEach(x => x.setAttribute('aria-pressed', x === b)); redrawAv(); });
  $('#eFile', m).addEventListener('change', async e => { try { ed.img = await readPhoto(e.target.files[0]); redrawAv(); } catch (x) { $('#eErr', m).textContent = T('imgBad'); $('#eErr', m).hidden = false; } e.target.value = ''; });
  $('#eNoImg', m).addEventListener('click', () => { ed.img = ''; redrawAv(); });
  const pinIns = $$('#ePinBox input', m);
  pinIns.forEach((inp, i) => { inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(-1); if (inp.value && i < 3) pinIns[i + 1].focus(); }); inp.addEventListener('keydown', e => { if (e.key === 'Backspace' && !inp.value && i) pinIns[i - 1].focus(); }); });
  $('#ePinOn', m).addEventListener('change', e => { $('#ePinBox', m).hidden = !e.target.checked; if (e.target.checked) pinIns[0].focus(); });
  m.addEventListener('click', async e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'no') { closeModal(); if (back) back(); return; }
    if (b.dataset.a === 'del') {
      closeModal();
      const ok = await ask(T('delProfQ', { n: p.n }), { title: T('delProf'), yes: T('delete'), danger: true }); if (!ok) { if (back) back(); return; }
      const P2 = list.filter(x => x.id !== p.id);
      try { await saveUser(CUR.uid, { P: P2 }); await fsDel(CUR.uid, 'users/' + CUR.uid + '/kv/' + p.id); await fsDel(CUR.uid, 'users/' + CUR.uid + '/stats/' + p.id); LS.del(kvKey(CUR.uid, p.id)); toast(T('saved')); }
      catch (x) { toast(errMsg(x)); }
      if (CUR.prof && CUR.prof.id === p.id) { D.prof[CUR.uid] = P2[0].id; saveD(); SS.set('dpa_visit', { u: CUR.uid, p: P2[0].id }); if (ENTERED) { reloadPage(); return; } CUR.prof = P2[0]; }
      if (back) back(); return;
    }
    const n = $('#eNm', m).value.trim();
    if (!n) { $('#eErr', m).textContent = T('errName'); $('#eErr', m).hidden = false; return; }
    let pin = ed.pin;
    const code = pinIns.map(x => x.value).join('');
    if ($('#ePinOn', m).checked) {
      if ((code || !pin) && !/^\d{4}$/.test(code)) { $('#ePinBox', m).hidden = false; $('#eErr', m).textContent = T('pinS', { n }); $('#eErr', m).hidden = false; pinIns[0].focus(); return; }
    } else pin = '';
    busy(b, true);
    const id = p ? p.id : 'p' + rid(8);
    if ($('#ePinOn', m).checked && code) pin = await pinHash(CUR.uid, id, code);
    const np = { id, n: n.slice(0, 20), col: ed.col, kids: $('#eKids', m).checked, img: ed.img || '', pin: pin || '' };
    const P2 = p ? list.map(x => x.id === id ? np : x) : [...list, np];
    try {
      await saveUser(CUR.uid, { P: P2 });
      closeModal(); toast(T('saved'));
      const affectsPage = ENTERED && CUR.prof && CUR.prof.id === id && (np.kids !== !!CUR.prof.kids || np.n !== CUR.prof.n || np.img !== (CUR.prof.img || '') || np.col !== CUR.prof.col);
      if (CUR.prof && CUR.prof.id === id) CUR.prof = np;
      if (affectsPage) { post({ t: 'prof', prof: profView(np) }); if (np.kids !== !!(p && p.kids)) { reloadPage(); return; } }
      if (back) back();
    } catch (x) { busy(b, false); $('#eErr', m).textContent = errMsg(x); $('#eErr', m).hidden = false; }
  });
}

/* ---------- account center ---------- */
let TAB = 'profiles';
function center(tab) {
  if (!CUR) return;
  if (CUR.type === 'acct' && CUR.prof && CUR.prof.kids && tab !== 'switch') { picker(CUR.user, { fromPage: true }); toast(T('kidsLocked')); return; }
  if (tab === 'switch') { if (CUR.type === 'acct') { picker(CUR.user, { fromPage: true }); return; } tab = 'account'; }
  hideStage();
  TAB = tab || TAB || 'profiles';
  if (!PRO_ENABLED && TAB === 'pro') TAB = 'profiles';
  if (CUR.type === 'guest' && !['account', 'stats', 'privacy'].includes(TAB)) TAB = 'account';
  VIEW.name = 'center'; VIEW.redraw = () => center(TAB);
  let c = $('#center'); if (!c) { c = document.createElement('div'); c.id = 'center'; document.body.appendChild(c); }
  c.hidden = false; ui(true);
  const g = CUR.type === 'guest'; const u = CUR.user || {}; const a = g ? null : D.accts[CUR.uid];
  const tabs = g ? [['account', 'user', T('tAccount')], ['stats', 'chart', T('tStats')], ['privacy', 'shield', T('tPrivacy')]]
    : [...(PRO_ENABLED ? [['pro', 'crown', T('tPro')]] : []), ['profiles', 'people', T('tProfiles')], ['account', 'user', T('tAccount')], ['stats', 'chart', T('tStats')], ['devices', 'device', T('tDevices')], ['privacy', 'shield', T('tPrivacy')]];
  c.innerHTML = `<div class="panel" role="dialog" aria-modal="true" aria-label="${T('center')}">
    <nav class="side" role="tablist" aria-label="${T('center')}">
      <div class="me">${g ? avatar({ n: '?', col: '#475569' }, 'round') : avatar({ n: u.n, img: u.img, col: '#2F7BFF' }, 'round')}<div class="who"><b>${esc(g ? T('guestT') : u.n || '')}</b><small dir="ltr">${esc(g ? '' : (a && a.em) || '')}</small></div></div>
      ${tabs.map(t => `<button class="tab" role="tab" type="button" data-tab="${t[0]}" aria-selected="${t[0] === TAB}">${ic(t[1])}${t[2]}</button>`).join('')}
      <span class="spacer"></span>
      ${g ? '' : `<button class="tab foot" type="button" data-act="signout">${ic('out')}${T('signout')}</button>`}
    </nav>
    <section class="main" id="cMain" role="tabpanel" tabindex="-1"></section>
    <button class="x" type="button" data-act="close" aria-label="${T('close')}">${ic('close')}</button>
  </div>`;
  c.onclick = e => {
    if (e.target === c) { closeCenter(); return; }
    const t = e.target.closest('[data-tab]'); if (t) { TAB = t.dataset.tab; $$('.tab', c).forEach(x => x.setAttribute('aria-selected', x === t)); drawTab(); return; }
    const act = e.target.closest('[data-act]'); if (!act) return;
    if (act.dataset.act === 'close') closeCenter(); else if (act.dataset.act === 'signout') signOut();
  };
  drawTab();
}
function closeCenter() { hideCenter(); ui(false); }
function drawTab() {
  const m = $('#cMain'); if (!m) return;
  m.scrollTop = 0;
  ({ pro: tabPro, profiles: tabProfiles, account: tabAccount, stats: tabStats, devices: tabDevices, privacy: tabPrivacy })[TAB](m);
}
function tabProfiles(m) {
  const list = CUR.user.P || [];
  m.innerHTML = `<h2>${T('tProfiles')}</h2><p class="lead">${T('profilesS')}</p>
    <div class="mprofs">${list.map(p => `<button class="mprof ${CUR.prof && p.id === CUR.prof.id ? 'cur' : ''}" type="button" data-pid="${esc(p.id)}">${avatar(p)}<b>${esc(p.n)}</b><small>${CUR.prof && p.id === CUR.prof.id ? T('current') : [p.kids ? T('kids') : '', p.pin ? T('pinOn') : ''].filter(Boolean).join(' · ') || '&nbsp;'}</small></button>`).join('')}
      ${list.length < MAX_PROFILES ? `<button class="mprof" type="button" data-pid="+"><span class="av" style="background:rgba(255,255,255,.05);border:2px dashed rgba(255,255,255,.3)">+</span><b>${T('newProf')}</b><small>&nbsp;</small></button>` : ''}</div>
    <div class="row wrap mt2"><button class="btn ghost sm" type="button" data-x="switch">${ic('swap')}${T('switchTo')}</button></div>`;
  m.onclick = e => {
    if (e.target.closest('[data-x=switch]')) { picker(CUR.user, { fromPage: true }); return; }
    const b = e.target.closest('[data-pid]'); if (!b) return;
    const p = list.find(x => x.id === b.dataset.pid);
    editProfile(p || null, () => center('profiles'));
  };
}
function tabAccount(m) {
  if (CUR.type === 'guest') {
    m.innerHTML = `<h2>${T('guestT')}</h2><p class="lead">${T('guestS')}</p>
      <div class="sec"><div class="col" style="max-width:360px"><button class="btn pri" type="button" data-x="up">${T('signup')}</button><button class="btn ghost" type="button" data-x="in">${T('signin')}</button></div></div>
      <div class="sec danger"><h3>${T('guestClear')}</h3><p class="d">${T('guestClearQ')}</p><button class="btn danger sm" type="button" data-x="clr">${ic('trash')}${T('guestClear')}</button></div>`;
    m.onclick = async e => {
      const x = e.target.closest('[data-x]'); if (!x) return;
      if (x.dataset.x === 'up') { hideCenter(); signup(); } else if (x.dataset.x === 'in') { hideCenter(); signin(); }
      else if (x.dataset.x === 'clr') { if (!(await ask(T('guestClearQ'), { title: T('guestClear'), yes: T('delete'), danger: true }))) return; LS.del('dpa_gkv'); D.guest = null; saveD(); CUR.kv = {}; toast(T('cleared')); reloadPage(); }
    };
    return;
  }
  const u = CUR.user, a = D.accts[CUR.uid];
  m.innerHTML = `<h2>${T('tAccount')}</h2><p class="lead">${T('acctS')}</p>
    <div class="sec"><div class="photo-row">${avatar({ n: u.n, img: u.img, col: '#2F7BFF' }, 'lg round')}<div class="col" style="gap:6px;align-items:flex-start"><label class="btn ghost sm" style="cursor:pointer">${ic('cam')}${T('upload')}<input type="file" accept="image/*" id="aFile" class="sr"></label>${u.img ? `<button class="link small" type="button" data-x="noimg">${T('removePhoto')}</button>` : ''}</div></div>
      <label class="fld"><span>${T('acctName')}</span><div class="row"><input class="inp" id="aNm" maxlength="30" value="${esc(u.n || '')}"><button class="btn sm" type="button" data-x="name">${T('save')}</button></div></label>
      <div class="fld"><span>${T('email')}</span><div class="row wrap"><span dir="ltr" style="font-weight:600">${esc(a.em || '')}</span><span class="chip" id="aVer">…</span><span class="chip" id="aVia" hidden></span><button class="link small" type="button" data-x="verify" hidden id="aVerB">${T('resend')}</button></div></div></div>
    <div class="sec" id="aPwSec" ${a.pv && a.pv !== 'password' ? 'hidden' : ''}><h3>${T('changePw')}</h3>
      <form id="aPwF" novalidate style="max-width:380px"><div class="err" id="aPwE" hidden></div><div class="ok" id="aPwO" hidden></div>
      <input type="text" autocomplete="username" value="${esc(a.em || '')}" hidden>
      ${pwField('aPw0', T('curPw'), 'current-password')}${pwField('aPw1', T('newPw'), 'new-password')}
      <ul class="reqs" id="aRq">${T('pwReq').map(r => `<li>${esc(r)}</li>`).join('')}</ul><div style="height:10px"></div>
      <button class="btn pri sm" type="submit">${ic('key')}${T('changePw')}</button></form></div>
    <div class="sec"><h3>${T('signout')}</h3><p class="d">${T('signoutS')}</p><div class="row wrap">
      <button class="btn ghost sm" type="button" data-x="out">${ic('out')}${T('signout')}</button>
      <button class="btn ghost sm" type="button" data-x="outall">${T('signoutAll')}</button>
      <button class="btn ghost sm" type="button" data-x="switch">${ic('swap')}${T('switchAcct')}</button>
      <button class="btn ghost sm" type="button" data-x="add">${ic('plus')}${T('addAcct')}</button></div></div>
    <div class="sec danger"><h3>${T('dangerT')}</h3><p class="d">${T('dangerS')}</p><button class="btn danger sm" type="button" data-x="del">${ic('trash')}${T('delAcct')}</button></div>`;
  wireEyes(m);
  idToken(CUR.uid).then(t => authCall('lookup', { idToken: t })).then(j => { const us = j.users && j.users[0]; const v = us && us.emailVerified; const pvs = ((us && us.providerUserInfo) || []).map(x => x.providerId); if (pvs.length) { a.pvs = pvs; if (!a.pv) a.pv = pvs.includes('password') ? 'password' : pvs[0]; saveD(); const ps = $('#aPwSec'); if (ps) ps.hidden = !pvs.includes('password'); const sp = $('#aVia'); if (sp) { sp.textContent = T('viaProvider', { p: pvs.map(x => PNAME[x] || x).join(' + ') }); sp.hidden = false; } } const ch = $('#aVer'); if (!ch) return; ch.textContent = v ? T('verified') : T('notVerified'); ch.className = 'chip ' + (v ? 'g' : 'y'); $('#aVerB').hidden = !!v; }).catch(() => { const ch = $('#aVer'); if (ch) ch.hidden = true; });
  const p1 = $('#aPw1'); p1.addEventListener('input', () => { const r = pwRules(p1.value); $$('#aRq li').forEach((li, i) => li.classList.toggle('on', r[i])); });
  $('#aFile').addEventListener('change', async e => { try { const img = await readPhoto(e.target.files[0]); await saveUser(CUR.uid, { img }); toast(T('saved')); post({ t: 'acct', acct: acctView() }); drawTab(); } catch (x) { toast(x.message === 'img' ? T('imgBad') : errMsg(x)); } });
  $('#aPwF').onsubmit = async e => {
    e.preventDefault(); const er = $('#aPwE'), ok = $('#aPwO'), btn = $('#aPwF button[type=submit]'); er.hidden = ok.hidden = true;
    const w = brake.wait(); if (w) { er.textContent = T('errLock', { s: w }); er.hidden = false; return; }
    if (!pwRules(p1.value).every(Boolean)) { er.textContent = T('errPw'); er.hidden = false; return; }
    busy(btn, true);
    try {
      const j = await authCall('signInWithPassword', { email: a.em, password: $('#aPw0').value, returnSecureToken: true }); brake.good();
      const k = await authCall('update', { idToken: j.idToken, password: p1.value, returnSecureToken: true });
      storeSession({ localId: CUR.uid, email: a.em, idToken: k.idToken, refreshToken: k.refreshToken, expiresIn: k.expiresIn });
      ok.textContent = T('pwChanged'); ok.hidden = false; $('#aPw0').value = p1.value = '';
    } catch (x) { if (/INVALID_LOGIN|INVALID_PASSWORD/.test(x.code)) brake.bad(); er.textContent = errMsg(x); er.hidden = false; }
    busy(btn, false);
  };
  m.onclick = async e => {
    const x = e.target.closest('[data-x]'); if (!x) return;
    const k = x.dataset.x;
    if (k === 'name') { const n = $('#aNm').value.trim(); if (!n) return; try { await saveUser(CUR.uid, { n: n.slice(0, 30) }); idToken(CUR.uid).then(t => authCall('update', { idToken: t, displayName: n })).catch(() => {}); toast(T('saved')); post({ t: 'acct', acct: acctView() }); center('account'); } catch (er) { toast(errMsg(er)); } }
    else if (k === 'noimg') { await saveUser(CUR.uid, { img: '' }).catch(er => toast(errMsg(er))); post({ t: 'acct', acct: acctView() }); drawTab(); }
    else if (k === 'verify') { try { await authCall('sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: await idToken(CUR.uid) }); toast(T('verifySent')); } catch (er) { toast(errMsg(er)); } }
    else if (k === 'out') signOut();
    else if (k === 'outall') signOutAll();
    else if (k === 'switch') { hideCenter(); welcome(); }
    else if (k === 'add') { hideCenter(); signin(); }
    else if (k === 'del') deleteAccount();
  };
}
async function signOut(silent) {
  if (CUR && CUR.type === 'acct') {
    const uid = CUR.uid, a = D.accts[uid];
    await flushKV(); await flushStats();
    if (a && a.sid) fsDel(uid, 'users/' + uid + '/sessions/' + a.sid).catch(() => {});
    if (a) a.rt = null; delete TOK[uid];
  }
  D.cur = null; saveD(); SS.del('dpa_visit');
  if (!silent) reloadPage();
}
async function signOutAll() {
  if (!(await ask(T('signoutAllQ'), { title: T('signoutAll'), yes: T('signoutAll') }))) return;
  const uid = CUR.uid, a = D.accts[uid];
  try {
    await fsCommitReal(uid, [{ update: { name: DOCNAME('users/' + uid), fields: {} }, updateMask: { fieldPaths: [] }, updateTransforms: [{ fieldPath: 'ep', increment: { integerValue: '1' } }] }]);
    const u = await loadUser(uid, true); a.ep = (u && u.ep) || 0; saveD();
    const ss = await fsList(uid, 'users/' + uid + '/sessions');
    await Promise.all(ss.filter(s => s.id !== a.sid).map(s => fsDel(uid, 'users/' + uid + '/sessions/' + s.id)));
    toast(T('signoutAllDone')); if (TAB === 'devices') drawTab();
  } catch (x) { toast(errMsg(x)); }
}
async function deleteAccount() {
  const uid = CUR.uid, a = D.accts[uid];
  const pwd = !a.pv || a.pv === 'password' || (a.pvs || []).includes('password');
  const sk = pwd ? null : Object.keys(PID).find(x => PID[x] === a.pv);
  if (sk) loadSdk().catch(() => {});
  const r = await ask(sk ? T('reauthQ', { p: PNAME[sk] }) : T('delAcctQ'), { title: T('delAcct'), yes: T('delete'), danger: true, pw: !sk, word: T('delWord'), wordLabel: T('delWord'),
    check: async v => {
      try {
        if (sk) { const { j } = await socialPopup(sk); if (j.localId !== uid) return T('errCreds'); storeSession(j); return null; }
        const j = await authCall('signInWithPassword', { email: a.em, password: v.pw, returnSecureToken: true }); storeSession(j); return null;
      } catch (x) { return sk ? (socialErr(x) || T('errGeneric')) : errMsg(x); }
    } });
  if (!r) return;
  try {
    splash(T('loading'));
    for (const sub of ['kv', 'stats', 'sessions']) { const docs = await fsList(uid, 'users/' + uid + '/' + sub); await Promise.all(docs.map(d => fsDel(uid, 'users/' + uid + '/' + sub + '/' + d.id))); }
    await fsDel(uid, 'users/' + uid);
    await authCall('delete', { idToken: await idToken(uid, true) });
    for (const k of Object.keys(localStorage)) if (k.includes(uid)) LS.del(k);
    delete D.accts[uid]; D.order = D.order.filter(x => x !== uid); delete D.prof[uid]; D.cur = null; saveD(); SS.del('dpa_visit'); CUR = null; pendKV = {};
    toast(T('delDone')); setTimeout(() => reloadPage(), 900);
  } catch (x) { toast(errMsg(x)); center('account'); }
}
async function tabStats(m) {
  const g = CUR.type === 'guest';
  m.innerHTML = `<h2>${T('tStats')}</h2><p class="lead">${esc(T('statsS', { n: g ? T('guest') : CUR.prof.n }))}</p><div class="sec" style="text-align:center"><span class="spin"></span></div>`;
  let st;
  try { await flushStats(); st = g ? (guestData().st || newStats()) : (await fsGet(CUR.uid, 'users/' + CUR.uid + '/stats/' + CUR.prof.id)) || newStats(); }
  catch (e) { st = newStats(); }
  if (TAB !== 'stats') return;
  st.D = st.D || {}; st.pg = st.pg || {};
  const days = []; for (let i = 6; i >= 0; i--) { const t = now() - i * 864e5; const k = day(t); days.push({ k, wd: new Date(t).getDay(), w: (st.D[k] && st.D[k].w) || 0, s: (st.D[k] && st.D[k].s) || 0 }); }
  const max = Math.max(60, ...days.map(d => d.w + d.s));
  const weekW = days.reduce((a, d) => a + d.w, 0);
  let streak = 0; for (let i = 0; i < 400; i++) { const k = day(now() - i * 864e5); const v = st.D[k]; if (v && (v.w || v.s)) streak++; else if (i) break; }
  const kv = CUR.kv || {}; let nList = 0; try { nList += (JSON.parse(kv.dp_watchlist_backup || '[]') || []).length; } catch (e) {} try { (JSON.parse(kv.dp_yt_lists || '[]') || []).forEach(l => { nList += (l.items || []).length; }); } catch (e) {}
  let nChats = 0; try { const b = JSON.parse(kv.cineai_v2 || 'null'); nChats = b && Array.isArray(b.chats) ? b.chats.length : 0; } catch (e) {}
  const bytes = Object.keys(kv).reduce((a, k) => a + k.length + String(kv[k]).length, 0);
  const pages = Object.entries(st.pg).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const PN = { home: 'בית', fw: 'צפייה חופשית', bot: 'CineAI', hub: 'מרכז המידע והמשחקים', news: 'מה השתנה', privacy: 'פרטיות' };
  const since = (g ? (guestData().st || {}).f : (CUR.user.c || st.f)) || now();
  m.innerHTML = `<h2>${T('tStats')}</h2><p class="lead">${esc(T('statsS', { n: g ? T('guest') : CUR.prof.n }))}</p>
    <div class="grid2">
      <div class="stat"><small>${T('watch')}</small><b>${fmtDur(st.w)}</b><em>${T('week')}: ${fmtDur(weekW)}</em></div>
      <div class="stat"><small>${T('site')}</small><b>${fmtDur(st.s)}</b></div>
      <div class="stat"><small>${T('streak')}</small><b>${streak}</b></div>
      <div class="stat"><small>${T('lists')}</small><b>${nList}</b></div>
      <div class="stat"><small>${T('chats')}</small><b>${nChats}</b></div>
      <div class="stat"><small>${T('member')}</small><b style="font-size:1.05rem">${fmtDate(since)}</b><em>${T('storage')}: ${bytes < 1024 ? Math.max(1, bytes) + ' B' : (bytes / 1024).toFixed(1) + ' KB'}</em></div>
    </div>
    <div class="sec mt"><h3>${T('last7')}</h3>
      <div class="bars" role="img" aria-label="${T('last7')}">${days.map(d => `<div class="b" title="${fmtDur(d.w)} / ${fmtDur(d.s)}"><i style="height:${Math.round(d.w / max * 100)}%"></i><i class="s" style="height:${Math.round(d.s / max * 100)}%;margin-top:2px"></i><span>${T('days')[d.wd]}</span></div>`).join('')}</div>
      <div class="legend"><span><i style="background:linear-gradient(135deg,#2196f3,#8bc34a)"></i>${T('legendW')}</span><span><i style="background:rgba(148,163,184,.35)"></i>${T('legendS')}</span></div></div>
    <div class="sec"><h3>${T('recent')}</h3>${(st.r || []).length ? `<div class="list">${st.r.slice(0, 12).map(v => `<div class="li"><span class="devi">${ic('play')}</span><span class="t"><b>${esc(v.t || v.id)}</b><small>${fmtWhen(v.at)} · ${fmtDur(v.sec)}</small></span></div>`).join('')}</div>` : `<p class="d" style="margin:0">${T('noRecent')}</p>`}</div>
    ${pages.length ? `<div class="sec"><h3>${T('pages')}</h3><div class="list">${pages.map(([k, v]) => `<div class="li"><span class="t"><b>${esc(LANG === 'he' ? (PN[k] || k) : k)}</b></span><span class="chip">${fmtDur(v)}</span></div>`).join('')}</div></div>` : ''}
    <div class="sec"><h3>${T('exportT')}</h3><p class="d">${T('exportS')}</p><div class="row wrap"><button class="btn ghost sm" type="button" data-x="exp">${ic('dl')}${T('export')}</button><button class="btn danger sm" type="button" data-x="clr">${ic('trash')}${T('clearProf')}</button></div></div>`;
  m.onclick = async e => {
    const x = e.target.closest('[data-x]'); if (!x) return;
    if (x.dataset.x === 'exp') exportData();
    else if (x.dataset.x === 'clr') {
      if (!(await ask(T('clearProfQ'), { title: T('clearProf'), yes: T('delete'), danger: true }))) return;
      try {
        if (g) LS.del('dpa_gkv'); else { await fsDel(CUR.uid, 'users/' + CUR.uid + '/kv/' + CUR.prof.id); LS.del(kvKey(CUR.uid, CUR.prof.id)); }
        CUR.kv = {}; pendKV = {}; toast(T('cleared')); reloadPage();
      } catch (er) { toast(errMsg(er)); }
    }
  };
}
async function exportData() {
  const g = CUR.type === 'guest';
  const out = { app: 'drive-play', kind: 'account-export', at: new Date().toISOString() };
  try {
    if (g) { out.guest = { kv: getKV('guest'), stats: guestData().st }; }
    else {
      const uid = CUR.uid; await flushAll();
      out.account = Object.assign({ email: D.accts[uid].em }, await fsGet(uid, 'users/' + uid));
      out.profiles = {};
      for (const p of out.account.P || []) out.profiles[p.id] = { name: p.n, data: await fetchKV(uid, p.id), stats: await fsGet(uid, 'users/' + uid + '/stats/' + p.id) };
      out.devices = await fsList(uid, 'users/' + uid + '/sessions');
      (out.account.P || []).forEach(p => { if (p.pin) p.pin = '(hashed)'; });
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'drive-play-my-data-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  } catch (x) { toast(errMsg(x)); }
}
async function tabDevices(m) {
  m.innerHTML = `<h2>${T('tDevices')}</h2><p class="lead">${T('devicesS')}</p><div class="sec" style="text-align:center"><span class="spin"></span></div>`;
  const uid = CUR.uid, a = D.accts[uid];
  let ss = [];
  try { ss = await fsList(uid, 'users/' + uid + '/sessions'); } catch (e) { m.querySelector('.sec').textContent = errMsg(e); return; }
  if (TAB !== 'devices') return;
  ss.sort((x, y) => (x.id === a.sid ? -1 : y.id === a.sid ? 1 : (y.l || 0) - (x.l || 0)));
  m.innerHTML = `<h2>${T('tDevices')}</h2><p class="lead">${T('devicesS')}</p>
    <div class="sec"><div class="list">${ss.map(s => `<div class="li"><span class="devi">${ic(s.k === 'desktop' ? 'device' : 'phone')}</span><span class="t"><b>${esc(s.d || T('unknownDev'))}</b><small>${T('lastSeen')}: ${fmtWhen(s.l || s.f || now())}</small></span>${s.id === a.sid ? `<span class="chip g">${T('thisDev')}</span>` : `<button class="btn ghost sm" type="button" data-sid="${esc(s.id)}">${T('disconnect')}</button>`}</div>`).join('') || `<p class="d">—</p>`}</div></div>
    <div class="row wrap"><button class="btn ghost sm" type="button" data-x="outall">${T('signoutAll')}</button></div>`;
  m.onclick = async e => {
    const b = e.target.closest('[data-sid]');
    if (b) { busy(b, true); try { await fsDel(uid, 'users/' + uid + '/sessions/' + b.dataset.sid); toast(T('disconnected')); drawTab(); } catch (x) { busy(b, false); toast(errMsg(x)); } return; }
    if (e.target.closest('[data-x=outall]')) signOutAll();
  };
}
function tabPrivacy(m) {
  const g = CUR.type === 'guest'; const L = (!g && CUR.user.L) || [];
  m.innerHTML = `<h2>${T('tPrivacy')}</h2><p class="lead">${T('privS')}</p>
    <div class="sec"><h3>${T('storedT')}</h3><ul class="bullets">${T('stored').map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
    <div class="sec"><h3>${T('whereT')}</h3><ul class="bullets">${T('where').map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
    ${g ? '' : `<div class="sec"><h3>${T('loginsT')}</h3><div class="list">${L.slice().reverse().slice(0, 10).map(l => `<div class="li"><span class="devi">${ic(l.k === 'desktop' ? 'device' : 'phone')}</span><span class="t"><b>${esc(l.d || T('unknownDev'))}</b><small>${fmtWhen(l.at)}</small></span></div>`).join('') || '<p class="d">—</p>'}</div></div>`}
    <div class="sec"><h3>${T('tipsT')}</h3><ul class="bullets">${T('tips').map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
    <p><a href="${PRIVACY_URL}" target="_blank" rel="noopener">${T('policy')}</a></p>`;
  m.onclick = null;
}

/* ---------- starting points ---------- */
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rj) => setTimeout(() => rj(new ApiErr('NETWORK', 0)), ms))]);
async function startAccount(uid, interactive, opts = {}) {
  const a = D.accts[uid];
  if (!a || !a.rt) { welcome(); return; }
  if (interactive) splash(opts.justIn ? T('entering') : T('detecting'));
  let user = LS.get(udKey(uid), null), offline = false;
  try {
    const [u, sess] = await withTimeout(Promise.all([fsGet(uid, 'users/' + uid), a.sidMade ? fsGet(uid, 'users/' + uid + '/sessions/' + a.sid) : Promise.resolve({})]), 7000);
    if (a.sidMade && !sess && !opts.justIn) { await signOut(true); welcome(T('remote')); return; }
    if (u && a.ep != null && (u.ep || 0) > a.ep && !opts.justIn) { await signOut(true); welcome(T('remote')); return; }
    user = u || user;
    if (!user) { user = { n: a.n || (a.em || '').split('@')[0], img: '', c: now(), ep: 0, P: [{ id: 'p' + rid(8), n: a.n || (a.em || '').split('@')[0], col: PCOLS[0], kids: false, img: '' }], L: [], v: 1 }; await fsPatch(uid, 'users/' + uid, user); }
    if (!user.P || !user.P.length) { user.P = [{ id: 'p' + rid(8), n: user.n || 'ראשי', col: PCOLS[0], kids: false, img: '' }]; await fsPatch(uid, 'users/' + uid, { P: user.P }); }
    a.ep = user.ep || 0;
    cacheUser(uid, user);
    const d = devInfo();
    const sessPatch = { d: [d.os, d.br].filter(Boolean).join(' · ') || T('unknownDev'), k: d.kind, l: now(), p: PAGE.page || '' };
    if (!a.sidMade) sessPatch.f = now();
    fsPatch(uid, 'users/' + uid + '/sessions/' + a.sid, sessPatch).then(() => { if (!a.sidMade) { a.sidMade = 1; saveD(); } }).catch(() => {});
    if (opts.justIn && !opts.isNew) { const L = (user.L || []).concat([loginEntry()]).slice(-10); user.L = L; fsPatch(uid, 'users/' + uid, { L }).catch(() => {}); }
  } catch (e) {
    if (e.code === 'SIGNED_OUT') { D.cur = null; saveD(); welcome(T('remote')); return; }
    offline = true;
    if (!user) { welcome(errMsg(e)); return; }
  }
  CUR = { type: 'acct', uid, user, prof: null, kv: {} };
  if (offline) toast(T('offline'));
  const visit = SS.get('dpa_visit', null);
  const profs = user.P;
  let p = profs.find(x => x.id === ((visit && visit.u === uid && visit.p) || D.prof[uid])) || null;
  const needPick = !visit && (profs.length > 1 || (p && p.pin));
  if (opts.isNew) toast(T('welcomeNew', { n: user.n }));
  if (needPick || !p) { if (profs.length === 1 && !profs[0].pin) p = profs[0]; else { picker(user); return; } }
  CUR.prof = p;
  CUR.kv = getKV(uid, p.id);
  const greet = !visit && interactive && !opts.justIn && !fxOff();
  if (greet) {
    stage(`<img class="logo float" src="logo.webp" alt="Drive Play" width="220" height="220"><h1 class="rise">${esc(T('hello', { n: p.n }))}</h1><p class="sub rise d1">${T('welcomeBack')}</p><div class="line" aria-hidden="true"><span></span></div>`, { focus: false });
  }
  try { CUR.kv = await withTimeout(fetchKV(uid, p.id), offline ? 1 : 5000); setKVCache(uid, p.id, CUR.kv); } catch (e) {}
  await loadPro(uid, offline);
  if (greet) await sleep(700);
  sendEnter();
}
const fxOff = () => { try { const f = JSON.parse((CUR && CUR.kv && CUR.kv.dp_fx) || 'null'); return f && (f.intro === false || f.ui === false); } catch (e) { return false; } };
function enterGuest() {
  D.cur = 'guest'; saveD();
  const g = guestData();
  CUR = { type: 'guest', uid: 'guest', user: null, prof: { id: 'guest', n: g.n || 'אורח', col: g.col || '#2F7BFF', kids: false }, kv: getKV('guest') };
  sendEnter();
}
/* quick path: same visit, already entered on a previous page – no screens at all */
async function quickEnter(visit) {
  if (visit.u === 'guest') { enterGuest(); return; }
  const uid = visit.u, a = D.accts[uid], user = LS.get(udKey(uid), null);
  if (!a || !a.rt || !user) return false;
  const p = (user.P || []).find(x => x.id === visit.p); if (!p) return false;
  CUR = { type: 'acct', uid, user, prof: p, kv: getKV(uid, p.id) };
  PRO = LS.get(proKey(uid), null) || { until: 0 };
  if (pageNeedsPro() && !isPro()) await loadPro(uid);
  sendEnter();
  /* refresh in the background; the page gets the newest data on its next load */
  try {
    const was = isPro(); await loadPro(uid); if (isPro() !== was) post({ t: 'pro', pro: proView() });
    const [u, kv] = await Promise.all([fsGet(uid, 'users/' + uid), fetchKV(uid, p.id)]);
    if (u) { if ((u.ep || 0) > (a.ep || 0)) { await signOut(true); post({ t: 'reload' }); return; } cacheUser(uid, u); CUR.user = u; const np = (u.P || []).find(x => x.id === p.id); if (!np) { SS.del('dpa_visit'); post({ t: 'reload' }); return; } CUR.prof = np; post({ t: 'acct', acct: acctView(), prof: profView(np) }); }
    const merged = Object.assign({}, kv, pendKV); for (const k in pendKV) if (pendKV[k] === null) delete merged[k];
    if (JSON.stringify(merged) !== JSON.stringify(CUR.kv)) { CUR.kv = merged; setKVCache(uid, p.id, merged); post({ t: 'kv', kv: merged }); }
    fsPatch(uid, 'users/' + uid + '/sessions/' + a.sid, { l: now(), p: PAGE.page || '' }).catch(() => {});
  } catch (e) { if (e.code === 'SIGNED_OUT') { D.cur = null; saveD(); SS.del('dpa_visit'); post({ t: 'reload' }); } }
  return true;
}
async function begin() {
  const visit = SS.get('dpa_visit', null);
  if (REQUIRE_ACCOUNT && D.cur === 'guest') { D.cur = null; saveD(); }
  if (visit && (visit.u === 'guest' ? D.cur === 'guest' : D.cur === visit.u)) { if ((await quickEnter(visit)) !== false) return; }
  if (D.cur === 'guest') {
    /* guests: first page of each visit offers to sign in, later pages go straight in */
    splash(T('loading')); await sleep(250); welcome(); return;
  }
  if (D.cur && D.accts[D.cur] && D.accts[D.cur].rt) { await startAccount(D.cur, true); return; }
  splash(T('loading')); await sleep(250); welcome();
}

/* ---------- messages from the page ---------- */
let started = false;
addEventListener('message', e => {
  if (e.source !== window.parent) return;
  const ok = PROD_ORIGIN.test(e.origin) || (DEV && DEV_ORIGIN.test(e.origin));
  if (!ok) return;
  const m = e.data; if (!m || m.dp !== 1 || typeof m.t !== 'string') return;
  if (!PARENT) PARENT = e.origin; else if (PARENT !== e.origin) return;
  switch (m.t) {
    case 'init':
      if (started) return; started = true;
      PAGE = { page: String(m.page || '').slice(0, 30), label: String(m.label || '').slice(0, 80), pro: m.pro === 1 || m.pro === true };
      if (m.still) document.documentElement.classList.add('still');
      { const gl = (D.cur && D.cur !== 'guest' && D.prof[D.cur] && getKV(D.cur, D.prof[D.cur]).dp_lang) || getKV('guest').dp_lang || m.lang || navigator.language || 'he'; setLang(gl); }
      begin();
      break;
    case 'set': onSet(m.ch); break;
    case 'stat': onStat(m); break;
    case 'open': if (ENTERED) center(String(m.view || '')); break;
    case 'flush': flushAll(true); break;
  }
});
addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !ENTERED) return;
  if ($('#modal')) { closeModal(); return; }
  const c = $('#center'), st = $('#stage');
  if ((c && !c.hidden) || (st && !st.hidden && VIEW.name === 'picker')) { hideAll(); ui(false); }
});

if (window.parent === window) {
  document.body.innerHTML = `<div id="stage"><div class="box"><img class="logo" src="logo.webp" alt="Drive Play" width="220" height="220"><p class="sub">${STR.he.topOnly}</p><a class="btn pri" href="${SITE}">${STR.he.toSite}</a></div></div>`;
} else {
  window.parent.postMessage({ dp: 1, t: 'hello' }, '*');
}
})();
