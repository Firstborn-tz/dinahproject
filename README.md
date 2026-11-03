# Dinah Stationaries — Hosting Guide

This guide explains how to publish the Dinah Stationaries website and staff system. The frontend is a static site hosted on Vercel. Supabase hosts the PostgreSQL database, authentication, and two Edge Functions used for manager account administration.

## What you need

- A GitHub account and this project pushed to a repository.
- A [Supabase](https://supabase.com) account.
- A [Vercel](https://vercel.com) account connected to your GitHub account.
- Node.js and npm on your computer for deploying Supabase Edge Functions.

## 1. Create and configure Supabase

### Create the project

1. Create a Supabase project and save the database password somewhere private.
2. Choose a region close to the people who will use the system.
3. When the project is ready, open **Project Settings → API** and copy the **Project URL** and the **publishable/anon key**. These two values are used by the browser. Never use a `service_role` or secret key in the frontend.
4. Note the project reference. It is the project identifier in the Supabase project URL, before `.supabase.co`.

### Install the database schema

For a **new, empty Supabase project**:

1. Open **SQL Editor → New query**.
2. Open [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), copy the entire file into the SQL Editor, and run it.
3. Confirm the query completes, then check **Table Editor** for tables such as `branches`, `profiles`, `products`, and `sales`.

This is the consolidated schema file: it includes the initial schema and all seven updates in their original order. If this project already has an earlier version of the schema, take a database backup and review its migration history before running the consolidated file; do not treat a fresh-install script as a substitute for a reviewed upgrade plan.

### Deploy the Edge Functions

The two functions let active managers create staff accounts and reset their passwords. Run these commands from the project folder in PowerShell or a terminal with Node.js installed:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy create-user
npx supabase functions deploy admin-reset-password
```

Replace `YOUR_PROJECT_REF` with the identifier from the Supabase project URL. Approve the browser login when prompted. The functions use Supabase's built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` runtime variables. Do not add the service role key to Vercel or to any frontend file.

### Create the first Manager account

The first Manager must be bootstrapped in Supabase because the app requires a Manager to create other staff accounts.

1. In Supabase, open **Authentication → Users → Add user**.
2. Enter the Manager's email and a strong password. Confirm the user if Supabase offers that option.
3. Open the new user and copy the **User UID**.
4. In **SQL Editor**, run the following after replacing the example ID and name:

```sql
insert into public.profiles (id, full_name, role, active)
values ('PASTE-USER-UID-HERE', 'Manager Name', 'MANAGER', true);
```

The Manager can create branches, cashiers, products, and the remaining app data after signing in.

## 2. Publish the website on Vercel

### Push the project to GitHub

Create a private or public GitHub repository, then push this project to it. For a new repository, GitHub provides the commands to add its remote and push your current branch. Do not commit `.env.local`, `frontend/config.js`, or any service role/secret key. The repository `.gitignore` excludes those local config files.

### Import the repository

1. In Vercel, choose **Add New → Project**, then import the GitHub repository.
2. Set **Root Directory** to `frontend`.
3. Use these project settings:

   | Setting | Value |
   | --- | --- |
   | Framework Preset | Other |
   | Build Command | `npm run build` |
   | Output Directory | `.` |
   | Install Command | Leave the default; there are no frontend dependencies to install. |

4. Add these Environment Variables for **Production**, and for Preview if you plan to test preview deployments:

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | The Supabase Project URL |
   | `SUPABASE_ANON_KEY` | The Supabase publishable/anon key |
   | `APP_URL` | The production website origin, e.g. `https://your-site.vercel.app` |

   `APP_URL` is the origin only: do not add a path or trailing slash. The build writes `frontend/config.js` from these values. That file contains only browser-public configuration and is generated during deployment.

5. Deploy. Vercel will provide a `vercel.app` address when the build succeeds.
6. After changing environment variables, trigger a new deployment so the generated browser configuration uses the new values.

The project settings above match Vercel's [Git deployment](https://vercel.com/docs/git) and [build configuration](https://vercel.com/docs/builds/configure-a-build) options.

## 3. Allow password reset redirects in Supabase

Once you know the website address:

1. In Supabase, open **Authentication → URL Configuration**.
2. Set **Site URL** to the production website origin, for example `https://your-site.vercel.app`.
3. Add the production origin to **Redirect URLs**, such as `https://your-site.vercel.app/**`.
4. If using a custom domain, set `APP_URL` and **Site URL** to that domain and add `https://your-custom-domain/**` to Redirect URLs.
5. Save, then redeploy Vercel if you changed `APP_URL`.

The app uses this allowed redirect for password reset links. Supabase documents these settings in [URL Configuration](https://supabase.com/docs/guides/auth/redirect-urls).

## 4. Add your domain (optional)

In Vercel, open the project **Settings → Domains**, add your domain, and follow the DNS instructions Vercel displays. Once HTTPS is active, update `APP_URL` and Supabase's Site URL and Redirect URLs to use the custom domain, then redeploy.

## 5. Set up the business and verify the system

1. Open the deployed website and sign in as the first Manager.
2. Add the business details in **Settings**.
3. Create a branch and provide its Google Maps link.
4. Create a cashier account and assign it to the branch.
5. Add products and stock.
6. Sign in as the cashier and verify a sale, service transaction, and daily closing.
7. Confirm the Manager can see reports and the Cashier cannot see purchase costs or manager-only data.
8. Use **Forgot Password** and complete the email link flow.
9. Check the site on a phone and a computer.

## Email delivery (optional)

Supabase can send password reset emails using its built-in email service. For reliable use by staff, configure a custom SMTP provider in Supabase **Authentication** settings. Keep SMTP credentials in Supabase's SMTP settings; never place them in this repository or Vercel's frontend environment variables.

## Updating the hosted system

- **Frontend changes:** commit and push to the connected GitHub branch. Vercel builds and deploys each push. Preview deployments can be used to review changes before production.
- **Edge Function changes:** from the project folder, run `npx supabase functions deploy create-user` and/or `npx supabase functions deploy admin-reset-password` after linking to the correct Supabase project.
- **Database changes:** back up production data and apply a reviewed SQL migration through Supabase. The consolidated `0001_init.sql` is intended for a new project setup; do not overwrite production schema changes without reviewing the upgrade steps.

For more details, see Supabase's [Edge Function deployment guide](https://supabase.com/docs/guides/functions/deploy).
