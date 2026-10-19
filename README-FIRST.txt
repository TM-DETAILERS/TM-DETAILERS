TM DETAILERS — OWNER STUDIO UPGRADE

THIS CHANGES ONLY THE OWNER STUDIO PAGE. YOUR PUBLIC STOREFRONT IS NOT REDESIGNED BY THIS PATCH.

BEFORE ANY LIVE UPDATE:
1. Use the self-contained interactive preview. Sample data is fictional and cannot touch live bookings.
2. Confirm V4 backend + D1 migration is already working on your current website.
3. Back up your current studio/index.html and existing website project.
4. Merge the public folder from the ZIP into your GitHub Desktop local repository.
5. Commit and push. Cloudflare Pages still uses the public output directory.
6. Test Owner Studio login, view/edit/cancel bookings and requests using test data first.

This update relies on existing protected V4 endpoints for booking management, business accounts, website settings and gallery images. It does NOT create or deploy a new database or configure transaction emails or a real AI provider. TM Assistant is a clearly labeled rule-based draft helper. There is no generative AI API connection.

Owner authentication: every fresh Owner Studio page load logs out the previous session; owner login uses your Cloudflare ADMIN_PASSWORD. Sessions use HTTP-only cookies.

The delete action requires retyping the booking reference before a server-authorized DELETE request.

If your current live backend predates V4, do not deploy until backend/data compatibility is checked.
