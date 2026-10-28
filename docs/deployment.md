# Deployment pipeline

The Cloud Run workflow uses two protected GitHub environments:

1. Every push to `main` deploys the commit to `staging` and runs smoke tests.
2. A production promotion starts only from `workflow_dispatch` on `main` with
   `promote_to_production=true`.
3. The `production` GitHub environment must require a reviewer. The production
   job waits for that approval after the same commit passes staging.

## Required GitHub environments

Create `staging` and `production` under **Settings → Environments**. Configure
these secrets independently in both environments:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`

Configure these environment variables independently:

- `GCP_PROJECT_ID`
- `DEPLOYMENT_ENVIRONMENT` (`staging` or `production`)
- `GCP_REGION`
- `CLOUD_RUN_SERVICE`
- `CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT`
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_MEASUREMENT_ID` (optional)
- `FIREBASE_DATABASE_ID`
- `FIREBASE_APPCHECK_SITE_KEY` (required when App Check is enforced)
- `FIREBASE_APP_CHECK_REQUIRED`
- `ENABLE_BOOTSTRAP_ADMIN`
- `BOOTSTRAP_ADMIN_EMAIL` (only while a controlled bootstrap is needed)
- `NEXT_PUBLIC_ENABLE_OFFLINE_MODE` (must be `false` outside local development)
- `AUDIT_IP_SALT_SECRET` (optional, recommended: name of the Secret Manager
  secret that holds the audit IP salt, normally `AUDIT_IP_SALT`)

Rate limiting and audit logs take the client IP from the rightmost public
`X-Forwarded-For` hop (the one appended by Cloud Run). The optional runtime
variable `TRUSTED_PROXY_HOPS` (default `1`) only needs to change to `2` if an
external HTTPS load balancer is placed in front of Cloud Run.

## Secret Manager

Cloud Run mounts these secrets as runtime environment variables:

| Env var | Secret | Required |
| --- | --- | --- |
| `GEMINI_API_KEY` | `GEMINI_API_KEY` | yes |
| `KIOSK_SESSION_SECRET` | `KIOSK_SESSION_SECRET` | yes |
| `AUDIT_IP_SALT` | value of `AUDIT_IP_SALT_SECRET` | opt-in |
| `KIOSK_ALERT_APPROVERS` | value of `KIOSK_ALERT_APPROVERS_SECRET` | opt-in (personal data) |

`AUDIT_IP_SALT` salts the IP hashes stored in `audit_events` and the rate-limit
keys. While it is not configured, production omits `ipHash` from audit events,
logs a warning, and the deploy job emits a warning annotation. To enable it in
each project (staging and production):

```bash
PROJECT_ID=<gcp-project-id>
RUNTIME_SA=$(gcloud run services describe <cloud-run-service> --region=us-central1 \
  --project="$PROJECT_ID" --format='value(spec.template.spec.serviceAccountName)')
openssl rand -base64 48 | tr -d '\n' | gcloud secrets create AUDIT_IP_SALT \
  --project="$PROJECT_ID" --replication-policy=automatic --data-file=-
gcloud secrets add-iam-policy-binding AUDIT_IP_SALT --project="$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA}" --role=roles/secretmanager.secretAccessor
```

Then set the GitHub variable `AUDIT_IP_SALT_SECRET=AUDIT_IP_SALT` for that
environment. Use a different salt per environment and never rotate it casually:
changing it resets PIN and public rate-limit counters.

`GCP_PROJECT_ID` and `FIREBASE_PROJECT_ID` must match. The workflow refuses a
cross-project deployment.

Enable Cloud Run, Cloud Build, Artifact Registry, Firestore and Secret Manager
during environment provisioning. The deployment identity deliberately does not
need permission to enable Google Cloud APIs; the workflow only deploys to APIs
that are already provisioned.

## Staging values

The isolated staging environment currently uses:

```text
GCP_PROJECT_ID=tu-proyecto-staging
DEPLOYMENT_ENVIRONMENT=staging
FIREBASE_PROJECT_ID=tu-proyecto-staging
FIREBASE_DATABASE_ID=(default)
CLOUD_RUN_SERVICE=control-de-epp-staging
GCP_REGION=us-central1
FIREBASE_APP_CHECK_REQUIRED=false
ENABLE_BOOTSTRAP_ADMIN=false
NEXT_PUBLIC_ENABLE_OFFLINE_MODE=false
```

Keep App Check disabled only until its staging key has been registered and
verified. Never copy staging values, service accounts, or secrets into the
`production` environment.

## Production protection

Under **Settings → Environments → production**:

- Add at least one required reviewer.
- Prevent administrators from bypassing the protection rule when available.
- Restrict deployment branches to `main`.

The workflow also requires a manual dispatch with the production checkbox, so
an ordinary merge cannot deploy production.

## Automated smoke checks

Every deployment verifies:

- the Cloud Run endpoint responds;
- runtime Firebase project and database match the selected environment;
- Firebase runtime configuration has `Cache-Control: no-store`;
- the Google popup-compatible COOP header is present;
- a kiosk request without a session returns `401`;
- a cross-site kiosk request returns `403` and emits no cookie.

Firestore rules are deployed with a generated configuration that targets the
environment's exact `FIREBASE_DATABASE_ID`.

## Alert approvers and legacy PIN hashes

- `KIOSK_ALERT_APPROVERS` is a JSON secret (see `.env.example`). Approver names, payroll IDs
  and emails are personal data and are no longer stored in the repository. Create the secret in
  Secret Manager, grant the runtime service account `secretAccessor`, and set the GitHub variable
  `KIOSK_ALERT_APPROVERS_SECRET` to its name. Without it nobody is authorized by allowlist; global
  admins and users with the explicit `canApproveKioskAlerts` permission keep working.
- `KIOSK_ALLOW_LEGACY_PIN` defaults to off. Employees whose PIN is still stored with the weak
  legacy hash cannot log in until an admin resets their credentials. Set the GitHub variable
  `KIOSK_ALLOW_LEGACY_PIN=true` only temporarily to let them migrate to bcrypt on first login.
