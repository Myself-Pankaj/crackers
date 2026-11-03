# Hari Om Phataka Center

A single-page billing app with Firebase email/password sign-in, Firestore stock and bill records, product photos, festive PDF bills, Cloudinary PDF hosting, and sharing through your phone’s SMS app.

## Start locally

Use Node 24 and pnpm:

```sh
pnpm install
pnpm dev
```

Vite runs both the website and the PDF upload API. Restart it after changing `.env.local`. For a production build with the same upload API:

```sh
pnpm build
pnpm start
```

The production server defaults to `http://127.0.0.1:3000`. Configure `HOST` and `PORT` for deployment and put it behind HTTPS. Deploy this as a Node application: static-only hosting or `pnpm preview` cannot serve the Cloudinary upload endpoint. Do not publish `.env.local` or put it in `dist/`.

## Firebase setup

The public web configuration defaults to project `crackers-6ae7c` in `src/firebaseConfig.ts`. `.env.local` can override it. For another project, fill in all Firebase fields from `.env.example`. The database defaults to `(default)`; set `VITE_FIREBASE_DATABASE_ID` if you created a named Firestore database.

1. Create your Firestore database.
2. In **Authentication → Sign-in method**, enable **Email/Password**.
3. In **Authentication → Users → Add user**, create your store account.
4. Publish `firestore.rules` in that database’s Rules tab. The local file is not published automatically.
5. Sign in using that store account in the app, then add your own stock. No sample stock is created.

Products: `stores/{ownerUid}/products/{productId}`. Categories: `stores/{ownerUid}/categories/{categoryId}`. Bills: `stores/{ownerUid}/bills/{billId}`. Each account has its own store. **View in Firebase** opens the stock location. If rules deny access, publish the updated rules including category and PDF-sharing metadata permissions.

## Cloudinary PDF hosting

Set these **server-only** values in `.env.local` locally and in your server environment for production:

```dotenv
CLOUDINARY_CLOUD_NAME=buymybook
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLOUDINARY_FOLDER_MODE=dynamic
```

Never prefix Cloudinary credentials with `VITE_`: Vite-prefixed variables are public browser configuration. Existing credentials were normalized to the standard environment variable names above. The API secret stays on the Node server. No Firebase Storage bucket or Storage billing plan is needed for this Cloudinary upload flow.

The folder is exactly **hariom phatak center**. For modern Cloudinary environments, `asset_folder` sets the Media Library folder and the public ID includes the folder prefix, account UID, bill ID, and an opaque suffix. For a legacy fixed-folder environment, set `CLOUDINARY_FOLDER_MODE=fixed`. Cloudinary creates the folder on the first successful upload. Do not change the cloud name without matching its API credentials.

In Cloudinary’s product environment **Settings → Security**, enable **Allow delivery of PDF and ZIP files** if PDF delivery is blocked. This setting is commonly disabled on free accounts. Test an uploaded link in a signed-out browser. PDFs are shared links: anyone who receives or forwards a link can view that bill.

Uploads go through `POST /api/bills/pdf`. The backend validates the Firebase ID token through Firebase Auth, looks up the saved bill using that user’s Firestore permissions, and signs the server-side upload to Cloudinary. Only PDFs up to 4 MB are accepted (within Netlify’s binary function request limit). The API returns a URL and public ID, never the API secret. The client saves these as `pdfUrl` and `pdfPath` on the bill. Firestore permits changing those sharing fields only; sale contents cannot be modified through an update.

Bill saving and PDF upload are separate steps. Creating a bill atomically checks stock, deducts pieces, and saves the bill. Then the PDF uploads. If upload fails, **Retry PDF upload** retries only the upload and metadata save, avoiding another stock deduction. Stable asset names and `overwrite=false` make retries safe. Previously saved Cloudinary links are reused.

## Stock, quantities, and images

Stock is always counted in whole **pieces**. Each product has independent **+ Box** and **+ Piece** buttons. One 10-piece box and one loose piece consume 11 pieces, with separate lines on the bill. Stock entry fields can be cleared and replaced normally; prices and stock start empty. Enter an explicit 0 if a value is zero.

Product shape:

```json
{
  "id": "electric-sparklers",
  "name": "Electric Sparklers",
  "category": "Sparklers",
  "piecesPerBox": 10,
  "boxPrice": 120,
  "loosePrice": 15,
  "stock": 480,
  "color": "pink",
  "imageData": ""
}
```

Choose an optional JPG, PNG, or WebP photo up to 10 MB. The app compresses it to a maximum 640px edge and a data URL of at most 150,000 characters, saved with the product in Firestore. **Product photos remain in Firestore; bill PDFs go to Cloudinary.**

Add categories using **+ Add category** or **+ Add a new category…** in the stock form. Names are limited to 50 characters; duplicates ignore case and repeated spaces. Adding a category from the stock form preserves your unsaved item and selects the category after saving.

Inventory edits set the absolute piece count; perform them when sales are not in progress. Refunds, bill cancellation, GST/tax calculation, and restocking cancelled bills are not implemented.

## Sharing bills

The receipt has two actions: **Share via SMS** and **Share via another app**. Both send the same personal Diwali greeting, bill details, and mobile bill link. SMS opens Messages with the customer number when available; otherwise, choose a recipient in Messages. The other action opens your phone’s native app picker. Select any compatible app and recipient, then send. The app does not send messages automatically.

A new bill’s PDF is prepared automatically. Saved bills without a link prepare it when opened. If preparation fails, tap either sharing action to retry, then tap again once the link is ready. No PDF download is needed. On browsers without an app picker, the second action copies the full greeting and link so you can paste it into an app yourself. Download remains available to recipients inside the bill viewer.

Each stock card has **Edit** and **Delete**. Deletion requires confirmation, removes the product from the current bill, and clears its discount if the deleted item was in that bill. Saved bills retain their original item details. Publish the updated `firestore.rules` before using deletion; only the signed-in store owner can delete their products.

## Verification

```sh
pnpm build
node --test tests/*.test.mjs
```

Tests cover billing calculations, combined stock usage, overselling, input validation, custom categories, image input validation, PDF contents and pagination, phone handling, SMS formatting, and the authenticated upload API with mocked provider responses. Live uploads require the credentials, Cloudinary delivery setting, and published Firestore rules. Native SMS composition and delivery require manual verification on your phone.

## PDF uploaded but Firestore denied the link save

The PDF itself goes to Cloudinary. Firestore receives only `pdfUrl` (the download URL) and `pdfPath` (Cloudinary public ID). A successful Cloudinary upload can be followed by a denied Firestore metadata update if your published rules still prohibit bill updates or expect a Firebase Storage URL. Publish the current `firestore.rules` including its `allow update` condition for those two fields.

When this happens, the receipt keeps the uploaded link available through both sharing actions and reports that it could not save the link to history. Sharing does not deduct stock again.

## Short PDF links

After a Cloudinary upload, the backend creates a Short.io link to the mobile bill viewer and saves it as `shortPdfUrl` alongside the original PDF metadata. Sharing uses this short link. Existing is.gd links remain supported. If Short.io is unconfigured or unavailable, sharing falls back to the viewer, or the hosted PDF during local development.

In [Short.io](https://app.short.io/settings/integrations/api-key), create a **secret API key** and copy the exact domain hostname shown in your account. Set these values in `.env.local`:

```dotenv
SHORT_IO_API_KEY=your-secret-api-key
VITE_SHORT_IO_DOMAIN=your-account-domain.short.gy
```

Use your actual Short.io account domain, including any subdomain; the example is a placeholder. A domain already provided by Short.io can be used, or a custom domain configured in your account. The API key stays on the server; never give it a `VITE_` prefix. Only the domain is public. The backend uses Short.io's [create-link API](https://developers.short.io/docs/creating-your-first-short-link).

For Netlify, set `SHORT_IO_API_KEY` with **Functions** scope and `VITE_SHORT_IO_DOMAIN` with **Builds and Functions** scope, then redeploy from source. For Node hosting, set both variables on the server and set the domain when building. Restart Vite after local configuration changes.

Publish the updated `firestore.rules` so it accepts Short.io domain URLs. Firestore rules validate HTTPS URL structure because Short.io domains vary per account; the app and backend validate the configured hostname. Cached links are reused, concurrent duplicate requests share one call, and rate limits trigger a cooldown. Already saved links are reused without uploading the PDF again.

## Production bundles

PDF generation is loaded dynamically when an upload needs it. Firebase Authentication, Firestore, React, and the PDF engine have separate dependency chunks configured in `vite.config.ts`. The normal 500 kB warning threshold remains enabled. Sharing actions send text and a hosted bill link, allowing the app picker to open directly from the button tap once the link is ready.

## Deploy to Netlify

Uploading only `dist/` through Netlify Drop deploys static files without the PDF upload backend. This project now includes `netlify.toml` and `netlify/functions/bill-pdf.mjs`, which deploy the authenticated upload API as a Netlify Function. It reuses the same server handler as local development and Node hosting.

1. In Netlify, connect the **source repository** to the existing site. Use the directory containing this project’s `package.json` and `netlify.toml` as the base directory. For a parent repository, set the base directory to `crackers`.
2. Build command: `pnpm build`. Publish directory: `dist`. Functions directory: `netlify/functions`. The checked-in configuration supplies these values.
3. In Netlify’s environment variables, add `CLOUDINARY_CLOUD_NAME=buymybook`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` using your existing values. Their scope must include **Functions**. Optionally set `CLOUDINARY_FOLDER_MODE=dynamic`. `.env.local` on your computer is not uploaded or used by the deployed function; keep it private. Runtime variables cannot be supplied through `[build.environment]` in `netlify.toml`.
4. If you changed the Firebase project or database, configure the corresponding `VITE_FIREBASE_*` values for both **Builds** and **Functions**. The checked-in Firebase defaults already point to `crackers-6ae7c` and `(default)`.
5. Redeploy from source. Confirm a function named **bill-pdf** appears in Netlify’s Functions view. Opening `/api/bills/pdf` in a browser should return a JSON message saying to use POST, rather than the app HTML or a 404.
6. Ensure the latest Firestore rules are published and sign in to the app. Retry the failed bill’s PDF upload; do not generate the sale again.

Alternatively, use the Netlify CLI from this source directory (`netlify deploy --build --prod`) after linking it to your existing site. The source build must deploy functions as well as static output. A new drag-and-drop upload of `dist` alone cannot fix the missing API. Netlify manages HTTPS and the function runtime; `pnpm start` is not used there. The API rewrite is placed before the app fallback so PDF requests reach the function.

Netlify-specific function routing and environment-variable configuration require verification on your deployed site. The local tests cover the web Request/Response adapter and its authenticated upload flow with mocked providers.

## Android-friendly bill viewing

SMS now defaults to a public **mobile bill viewer**, served at `/bill-view.html`. It renders PDFs using PDF.js into an HTML canvas, includes Previous/Next controls for multi-page bills, and offers **Download PDF**. Recipients do not sign in. This avoids relying on the Android Messages app’s or browser’s native PDF handler. The viewer accepts only HTTPS Cloudinary raw PDF URLs. It uses a fragment for the PDF address and a no-referrer policy. PDF.js and its worker are hosted with the site; they load only when the recipient opens the viewer.

The backend uses the public request origin, Netlify’s `URL`, or an explicit `PUBLIC_SITE_URL` to build `pdfViewerUrl`; set `PUBLIC_SITE_URL` to your actual deployed HTTPS origin if the auto-detected address is incorrect. The shortened URL now redirects to this viewer, while `pdfUrl` still stores the actual Cloudinary PDF file. Publish the updated Firestore rules to permit the additional `pdfViewerUrl` sharing field.

Send a new message using either sharing action. Old short links already sent to customers keep their original destinations. Localhost viewer links cannot be opened from another phone, so local development shares the hosted PDF instead. Use your deployed HTTPS site for mobile viewer links.
