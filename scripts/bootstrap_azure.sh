#!/usr/bin/env bash

set -euo pipefail

# Bootstrap minimal Azure resources for Container Apps and save non-sensitive
# deployment config as GitHub repository variables.
#
# Prereqs:
# - az CLI logged in (`az login`)
# - gh CLI logged in (`gh auth login`)
# - GitHub repo remote configured
#
# Required env vars:
#   AZURE_SUBSCRIPTION_ID
#
# Optional env vars (defaults shown):
#   AZURE_REGION=eastus
#   AZURE_RESOURCE_GROUP=rg-ai-medical-assist-prod
#   ACR_NAME=aimedassistacr
#   AZURE_CONTAINERAPPS_ENV=cae-ai-medical-assist-prod
#   AZURE_LOG_ANALYTICS=law-ai-medical-assist-prod
#   BACKEND_IMAGE_NAME=ai-medical-assist-backend
#   FRONTEND_IMAGE_NAME=ai-medical-assist-frontend
#   BACKEND_CONTAINER_APP=ca-ai-medical-backend
#   FRONTEND_CONTAINER_APP=ca-ai-medical-frontend

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_cmd az
require_cmd gh

: "${AZURE_SUBSCRIPTION_ID:?AZURE_SUBSCRIPTION_ID is required}"

AZURE_REGION="${AZURE_REGION:-eastus}"
AZURE_RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-ai-medical-assist-prod}"
ACR_NAME="${ACR_NAME:-aimedassistacr}"
AZURE_CONTAINERAPPS_ENV="${AZURE_CONTAINERAPPS_ENV:-cae-ai-medical-assist-prod}"
AZURE_LOG_ANALYTICS="${AZURE_LOG_ANALYTICS:-law-ai-medical-assist-prod}"
BACKEND_IMAGE_NAME="${BACKEND_IMAGE_NAME:-ai-medical-assist-backend}"
FRONTEND_IMAGE_NAME="${FRONTEND_IMAGE_NAME:-ai-medical-assist-frontend}"
BACKEND_CONTAINER_APP="${BACKEND_CONTAINER_APP:-ca-ai-medical-backend}"
FRONTEND_CONTAINER_APP="${FRONTEND_CONTAINER_APP:-ca-ai-medical-frontend}"

echo "Setting Azure subscription..."
az account set --subscription "${AZURE_SUBSCRIPTION_ID}"

echo "Creating resource group if missing..."
az group create \
  --name "${AZURE_RESOURCE_GROUP}" \
  --location "${AZURE_REGION}" \
  --output none

echo "Creating ACR if missing..."
if ! az acr show --name "${ACR_NAME}" --resource-group "${AZURE_RESOURCE_GROUP}" >/dev/null 2>&1; then
  az acr create \
    --name "${ACR_NAME}" \
    --resource-group "${AZURE_RESOURCE_GROUP}" \
    --location "${AZURE_REGION}" \
    --sku Basic \
    --admin-enabled false \
    --output none
fi

echo "Ensuring Azure Container Apps extension..."
az extension add --name containerapp --upgrade --allow-preview true --output none
az provider register --namespace Microsoft.App --wait >/dev/null
az provider register --namespace Microsoft.OperationalInsights --wait >/dev/null

echo "Creating Log Analytics workspace if missing..."
if ! az monitor log-analytics workspace show --resource-group "${AZURE_RESOURCE_GROUP}" --workspace-name "${AZURE_LOG_ANALYTICS}" >/dev/null 2>&1; then
  az monitor log-analytics workspace create \
    --resource-group "${AZURE_RESOURCE_GROUP}" \
    --workspace-name "${AZURE_LOG_ANALYTICS}" \
    --location "${AZURE_REGION}" \
    --output none
fi

WORKSPACE_ID="$(az monitor log-analytics workspace show \
  --resource-group "${AZURE_RESOURCE_GROUP}" \
  --workspace-name "${AZURE_LOG_ANALYTICS}" \
  --query customerId -o tsv)"

WORKSPACE_KEY="$(az monitor log-analytics workspace get-shared-keys \
  --resource-group "${AZURE_RESOURCE_GROUP}" \
  --workspace-name "${AZURE_LOG_ANALYTICS}" \
  --query primarySharedKey -o tsv)"

echo "Creating Container Apps environment if missing..."
if ! az containerapp env show --name "${AZURE_CONTAINERAPPS_ENV}" --resource-group "${AZURE_RESOURCE_GROUP}" >/dev/null 2>&1; then
  az containerapp env create \
    --name "${AZURE_CONTAINERAPPS_ENV}" \
    --resource-group "${AZURE_RESOURCE_GROUP}" \
    --location "${AZURE_REGION}" \
    --logs-workspace-id "${WORKSPACE_ID}" \
    --logs-workspace-key "${WORKSPACE_KEY}" \
    --output none
fi

ACR_LOGIN_SERVER="$(az acr show --name "${ACR_NAME}" --resource-group "${AZURE_RESOURCE_GROUP}" --query loginServer -o tsv)"

echo "Saving repository variables in GitHub..."
gh variable set AZURE_REGION --body "${AZURE_REGION}"
gh variable set AZURE_RESOURCE_GROUP --body "${AZURE_RESOURCE_GROUP}"
gh variable set ACR_NAME --body "${ACR_NAME}"
gh variable set ACR_LOGIN_SERVER --body "${ACR_LOGIN_SERVER}"
gh variable set AZURE_CONTAINERAPPS_ENV --body "${AZURE_CONTAINERAPPS_ENV}"
gh variable set AZURE_LOG_ANALYTICS --body "${AZURE_LOG_ANALYTICS}"
gh variable set BACKEND_IMAGE_NAME --body "${BACKEND_IMAGE_NAME}"
gh variable set FRONTEND_IMAGE_NAME --body "${FRONTEND_IMAGE_NAME}"
gh variable set BACKEND_CONTAINER_APP --body "${BACKEND_CONTAINER_APP}"
gh variable set FRONTEND_CONTAINER_APP --body "${FRONTEND_CONTAINER_APP}"

echo ""
echo "Bootstrap complete."
echo "Next:"
echo "- Add repo secrets: AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID"
echo "- Run scripts/sync_env_to_github.sh to upload app env keys"
