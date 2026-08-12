# groundview-news

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-7xveu6b6)

## Deploying writer signup protection

Run these commands from the repository root in PowerShell:

```powershell
Set-Location C:\Users\L0011\breccsprojects\groundview-news
```

### 1. Apply the Supabase migrations

This repository is already linked to its Supabase project. Apply the rate-limit
and remuneration schema before deploying the application:

```powershell
npx supabase db push --linked
```

Review the listed migrations when prompted before confirming.

### 2. Link this folder to the existing Vercel project

The Vercel link is local-machine metadata stored in `.vercel`, so a repository
checkout may be linked to Supabase but not yet linked to Vercel.

Use the latest CLI directly through `npx`; do not use the CLI's self-upgrade
prompt:

```powershell
npx vercel@latest link
```

When prompted:

1. Sign in to the Vercel account that owns Ground View News.
2. Select the correct Vercel team or personal scope.
3. Choose **Link to existing project**.
4. Select the existing Ground View News production project. Do not create a new project.

The command should create `.vercel/project.json`. That directory is local
configuration and should remain ignored by Git.

Confirm the link:

```powershell
npx vercel@latest project inspect
```

### 3. Generate the rate-limit hashing secret

Generate it once. Do not commit or paste the value into source files:

```powershell
$secretBytes = New-Object byte[] 32
$randomGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
$randomGenerator.GetBytes($secretBytes)
$randomGenerator.Dispose()
$writerRateSecret = [BitConverter]::ToString($secretBytes).Replace('-', '').ToLower()
```

The value remains in `$writerRateSecret` for the current PowerShell session.
Copy it to the clipboard without printing it in the terminal:

```powershell
Set-Clipboard -Value $writerRateSecret
```

### 4. Add the secret to Vercel

Run each command separately. When Vercel prompts for the value, paste the same
clipboard value and press Enter:

```powershell
npx vercel@latest env add WRITER_RATE_LIMIT_SECRET production
npx vercel@latest env add WRITER_RATE_LIMIT_SECRET preview
```

Add it to `development` only if Vercel-hosted development deployments are used:

```powershell
npx vercel@latest env add WRITER_RATE_LIMIT_SECRET development
```

Verify that the variable names exist without exposing their values:

```powershell
npx vercel@latest env ls
```

If Vercel reports that the codebase is not linked, repeat step 2 from this
repository root. If an older `npx vercel` asks to upgrade itself and fails with
`spawn npm ENOENT`, cancel it and use `npx vercel@latest` as shown above; a
global Vercel installation is not required.

### 5. Deploy

After the migrations and environment variables are in place:

```powershell
npx vercel@latest --prod
```
