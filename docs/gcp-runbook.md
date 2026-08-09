# GCP Deployment Runbook

Do not run the deployment script until the project owner approves resource creation, public Cloud Run access, and instructor IAM access.

## Prerequisites

- A Google Cloud project with billing enabled
- A budget alert already configured
- `gcloud` and `bq` authenticated as the project owner
- The instructor's Google account email
- Real and synthetic data generated locally

## Pre-deployment checks

```bash
npm ci
npm run fetch:fred
npm run generate
npm run validate:data
npm test
```

## Deployment

```bash
export PROJECT_ID="your-gcp-project-id"
export INSTRUCTOR_EMAIL="instructor@example.edu"
export REGION="us-central1"
export LOCATION="US"
./scripts/deploy-gcp.sh
```

The script:

1. Enables the required APIs.
2. Checks that the project's billing account is visible.
3. Creates raw and curated Cloud Storage buckets.
4. Uploads the public and synthetic CSV files.
5. Loads explicitly typed BigQuery tables.
6. Creates business and data-quality views.
7. Trains the BigQuery ML ARIMA_PLUS model.
8. Creates the Cloud Run runtime service account.
9. Grants the instructor project Viewer access.
10. Builds and deploys the application.

## Looker Studio manual step

Create a two-page report connected to these BigQuery objects:

- `inventory_kpis`
- `serving_inventory`
- `monthly_inventory_activity`
- `serving_demand_forecast`

Page 1 should contain inventory KPIs, value by category, warehouse comparison, and the alert table. Page 2 should contain observed versus forecast steel activity and a short methodology note.

Share the report with the instructor or enable link viewing, then verify the link in an incognito window.

## Evidence to capture during deployment

- Raw and curated bucket paths
- BigQuery tables and schemas
- Business aggregate query results
- Data-quality view showing zero failures
- BigQuery ML model details
- Forecast table results
- Cloud Run application pages and alert action
- Looker Studio report
- IAM Viewer grant

Keep the platform live through the grading window. After grades post, remove the Cloud Run service, Artifact Registry image, BigQuery dataset, and buckets if they are no longer needed.
