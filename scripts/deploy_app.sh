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

# Deploy app images to existing Azure Container Apps infra.
#
# Subscription: see resolve order above (run az login; use az account set --subscription ... if needed).
#
# Optional:
#   AZURE_RESOURCE_GROUP=rg-ai-medical-assist-prod
#   ACR_NAME=aimedassistacr
#   AZURE_CONTAINERAPPS_ENV=cae-ai-medical-assist-prod
#   BACKEND_IMAGE_NAME=ai-medical-assist-backend
#   FRONTEND_IMAGE_NAME=ai-medical-assist-frontend
#   BACKEND_CONTAINER_APP=ca-ai-medical-backend
#   FRONTEND_CONTAINER_APP=ca-ai-medical-frontend
#   BACKEND_CPU=1.0
#   BACKEND_MEMORY=2Gi
#   FRONTEND_CPU=0.5
#   FRONTEND_MEMORY=1Gi
#   BACKEND_TARGET_PORT=8000
#   FRONTEND_TARGET_PORT=80
#   IMAGE_TAG=<defaults to git sha or UTC timestamp>
#   ENV_FILE=.env

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

is_secret_key() {
  case "$1" in
    JWT_SECRET|ADMIN_PASSWORD|GROQ_API_KEY|DEEPGRAM_API_KEY|DATABASE_URL)
      return 0
      ;;
    *SECRET*|*PASSWORD*|*TOKEN*|*API_KEY*|*KEY)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

to_secret_name() {
  local key="$1"
  echo "${key}" | tr '[:upper:]_' '[:lower:]-'
}

require_cmd az
require_cmd docker
require_cmd rg

if ! az account show >/dev/null 2>&1; then
  echo "Azure CLI is not logged in. Run: az login"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
resolve_azure_subscription "${ROOT_DIR}" || true
: "${AZURE_SUBSCRIPTION_ID:?Run az login, set default subscription (az account set --subscription ...), or set AZURE_SUBSCRIPTION_ID in the environment or .env}"
AZURE_RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-ai-medical-assist-prod}"
ACR_NAME="${ACR_NAME:-aimedassistacr}"
AZURE_CONTAINERAPPS_ENV="${AZURE_CONTAINERAPPS_ENV:-cae-ai-medical-assist-prod}"
BACKEND_IMAGE_NAME="${BACKEND_IMAGE_NAME:-ai-medical-assist-backend}"
FRONTEND_IMAGE_NAME="${FRONTEND_IMAGE_NAME:-ai-medical-assist-frontend}"
BACKEND_CONTAINER_APP="${BACKEND_CONTAINER_APP:-ca-ai-medical-backend}"
FRONTEND_CONTAINER_APP="${FRONTEND_CONTAINER_APP:-ca-ai-medical-frontend}"
BACKEND_CPU="${BACKEND_CPU:-1.0}"
BACKEND_MEMORY="${BACKEND_MEMORY:-2Gi}"
FRONTEND_CPU="${FRONTEND_CPU:-0.5}"
FRONTEND_MEMORY="${FRONTEND_MEMORY:-1Gi}"
BACKEND_TARGET_PORT="${BACKEND_TARGET_PORT:-8000}"
FRONTEND_TARGET_PORT="${FRONTEND_TARGET_PORT:-80}"
IMAGE_TAG="${IMAGE_TAG:-${GITHUB_SHA:-$(date -u +%Y%m%d%H%M%S)}}"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}"
  echo "Provide ENV_FILE path or create .env from .env.example."
  exit 1
fi

ENV_VARS=()
SECRET_DEFS=()
SECRET_ENV_VARS=()
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "${line// }" ]] && continue
  [[ "${line}" == \#* ]] && continue
  if [[ "${line}" == *=* ]]; then
    key="${line%%=*}"
    value="${line#*=}"
    key="${key%$'\r'}"
    value="${value%$'\r'}"
    [[ -z "${key}" ]] && continue
    [[ "${key}" == VITE_* ]] && continue
    [[ "${key}" == AZURE_SUBSCRIPTION_ID ]] && continue
    if is_secret_key "${key}"; then
      secret_name="$(to_secret_name "${key}")"
      SECRET_DEFS+=("${secret_name}=${value}")
      SECRET_ENV_VARS+=("${key}=secretref:${secret_name}")
    else
      ENV_VARS+=("${key}=${value}")
    fi
  fi
done < "${ENV_FILE}"

echo "Setting Azure subscription..."
az account set --subscription "${AZURE_SUBSCRIPTION_ID}"

echo "Validating required infra..."
az group show --name "${AZURE_RESOURCE_GROUP}" --output none
az acr show --name "${ACR_NAME}" --resource-group "${AZURE_RESOURCE_GROUP}" --output none
az containerapp env show --name "${AZURE_CONTAINERAPPS_ENV}" --resource-group "${AZURE_RESOURCE_GROUP}" --output none

ACR_LOGIN_SERVER="$(az acr show --name "${ACR_NAME}" --resource-group "${AZURE_RESOURCE_GROUP}" --query loginServer -o tsv)"
BACKEND_IMAGE="${ACR_LOGIN_SERVER}/${BACKEND_IMAGE_NAME}:${IMAGE_TAG}"
FRONTEND_IMAGE="${ACR_LOGIN_SERVER}/${FRONTEND_IMAGE_NAME}:${IMAGE_TAG}"

echo "Logging into ACR..."
az acr login --name "${ACR_NAME}" >/dev/null

echo "Building and pushing backend image: ${BACKEND_IMAGE}"
docker build -t "${BACKEND_IMAGE}" "${ROOT_DIR}/backend"
docker push "${BACKEND_IMAGE}"

echo "Deploying backend Container App..."
BACKEND_ALL_ENV_VARS=("${ENV_VARS[@]}" "${SECRET_ENV_VARS[@]}")
if az containerapp show --name "${BACKEND_CONTAINER_APP}" --resource-group "${AZURE_RESOURCE_GROUP}" >/dev/null 2>&1; then
  if ((${#SECRET_DEFS[@]} > 0)); then
    az containerapp secret set \
      --name "${BACKEND_CONTAINER_APP}" \
      --resource-group "${AZURE_RESOURCE_GROUP}" \
      --secrets "${SECRET_DEFS[@]}" \
      --output none
  fi
  BACKEND_UPDATE_CMD=(
    az containerapp update
    --name "${BACKEND_CONTAINER_APP}"
    --resource-group "${AZURE_RESOURCE_GROUP}"
    --image "${BACKEND_IMAGE}"
    --cpu "${BACKEND_CPU}"
    --memory "${BACKEND_MEMORY}"
    --output none
  )
  if ((${#BACKEND_ALL_ENV_VARS[@]} > 0)); then
    BACKEND_UPDATE_CMD+=(--set-env-vars "${BACKEND_ALL_ENV_VARS[@]}")
  fi
  "${BACKEND_UPDATE_CMD[@]}"
else
  BACKEND_CREATE_CMD=(
    az containerapp create
    --name "${BACKEND_CONTAINER_APP}"
    --resource-group "${AZURE_RESOURCE_GROUP}"
    --environment "${AZURE_CONTAINERAPPS_ENV}"
    --image "${BACKEND_IMAGE}"
    --target-port "${BACKEND_TARGET_PORT}"
    --ingress external
    --registry-server "${ACR_LOGIN_SERVER}"
    --cpu "${BACKEND_CPU}"
    --memory "${BACKEND_MEMORY}"
    --output none
  )
  if ((${#BACKEND_ALL_ENV_VARS[@]} > 0)); then
    BACKEND_CREATE_CMD+=(--env-vars "${BACKEND_ALL_ENV_VARS[@]}")
  fi
  if ((${#SECRET_DEFS[@]} > 0)); then
    BACKEND_CREATE_CMD+=(--secrets "${SECRET_DEFS[@]}")
  fi
  "${BACKEND_CREATE_CMD[@]}"
fi

BACKEND_FQDN="$(az containerapp show \
  --name "${BACKEND_CONTAINER_APP}" \
  --resource-group "${AZURE_RESOURCE_GROUP}" \
  --query properties.configuration.ingress.fqdn -o tsv)"

if [[ -z "${BACKEND_FQDN}" ]]; then
  echo "Failed to resolve backend public FQDN."
  exit 1
fi

BACKEND_PUBLIC_API_URL="https://${BACKEND_FQDN}/api"
echo "Backend API URL: ${BACKEND_PUBLIC_API_URL}"

echo "Building and pushing frontend image: ${FRONTEND_IMAGE}"
docker build \
  --build-arg "VITE_API_URL=${BACKEND_PUBLIC_API_URL}" \
  -t "${FRONTEND_IMAGE}" \
  "${ROOT_DIR}/frontend"
docker push "${FRONTEND_IMAGE}"

echo "Deploying frontend Container App..."
if az containerapp show --name "${FRONTEND_CONTAINER_APP}" --resource-group "${AZURE_RESOURCE_GROUP}" >/dev/null 2>&1; then
  az containerapp update \
    --name "${FRONTEND_CONTAINER_APP}" \
    --resource-group "${AZURE_RESOURCE_GROUP}" \
    --image "${FRONTEND_IMAGE}" \
    --cpu "${FRONTEND_CPU}" \
    --memory "${FRONTEND_MEMORY}" \
    --output none
else
  az containerapp create \
    --name "${FRONTEND_CONTAINER_APP}" \
    --resource-group "${AZURE_RESOURCE_GROUP}" \
    --environment "${AZURE_CONTAINERAPPS_ENV}" \
    --image "${FRONTEND_IMAGE}" \
    --target-port "${FRONTEND_TARGET_PORT}" \
    --ingress external \
    --registry-server "${ACR_LOGIN_SERVER}" \
    --cpu "${FRONTEND_CPU}" \
    --memory "${FRONTEND_MEMORY}" \
    --output none
fi

FRONTEND_FQDN="$(az containerapp show \
  --name "${FRONTEND_CONTAINER_APP}" \
  --resource-group "${AZURE_RESOURCE_GROUP}" \
  --query properties.configuration.ingress.fqdn -o tsv)"

if [[ -n "${FRONTEND_FQDN}" ]]; then
  FRONTEND_URL="https://${FRONTEND_FQDN}"
  if [[ " ${ENV_VARS[*]} " == *" CORS_ORIGINS="* ]]; then
    base_cors="$(printf '%s\n' "${ENV_VARS[@]}" | rg '^CORS_ORIGINS=' | sed 's/^CORS_ORIGINS=//')"
    if [[ "${base_cors}" != *"${FRONTEND_URL}"* ]]; then
      az containerapp update \
        --name "${BACKEND_CONTAINER_APP}" \
        --resource-group "${AZURE_RESOURCE_GROUP}" \
        --set-env-vars "CORS_ORIGINS=${base_cors},${FRONTEND_URL}" \
        --output none
    fi
  fi
fi

echo ""
echo "Deploy complete."
echo "Backend app:  https://${BACKEND_FQDN}"
echo "Backend API:  ${BACKEND_PUBLIC_API_URL}"
if [[ -n "${FRONTEND_FQDN}" ]]; then
  echo "Frontend app: https://${FRONTEND_FQDN}"
fi
echo "Image tag:    ${IMAGE_TAG}"
