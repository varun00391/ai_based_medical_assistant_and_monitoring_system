#!/usr/bin/env bash

set -euo pipefail

# Subscription resolution (first match wins):
#   1) AZURE_SUBSCRIPTION_ID in the environment
#   2) AZURE_SUBSCRIPTION_ID in repo .env (optional override)
#   3) Current Azure CLI default: az account show --query id -o tsv
resolve_azure_subscription() {
  local root="$1"
  if [[ -n "${AZURE_SUBSCRIPTION_ID:-}" ]]; then
    return 0
  fi
  local ef="${root}/.env"
  if [[ -f "${ef}" ]]; then
    while IFS= read -r line || [[ -n "${line}" ]]; do
      [[ -z "${line// }" ]] && continue
      [[ "${line}" == \#* ]] && continue
      if [[ "${line}" == AZURE_SUBSCRIPTION_ID=* ]]; then
        AZURE_SUBSCRIPTION_ID="${line#AZURE_SUBSCRIPTION_ID=}"
        AZURE_SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID%$'\r'}"
        [[ -n "${AZURE_SUBSCRIPTION_ID}" ]] && return 0
      fi
    done < "${ef}"
  fi
  local sub_id
  sub_id="$(az account show --query id -o tsv 2>/dev/null || true)"
  if [[ -n "${sub_id}" ]]; then
    AZURE_SUBSCRIPTION_ID="${sub_id}"
    return 0
  fi
  return 1
}

# Provision/ensure Azure infrastructure for this app.
# This script is idempotent and safe to re-run.
#
# Subscription: see resolve order above (run az login; use az account set --subscription ... if needed).
#
# Optional:
#   AZURE_REGION=eastus
#   AZURE_RESOURCE_GROUP=rg-ai-medical-assist-prod
#   ACR_NAME=aimedassistacr
#   AZURE_CONTAINERAPPS_ENV=cae-ai-medical-assist-prod
#   AZURE_LOG_ANALYTICS=law-ai-medical-assist-prod

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_cmd az

if ! az account show >/dev/null 2>&1; then
  echo "Azure CLI is not logged in. Run: az login"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
resolve_azure_subscription "${ROOT_DIR}" || true
: "${AZURE_SUBSCRIPTION_ID:?Run az login, set default subscription (az account set --subscription ...), or set AZURE_SUBSCRIPTION_ID in the environment or .env}"

AZURE_REGION="${AZURE_REGION:-eastus}"
AZURE_RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-ai-medical-assist-prod}"
ACR_NAME="${ACR_NAME:-aimedassistacr}"
AZURE_CONTAINERAPPS_ENV="${AZURE_CONTAINERAPPS_ENV:-cae-ai-medical-assist-prod}"
AZURE_LOG_ANALYTICS="${AZURE_LOG_ANALYTICS:-law-ai-medical-assist-prod}"

echo "Setting Azure subscription..."
az account set --subscription "${AZURE_SUBSCRIPTION_ID}"

echo "Ensuring Container Apps extension and providers..."
az extension add --name containerapp --upgrade --allow-preview true --output none
az provider register --namespace Microsoft.App --wait >/dev/null
az provider register --namespace Microsoft.OperationalInsights --wait >/dev/null

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

echo ""
echo "Infra ready."
echo "AZURE_REGION=${AZURE_REGION}"
echo "AZURE_RESOURCE_GROUP=${AZURE_RESOURCE_GROUP}"
echo "ACR_NAME=${ACR_NAME}"
echo "ACR_LOGIN_SERVER=${ACR_LOGIN_SERVER}"
echo "AZURE_CONTAINERAPPS_ENV=${AZURE_CONTAINERAPPS_ENV}"
echo "AZURE_LOG_ANALYTICS=${AZURE_LOG_ANALYTICS}"
