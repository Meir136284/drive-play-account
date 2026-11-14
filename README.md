# Drive Play – חשבונות

מסגרת החשבונות של [Drive Play TV](https://sites.google.com/view/drive-play-tv): הרשמה, התחברות, פרופילים ושמירת נתונים לכל חשבון.
הדף נטען בתוך דפי האתר ומתקשר רק עם דפי האתר עצמו (בדיקת מקור הודעות), ועם Firebase Authentication ו-Cloud Firestore.

## חדש: התחברות חברתית ו-Drive Play Pro
- התחברות והרשמה עם Google, Apple ו-Facebook (בנוסף לאימייל).
- כניסה חובה – אין מצב אורח (`REQUIRE_ACCOUNT`).
- Drive Play Pro: מסך שדרוג בדפי Pro, לשונית Pro במרכז החשבון, תשלום דרך Grow (כרטיס, Bit, Apple Pay, Google Pay) ישר לחשבון הבנק.
- `server/` – שרת התשלומים (Google Apps Script). `firestore.rules` – כללי אבטחה. `paid.html` – דף החזרה אחרי תשלום.

הוראות הפעלה: [SETUP.md](SETUP.md).
