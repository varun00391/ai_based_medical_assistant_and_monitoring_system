#!/bin/bash

# ===== CONFIG =====
RESOURCE_GROUP="my-rg"
LOCATION="centralindia"
ACR_NAME="varunsingh2103"
APP_NAME="my-container-app"
ENV_NAME="my-container-env"   #

# ===== CREATE INFRA =====
az group create --name $RESOURCE_GROUP --location $LOCATION

az acr create \
  --name $ACR_NAME \
  --resource-group $RESOURCE_GROUP \
  --sku Basic

az containerapp env create \
  --name $ENV_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

az containerapp create \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $ENV_NAME \
  --image mcr.microsoft.com/azuredocs/containerapps-helloworld:latest \
  --target-port 8000 \
  --ingress external \
  --registry-server $ACR_NAME.azurecr.io