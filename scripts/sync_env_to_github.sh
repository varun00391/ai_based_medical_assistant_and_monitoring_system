#!/usr/bin/env bash

set -euo pipefail

# Upload .env keys into GitHub environment secrets/variables.
#
# Defaults:
#   ENV_FILE=.env
#   GH_ENVIRONMENT=prod
#
# Usage:
#   GH_ENVIRONMENT=prod ./scripts/sync_env_to_github.sh
#   ENV_FILE=.env GH_ENVIRONMENT=staging ./scripts/sync_env_to_github.sh

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_cmd gh

ENV_FILE="${ENV_FILE:-.env}"
GH_ENVIRONMENT="${GH_ENVIRONMENT:-prod}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Env file not found: ${ENV_FILE}"
  exit 1
fi

is_secret_key() {
  case "$1" in
    JWT_SECRET|ADMIN_PASSWORD|GROQ_API_KEY|DEEPGRAM_API_KEY|DATABASE_URL)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_repo_variable_key() {
  case "$1" in
    AZURE_REGION|AZURE_RESOURCE_GROUP|ACR_NAME|ACR_LOGIN_SERVER|AZURE_CONTAINERAPPS_ENV|AZURE_LOG_ANALYTICS|BACKEND_IMAGE_NAME|FRONTEND_IMAGE_NAME|BACKEND_CONTAINER_APP|FRONTEND_CONTAINER_APP)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

echo "Uploading values from ${ENV_FILE}"
echo "Environment scope for app config: ${GH_ENVIRONMENT}"

while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip blanks and comments
  [[ -z "${line// }" ]] && continue
  [[ "${line}" == \#* ]] && continue

  key="${line%%=*}"
  value="${line#*=}"

  # Trim possible CR (Windows-style files)
  key="${key%$'\r'}"
  value="${value%$'\r'}"

  if [[ -z "${key}" ]]; then
    continue
  fi

  if is_repo_variable_key "${key}"; then
    gh variable set "${key}" --body "${value}"
    echo "Set repo variable: ${key}"
    continue
  fi

  if is_secret_key "${key}"; then
    gh secret set "${key}" --env "${GH_ENVIRONMENT}" --body "${value}"
    echo "Set ${GH_ENVIRONMENT} environment secret: ${key}"
  else
    gh variable set "${key}" --env "${GH_ENVIRONMENT}" --body "${value}"
    echo "Set ${GH_ENVIRONMENT} environment variable: ${key}"
  fi
done < "${ENV_FILE}"

echo ""
echo "Sync complete."
echo "Review GitHub -> Settings -> Secrets and variables to confirm."
