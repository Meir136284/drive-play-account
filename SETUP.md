# הפעלת התחברות חברתית ו-Drive Play Pro

הקוד מוכן. כדי שזה יעבוד באוויר צריך כמה הגדרות שרק בעל החשבונות יכול לעשות.

## 1. התחברות עם Google / Facebook / Apple

ב-[Firebase console](https://console.firebase.google.com) → הפרויקט `bustling-walker-439912-m7` → **Authentication** → **Sign-in method**:

| ספק | מה צריך | עלות |
|---|---|---|
| **Google** | לוחצים Enable ושומרים. זהו. | חינם |
| **Facebook** | יוצרים אפליקציה ב-[developers.facebook.com](https://developers.facebook.com) (סוג: Consumer, מוצר: Facebook Login). מעתיקים App ID ו-App Secret ל-Firebase. את כתובת ה-OAuth redirect ש-Firebase מציג מדביקים ב-Facebook Login → Settings → Valid OAuth Redirect URIs. מעבירים את האפליקציה למצב Live. | חינם |
| **Apple** | צריך [Apple Developer Program](https://developer.apple.com/programs/). יוצרים Services ID + Key עם Sign in with Apple, ומזינים ב-Firebase. | 99$ לשנה |

ב-**Authentication → Settings → Authorized domains** מוסיפים את הדומיין שבו המסגרת מתארחת (למשל `meir136284.github.io`).

עד שספק לא הופעל, הכפתור שלו מציג הודעה מנומסת ("ההתחברות בדרך הזו עוד לא הופעלה") והאימייל ממשיך לעבוד.
אם לא רוצים את Apple בינתיים – מוחקים את `'apple'` מהשורה `const SOCIAL` ב-`app.js`.

## 2. כללי האבטחה של Firestore

Firestore Database → Rules → מדביקים את התוכן של `firestore.rules` → Publish.
הכללים האלה מבטיחים שאף משתמש לא יכול להפעיל לעצמו Pro – רק שרת התשלומים.

## 3. Grow (משולם) – הכסף נכנס ישר לחשבון הבנק

1. פותחים חשבון ב-[Grow](https://grow.business) עם פרטי העוסק וחשבון הבנק. Grow מעבירה את הכסף לבנק אוטומטית.
2. מבקשים מהתמיכה של Grow **גישת API (Light API)** ו**דף תשלום** שמאפשר כרטיס אשראי, **Bit**, Apple Pay ו-Google Pay.
3. מקבלים מהם: `userId`, `pageCode` (ולפעמים `apiKey`), גם לסביבת בדיקות (sandbox) וגם לאמת.

## 4. שרת התשלומים (Google Apps Script – חינם)

1. נכנסים ל-[script.google.com](https://script.google.com) עם החשבון שהוא הבעלים של פרויקט Firebase → פרויקט חדש בשם `Drive Play – תשלומים`.
2. מדביקים את `server/Code.gs`. ב-Project Settings מסמנים "Show appsscript.json" ומדביקים את `server/appsscript.json`.
3. Project Settings → **Script properties**:

| שם | ערך |
|---|---|
| `FIREBASE_PROJECT` | `bustling-walker-439912-m7` |
| `GROW_USER_ID` | מ-Grow |
| `GROW_PAGE_CODE` | מ-Grow |
| `GROW_API_KEY` | מ-Grow, אם נתנו |
| `GROW_ENV` | `sandbox` לבדיקות, `production` כשעוברים לאמת |
| `RETURN_URL` | הכתובת של `paid.html` (למשל `https://meir136284.github.io/drive-play-account/paid.html`) |
| `SALES_SHEET_ID` | לא חובה: מזהה של גיליון Google שבו תירשם כל מכירה |

4. מריצים פעם אחת את הפונקציה `setup` ומאשרים את ההרשאות.
5. Deploy → New deployment → Web app → Execute as: **Me**, Who has access: **Anyone** → Deploy. מעתיקים את כתובת ה-Web app.
6. מוסיפים Script property בשם `WEB_APP_URL` עם הכתובת הזו.
7. ב-`app.js` מדביקים את הכתובת ב-`const PAY_API = '';` ומעלים.

מה השרת שולח ל-Grow: הסכום, שם המוצר, שם מלא וטלפון נייד של הקונה (Grow מחייבת את שניהם – הם נאספים במסך הרכישה), האימייל של החשבון, ושני שדות פנימיים: מספר ההזמנה וקוד אקראי של ההזמנה. Grow מחזירה את הקוד בהודעת התשלום, ורק הודעה עם הקוד הנכון מפעילה Pro. אם הקוד לא חזר, השרת שואל את Grow ישירות (`getPaymentProcessInfo`).

בדיקה: בסביבת sandbox של Grow קונים חודש בכרטיס בדיקה. אחרי כמה שניות החשבון אמור להפוך ל-Pro. אם לא – ב-Apps Script → Executions רואים מה Grow שלח. כשהכל עובד מחליפים את `GROW_ENV` ל-`production` ואת הפרטים לפרטים האמיתיים.

מתנה / תמיכה: בעורך של Apps Script מריצים `grantPro('email@example.com', 1)` כדי לתת Pro לחודש.

## 5. אילו דפים הם Pro

ב-`app.js`, השורה `const PRO_PAGES` קובעת לפי שם הדף. כרגע רק CineAI.
הספרייה, הצפייה החופשית, ערוצי הטלוויזיה ומרכז הפלייליסטים נשארים בחינם לכולם: מדיניות YouTube אוסרת לגבות כסף על צפייה בנגן מוטמע, והספרייה והערוצים לא שלנו.
לפני שמפעילים את `PRO_ENABLED`, צריך הסכם מסחרי בכתב עם TMDB, כי CineAI משתמש בנתונים שלהם.
דף יכול גם לבקש Pro במפורש: בהודעת `init` שהדף שולח למסגרת מוסיפים `pro: 1`.
מי שאין לו Pro רואה מסך שדרוג עם המחירים; מי שיש לו נכנס כרגיל.

## 6. כניסה חובה בכל האתר

`const REQUIRE_ACCOUNT = true` – אין יותר "המשך בלי חשבון". כדי שזה יחול על כל דף, בכל דף באתר צריך להיות קוד מסגרת החשבונות (כמו בדף הבית).

## מחירים

`₪14.90` לחודש, `₪119` לשנה. תשלום חד-פעמי בלי חיוב חוזר – Bit לא תומך בחיוב חוזר, וכך גם אין צורך בניהול ביטולים. אפשר להאריך מתי שרוצים, והזמן מצטבר.
המחירים מוגדרים בשני מקומות: `PLANS` ב-`server/Code.gs` (מה שבאמת נגבה) ו-`PRO_PRICE` ב-`app.js` (מה שמוצג).
