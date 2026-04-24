#!/bin/bash

APP_NAME="my-container-app"
RESOURCE_GROUP="my-rg"

ENV_VARS=""

while IFS='=' read -r key value
do
  # skip comments & empty lines
  if [[ -n "$key" && ! "$key" =~ ^# ]]; then
    ENV_VARS="$ENV_VARS $key=$value"
  fi
done < .env

echo "Uploading environment variables..."

az containerapp update \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars $ENV_VARS

echo "Done ✅"