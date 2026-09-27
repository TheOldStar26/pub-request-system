PUB DJ & KARAOKE REQUEST SYSTEM — VERSION 2

Files:
- customer.html : customer/iPhone request page
- dj.html        : DJ Windows PC queue
- realtime.sql   : SQL to enable live database updates

SETUP:
1. Open customer.html and dj.html in a text editor.
2. In BOTH files find:
   PASTE_YOUR_PUBLISHABLE_KEY_HERE
3. Replace only that text with your Supabase PUBLISHABLE key.
4. Do NOT use a secret/service_role key.
5. In Supabase SQL Editor run realtime.sql.
6. Test customer.html on the iPhone and dj.html on the PC.

SECURITY NOTE:
This is a testing version. The current database policies allow anonymous updates,
so before putting this into use at the pub we should add proper DJ authentication
and restrict customers to INSERT only.
