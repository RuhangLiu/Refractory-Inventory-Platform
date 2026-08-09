#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID to the target GCP project.}"
: "${INSTRUCTOR_EMAIL:?Set INSTRUCTOR_EMAIL before granting access.}"

REGION="${REGION:-us-central1}"
LOCATION="${LOCATION:-us-central1}"
DATASET="${DATASET:-refractory_inventory}"
SERVICE_NAME="${SERVICE_NAME:-refractory-inventory}"
REPOSITORY="${REPOSITORY:-refractory-platform}"
RUNTIME_SERVICE_ACCOUNT="refractory-app@${PROJECT_ID}.iam.gserviceaccount.com"
RAW_BUCKET="${RAW_BUCKET:-ruhangliu-lake-raw}"
CURATED_BUCKET="${CURATED_BUCKET:-ruhangliu-lake-curated}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/inventory-app:latest"
DEPLOY_TMP="$(mktemp -d)"
trap 'rm -rf "$DEPLOY_TMP"' EXIT

gcloud config set project "$PROJECT_ID"
gcloud services enable \
  artifactregistry.googleapis.com \
  bigquery.googleapis.com \
  cloudbuild.googleapis.com \
  iam.googleapis.com \
  run.googleapis.com \
  storage.googleapis.com

gcloud billing projects describe "$PROJECT_ID" --format='value(billingEnabled)' |
  grep -qx 'True' || {
    echo "Billing is not enabled for ${PROJECT_ID}." >&2
    exit 1
  }

gcloud storage buckets describe "gs://${RAW_BUCKET}" >/dev/null 2>&1 ||
  gcloud storage buckets create "gs://${RAW_BUCKET}" --location="$LOCATION" --uniform-bucket-level-access
gcloud storage buckets describe "gs://${CURATED_BUCKET}" >/dev/null 2>&1 ||
  gcloud storage buckets create "gs://${CURATED_BUCKET}" --location="$LOCATION" --uniform-bucket-level-access

gcloud storage cp \
  data/raw/fred/IPG3311A2N.csv \
  "gs://${RAW_BUCKET}/raw/source=fred/dt=$(date -u +%F)/IPG3311A2N.csv"
gcloud storage cp data/curated/*.csv "gs://${CURATED_BUCKET}/curated/"

bq --location="$LOCATION" mk --dataset --description \
  "Refractory inventory analytics and demand forecasting" \
  "${PROJECT_ID}:${DATASET}" 2>/dev/null || true

bq --location="$LOCATION" load --replace --source_format=CSV --skip_leading_rows=1 \
  "${PROJECT_ID}:${DATASET}.products" \
  "gs://${CURATED_BUCKET}/curated/products.csv" \
  schemas/products.json
bq --location="$LOCATION" load --replace --source_format=CSV --skip_leading_rows=1 \
  "${PROJECT_ID}:${DATASET}.inventory" \
  "gs://${CURATED_BUCKET}/curated/inventory.csv" \
  schemas/inventory.json
bq --location="$LOCATION" load --replace --source_format=CSV --skip_leading_rows=1 \
  "${PROJECT_ID}:${DATASET}.transactions" \
  "gs://${CURATED_BUCKET}/curated/transactions.csv" \
  schemas/transactions.json
bq --location="$LOCATION" load --replace --source_format=CSV --skip_leading_rows=1 \
  "${PROJECT_ID}:${DATASET}.steel_industry_index" \
  "gs://${CURATED_BUCKET}/curated/steel_industry_index.csv" \
  schemas/steel_industry_index.json

for sql_file in sql/01_core_tables.sql sql/02_business_views.sql sql/03_data_quality.sql sql/04_bqml_forecast.sql; do
  rendered_sql="${DEPLOY_TMP}/$(basename "$sql_file")"
  sed "s/YOUR_PROJECT_ID/${PROJECT_ID}/g" "$sql_file" >"$rendered_sql"
  bq --location="$LOCATION" query --use_legacy_sql=false <"$rendered_sql"
done

gcloud iam service-accounts describe "$RUNTIME_SERVICE_ACCOUNT" >/dev/null 2>&1 ||
  gcloud iam service-accounts create refractory-app \
    --display-name="Refractory inventory Cloud Run application"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
  --role="roles/bigquery.jobUser"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
  --role="roles/bigquery.dataViewer"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="user:${INSTRUCTOR_EMAIL}" \
  --role="roles/viewer"

gcloud artifacts repositories describe "$REPOSITORY" --location="$REGION" >/dev/null 2>&1 ||
  gcloud artifacts repositories create "$REPOSITORY" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Refractory inventory platform images"

gcloud builds submit --tag "$IMAGE"
gcloud run deploy "$SERVICE_NAME" \
  --image="$IMAGE" \
  --region="$REGION" \
  --service-account="$RUNTIME_SERVICE_ACCOUNT" \
  --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID},BQ_DATASET=${DATASET},BQ_LOCATION=${LOCATION}" \
  --allow-unauthenticated \
  --min=0 \
  --max=2 \
  --memory=512Mi \
  --cpu=1

gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" \
  --format='value(status.url)'
