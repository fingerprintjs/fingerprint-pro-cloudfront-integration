# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

.ONESHELL:
.SHELL := /usr/bin/bash
.PHONY: help validate up_vars down_vars apply apply-auto-approve decode destroy-backend destroy destroy-target import plan-destroy plan plan-target
VARS="variables/$(ENV)-$(TIER).tfvars"
REGION?=us-east-1
S3_BUCKET="$(ENV)-${COMPANY}-$(REGION)-terraform-state"
DYNAMODB_TABLE="$(ENV)-$(TIER)-${COMPANY}-$(REGION)-terraform"
#Include directory to have multiple workspaces in the same repo
DIRECTORY=$(shell basename "$$(pwd)")
WORKSPACE="$(ENV)-$(TIER)-$(REGION)-$(DIRECTORY)"
COMPANY=fingerprint
BOLD=$(shell tput -T xterm bold)
RED=$(shell tput -T xterm setaf 1)
GREEN=$(shell tput -T xterm setaf 2)
YELLOW=$(shell tput -T xterm setaf 3)
RESET=$(shell tput -T xterm sgr0)
PAR=200
EXTRA_ARGS?=


CURRENT_FOLDER=$(shell git remote get-url --push origin | awk -F'/' '{print $$5}' | awk -F'.' '{print $$1}')
BUCKET_KEY=$(shell git remote get-url --push origin | awk -F'/' '{print $$5}' | awk -F'.' '{print $$1}')


ifeq ($(ENV)$(REGION),produs-east-1)
AWS_PROFILE?=fpjs_prod
ACCOUNT=421367603048
KEY_ARN=55986a7b-ee99-496f-a4d3-686ad727d46a
else ifeq ($(ENV)$(REGION),prodeu-central-1)
AWS_PROFILE?=fpjs_prod
ACCOUNT=421367603048
KEY_ARN=8d1e9db5-bd1f-4d22-9b0f-1d60f88afeb3
else ifeq ($(ENV)$(REGION),prodeu-north-1)
AWS_PROFILE?=fpjs_prod
ACCOUNT=421367603048
KEY_ARN=e0741c62-076f-4205-99c7-89572c3a72a0
else ifeq ($(ENV)$(REGION),prodeu-west-1)
AWS_PROFILE?=fpjs_prod
ACCOUNT=421367603048
KEY_ARN=bb8af443-ca42-46f9-b1c2-104278968b7f
else ifeq ($(ENV)$(REGION),produs-west-2)
AWS_PROFILE?=fpjs_prod
ACCOUNT=421367603048
KEY_ARN=d11fc899-b403-4b3b-b021-7f5681d63e9f
else ifeq ($(ENV)$(REGION),produs-east-2)
AWS_PROFILE?=fpjs_prod
ACCOUNT=421367603048
KEY_ARN=aab12b4b-5f8e-4a51-b9ab-2e53dd530c71
else ifeq ($(ENV)$(REGION),prodap-south-1)
AWS_PROFILE?=fpjs_prod
ACCOUNT=421367603048
KEY_ARN=d4956b69-69d2-4ee3-ba3e-f11ba61de5ae
else ifeq ($(ENV)$(REGION),rcus-east-1)
AWS_PROFILE?=fpjs_prod
ACCOUNT=421367603048
KEY_ARN=55986a7b-ee99-496f-a4d3-686ad727d46a
else ifeq ($(ENV)$(REGION),rceu-central-1)
AWS_PROFILE?=fpjs_prod
ACCOUNT=421367603048
KEY_ARN=8d1e9db5-bd1f-4d22-9b0f-1d60f88afeb3
else ifeq ($(ENV)$(REGION),rceu-north-1)
AWS_PROFILE?=fpjs_prod
ACCOUNT=421367603048
KEY_ARN=e0741c62-076f-4205-99c7-89572c3a72a0
else ifeq ($(ENV)$(REGION),rceu-west-1)
AWS_PROFILE?=fpjs_prod
ACCOUNT=421367603048
KEY_ARN=bb8af443-ca42-46f9-b1c2-104278968b7f
else ifeq ($(ENV)$(REGION),rcus-east-2)
AWS_PROFILE?=fpjs_prod
ACCOUNT=421367603048
KEY_ARN=aab12b4b-5f8e-4a51-b9ab-2e53dd530c71
else ifeq ($(ENV)$(REGION),rcap-south-1)
AWS_PROFILE?=fpjs_prod
ACCOUNT=421367603048
KEY_ARN=d4956b69-69d2-4ee3-ba3e-f11ba61de5ae
else ifeq ($(ENV)$(REGION),mainus-east-1)
AWS_PROFILE?=fpjs_main
ACCOUNT=271131155785
KEY_ARN=d89683bb-f11a-473a-9a38-df42f47b4e53
else ifeq ($(ENV)$(REGION),devus-east-1)
AWS_PROFILE?=fpjs_dev
ACCOUNT=708050157146
KEY_ARN=1fd4b7e6-1547-4b62-859e-469aa2c0ca83
else ifeq ($(ENV)$(REGION),sandboxus-west-2)
AWS_PROFILE?=fpjs_dev
ACCOUNT=708050157146
KEY_ARN=adb687c6-41b3-4265-ac99-e1589f12254f
else ifeq ($(ENV)$(REGION),devus-east-2)
AWS_PROFILE?=fpjs_dev
ACCOUNT=708050157146
KEY_ARN=f8b583c1-d083-42b3-91ce-58f0296b2513
else ifeq ($(ENV)$(REGION),toolsus-east-1)
AWS_PROFILE?=fpjs_tools
ACCOUNT=963800667800
KEY_ARN=325f175e-bb98-4f05-b3fe-cd3e3aded348
else ifeq ($(ENV)$(REGION),toolsus-east-2)
AWS_PROFILE?=fpjs_tools
ACCOUNT=963800667800
KEY_ARN=5c781627-1151-4b1b-ae3d-7b199e421123
else ifeq ($(ENV)$(REGION),devap-south-1)
AWS_PROFILE?=fpjs_dev
ACCOUNT=708050157146
KEY_ARN=7f6a5c8d-cf92-457e-a3fa-bf4d76739944
else ifeq ($(ENV)$(REGION),stageus-east-1)
AWS_PROFILE?=fpjs_dev
ACCOUNT=708050157146
KEY_ARN=1fd4b7e6-1547-4b62-859e-469aa2c0ca83
else
AWS_PROFILE?=fpjs_dev
ACCOUNT=708050157146
KEY_ARN=mrk-5942c12b997c42cd8b1db02449c63875
endif

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

set-env:
	@if [ -z $(ENV) ]; then \
		echo "$(BOLD)$(RED)ENV was not set$(RESET)"; \
		ERROR=1; \
	 fi
	@if [ -z $(REGION) ]; then \
		echo "$(BOLD)$(RED)REGION was not set$(RESET)"; \
		ERROR=1; \
	 fi
	@if [ ! -z $${ERROR} ] && [ $${ERROR} -eq 1 ]; then \
		echo "$(BOLD)Example usage: \`ENV=demo REGION=us-east-2 make plan\`$(RESET)"; \
		exit 1; \
	 fi
	@if [ ! -f "$(VARS)" ]; then \
		echo "$(BOLD)$(RED)Could not find variables file: $(VARS)$(RESET)"; \
		if ! aws --profile $(AWS_PROFILE) s3api head-object --bucket $(ENV)-${COMPANY}-$(REGION)-terraform-state --key "$(CURRENT_FOLDER)/$(ENV)-$(TIER).tfvars"  > /dev/null 2>&1 ; then
			echo "\n$(ENV)-$(TIER).tfvars not found on $(ENV)-${COMPANY}-$(REGION)-terraform-state/$(CURRENT_FOLDER)\n"; \
			echo "\ncreating a dummy $(ENV)-$(TIER).tfvars file\n"; \
			touch $(VARS); \
		else
			echo "\n$(ENV)-$(TIER).tfvars found\n"; \
			echo -e "\nPulling fresh $(ENV)-$(TIER).tfvars from s3://$(ENV)-${COMPANY}-$(REGION)-terraform-state/$(BUCKET_KEY)/\n"; \
			echo aws --profile $(AWS_PROFILE) s3 cp s3://$(ENV)-${COMPANY}-$(REGION)-terraform-state/$(CURRENT_FOLDER)/$(ENV)-$(TIER).tfvars $(VARS); \
			aws --profile $(AWS_PROFILE) s3 cp s3://$(ENV)-${COMPANY}-$(REGION)-terraform-state/$(CURRENT_FOLDER)/$(ENV)-$(TIER).tfvars $(VARS); \
		fi
	 fi

ifeq ($(REGION),us-east-1)
prep: set-env ## Prepare a new workspace (environment) if needed, configure the tfstate backend, update any modules, and switch to the workspace
	@echo "$(ACCOUNT),$(REGION),$(ENV),$(KEY_ARN),$(AWS_PROFILE)" > /dev/null 2>&1 ;
	@rm -rf .terraform/
	@echo "$(BOLD)Verifying that the S3 bucket $(S3_BUCKET) for remote state exists$(RESET)"
	@if ! aws --profile $(AWS_PROFILE) s3api head-bucket --bucket $(S3_BUCKET) > /dev/null 2>&1 ; then \
		echo "$(BOLD)S3 bucket $(S3_BUCKET) was not found, creating new bucket with versioning enabled to store tfstate$(RESET)"; \
		aws --profile $(AWS_PROFILE) s3api create-bucket \
			--bucket $(S3_BUCKET) \
			--acl private > /dev/null 2>&1 ; \
		aws --profile $(AWS_PROFILE) s3api put-bucket-versioning \
			--bucket $(S3_BUCKET) \
			--versioning-configuration Status=Enabled > /dev/null 2>&1 ; \
		aws --profile $(AWS_PROFILE) s3api put-bucket-encryption \
			--bucket $(S3_BUCKET) \
			--server-side-encryption-configuration '{"Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "aws:kms","KMSMasterKeyID": "$(KEY_ARN)"},"BucketKeyEnabled": true}]}' ; \
		echo "$(BOLD)$(GREEN)S3 bucket $(S3_BUCKET) created$(RESET)"; \
	 else
		echo "$(BOLD)$(GREEN)S3 bucket $(S3_BUCKET) exists$(RESET)"; \
	 fi
	@echo "$(BOLD)Verifying that the DynamoDB table exists for remote state locking$(RESET)"
	@if ! aws --profile $(AWS_PROFILE) dynamodb describe-table --table-name $(DYNAMODB_TABLE) --region $(REGION) > /dev/null 2>&1 ; then \
		echo "$(BOLD)DynamoDB table $(DYNAMODB_TABLE) was not found, creating new DynamoDB table to maintain locks$(RESET)"; \
		aws --profile $(AWS_PROFILE) dynamodb create-table \
        	--region $(REGION) \
        	--table-name $(DYNAMODB_TABLE) \
        	--attribute-definitions AttributeName=LockID,AttributeType=S \
        	--key-schema AttributeName=LockID,KeyType=HASH \
        	--provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 > /dev/null 2>&1 ; \
		echo "$(BOLD)$(GREEN)DynamoDB table $(DYNAMODB_TABLE) created$(RESET)"; \
		echo "Sleeping for 10 seconds to allow DynamoDB state to propagate through AWS"; \
		sleep 10; \
	 else
		echo "$(BOLD)$(GREEN)DynamoDB Table $(DYNAMODB_TABLE) exists$(RESET)"; \
	 fi
	@echo "$(BOLD)Configuring the terraform backend$(RESET)"
	# BACKEND_CONFIG
	@terraform init \
		-input=true \
		-force-copy \
		-upgrade=true \
		-backend=true \
		-backend-config="region=$(REGION)" \
		-backend-config="bucket=$(S3_BUCKET)" \
		-backend-config="key=$(BUCKET_KEY)/$(ENV)-$(TIER).tfstate" \
		-backend-config="dynamodb_table=$(DYNAMODB_TABLE)" \
		-backend-config="encrypt=1" \
		-backend-config="kms_key_id=arn:aws:kms:$(REGION):$(ACCOUNT):key/$(KEY_ARN)" \
	    -backend-config="acl=private" \
		$(EXTRA_ARGS)
	@echo "$(BOLD)Switching to workspace $(WORKSPACE)$(RESET)"
	@terraform workspace select $(WORKSPACE) || terraform workspace new $(WORKSPACE)
else
prep: set-env ## Prepare a new workspace (environment) if needed, configure the tfstate backend, update any modules, and switch to the workspace
	@echo "$(ACCOUNT),$(REGION),$(ENV),$(KEY_ARN),$(AWS_PROFILE)" > /dev/null 2>&1 ;
	@rm -rf .terraform/
	@echo "$(BOLD)Verifying that the S3 bucket $(S3_BUCKET) for remote state exists$(RESET)"
	@if ! aws --profile $(AWS_PROFILE) s3api head-bucket --region $(REGION) --bucket $(S3_BUCKET) > /dev/null 2>&1 ; then \
		echo "$(BOLD)S3 bucket $(S3_BUCKET) was not found, creating new bucket with versioning enabled to store tfstate$(RESET)"; \
		aws --profile $(AWS_PROFILE) s3api create-bucket \
			--bucket $(S3_BUCKET) \
			--acl private \
			--create-bucket-configuration LocationConstraint=$(REGION) \
			--region $(REGION) ; \
		aws --profile $(AWS_PROFILE) s3api put-bucket-versioning \
			--bucket $(S3_BUCKET) \
			--versioning-configuration Status=Enabled ; \
		aws --profile $(AWS_PROFILE) s3api put-bucket-encryption \
			--bucket $(S3_BUCKET) \
			--server-side-encryption-configuration '{"Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "aws:kms","KMSMasterKeyID": "$(KEY_ARN)"},"BucketKeyEnabled": true}]}'  > /dev/null 2>&1 ;\
		echo "$(BOLD)$(GREEN)S3 bucket $(S3_BUCKET) created$(RESET)"; \
	 else
		echo "$(BOLD)$(GREEN)S3 bucket $(S3_BUCKET) exists$(RESET)"; \
	 fi
	@echo "$(BOLD)Verifying that the DynamoDB table exists for remote state locking$(RESET)"
	@if ! aws --profile $(AWS_PROFILE) dynamodb describe-table --table-name $(DYNAMODB_TABLE) --region $(REGION) > /dev/null 2>&1 ; then \
		echo "$(BOLD)DynamoDB table $(DYNAMODB_TABLE) was not found, creating new DynamoDB table to maintain locks$(RESET)"; \
		aws --profile $(AWS_PROFILE) dynamodb create-table \
        	--region $(REGION) \
        	--table-name $(DYNAMODB_TABLE) \
        	--attribute-definitions AttributeName=LockID,AttributeType=S \
        	--key-schema AttributeName=LockID,KeyType=HASH \
        	--provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 > /dev/null 2>&1 ; \
		echo "$(BOLD)$(GREEN)DynamoDB table $(DYNAMODB_TABLE) created$(RESET)"; \
		echo "Sleeping for 10 seconds to allow DynamoDB state to propagate through AWS"; \
		sleep 10; \
	 else
		echo "$(BOLD)$(GREEN)DynamoDB Table $(DYNAMODB_TABLE) exists$(RESET)"; \
	 fi
	@echo "$(BOLD)Configuring the terraform backend$(RESET)"
	# BACKEND_CONFIG
	@terraform init \
		-input=true \
		-force-copy \
		-upgrade=true \
		-backend=true \
		-backend-config="region=$(REGION)" \
		-backend-config="bucket=$(S3_BUCKET)" \
		-backend-config="key=$(BUCKET_KEY)/$(ENV)-$(TIER).tfstate" \
		-backend-config="dynamodb_table=$(DYNAMODB_TABLE)" \
		-backend-config="encrypt=1" \
		-backend-config="kms_key_id=arn:aws:kms:$(REGION):$(ACCOUNT):key/$(KEY_ARN)" \
	    -backend-config="acl=private" \
		$(EXTRA_ARGS)
	@echo "$(BOLD)Switching to workspace $(WORKSPACE)$(RESET)"
	@terraform workspace select $(WORKSPACE) || terraform workspace new $(WORKSPACE)
endif

up_vars:  ## uploads new vars to aws bucket
	@aws --profile $(AWS_PROFILE) s3 cp $(VARS) s3://$(ENV)-${COMPANY}-$(REGION)-terraform-state/$(CURRENT_FOLDER)/$(ENV)-$(TIER).tfvars > /dev/null 2>&1

down_vars:  ## downloads vars from aws bucket
	@aws --profile $(AWS_PROFILE) s3 cp s3://$(ENV)-${COMPANY}-$(REGION)-terraform-state/$(CURRENT_FOLDER)/$(ENV)-$(TIER).tfvars $(VARS) > /dev/null 2>&1

plan: prep ## Show what terraform thinks it will do
	@terraform plan \
		-input=false \
		-lock=true \
		-refresh=true \
		-parallelism=${PAR} \
		-var-file=$(VARS) \
		-var-file=environments/$(ENV)/$(ENV)-$(TIER).tfvars \
		$(EXTRA_ARGS)

plan-no-lock: prep ## Show what terraform thinks it will do
	@terraform plan \
		-input=false \
		-lock=false \
		-refresh=true \
		-parallelism=${PAR} \
		-var-file=$(VARS) \
		-var-file=environments/$(ENV)/$(ENV)-$(TIER).tfvars \
		$(EXTRA_ARGS)

import:  ## Show what terraform thinks it will do
	@terraform import \
		-var-file=$(VARS) \
		-var-file=environments/$(ENV)/$(ENV)-$(TIER).tfvars \
	    ${ADDRESS} "${IMPORT}" \
		$(EXTRA_ARGS)

plan-target: prep ## Shows what a plan looks like for applying a specific resource
	@echo "$(YELLOW)$(BOLD)[INFO]   $(RESET)"; echo "Example to type for the following question: module.rds.aws_route53_record.rds-master"
	@read -p "PLAN target: " DATA && \
		terraform plan \
			-lock=true \
			-input=true \
			-refresh=true \
			-var-file=$(VARS) \
			-var-file=environments/$(ENV)/$(ENV)-$(TIER).tfvars \
			-target=$$DATA \
			$(EXTRA_ARGS)

plan-destroy: prep ## Creates a destruction plan.
	@terraform plan \
		-input=false \
		-refresh=true \
		-destroy \
		-var-file=$(VARS) \
		-var-file=environments/$(ENV)/$(ENV)-$(TIER).tfvars \
		$(EXTRA_ARGS)

apply: prep ## Have terraform do the things. This will cost money.
	@terraform apply \
		-lock=true \
		-input=false \
		-refresh=true \
		-parallelism=${PAR} \
		-var-file=$(VARS) \
		-var-file=environments/$(ENV)/$(ENV)-$(TIER).tfvars \
		$(EXTRA_ARGS)

apply-auto-approve: prep ## Have terraform do the things. This will cost money.
	@terraform apply \
		-lock=true \
		-input=false \
		-refresh=true \
		-parallelism=${PAR} \
		-var-file=$(VARS) \
		-var-file=environments/$(ENV)/$(ENV)-$(TIER).tfvars \
		-auto-approve \
		$(EXTRA_ARGS)

apply-target: prep ## Have terraform do the things. This will cost money.
	@read -p "Apply target: " DATA && \
		terraform apply \
		-lock=true \
		-input=false \
		-refresh=true \
		-parallelism=${PAR} \
		-var-file=$(VARS) \
		-var-file=environments/$(ENV)/$(ENV)-$(TIER).tfvars \
		-target=$$DATA \
		$(EXTRA_ARGS)

destroy: prep ## Destroy the things
	@terraform destroy \
		-lock=true \
		-input=false \
		-refresh=true \
		-var-file=$(VARS) \
		-var-file=environments/$(ENV)/$(ENV)-$(TIER).tfvars \
		$(EXTRA_ARGS)

destroy-target: prep ## Destroy a specific resource. Caution though, this destroys chained resources.
	@echo "$(YELLOW)$(BOLD)[INFO] Specifically destroy a piece of Terraform data.$(RESET)"; echo "Example to type for the following question: module.rds.aws_route53_record.rds-master"
	@read -p "Destroy target: " DATA && \
		terraform destroy \
		-lock=true \
		-input=false \
		-refresh=true \
		-var-file=$(VARS) \
		-var-file=environments/$(ENV)/$(ENV)-$(TIER).tfvars \
		-target=$$DATA \
		$(EXTRA_ARGS)

destroy-backend: ## Destroy S3 bucket and DynamoDB table
	@if ! aws --profile $(AWS_PROFILE) dynamodb delete-table \
		--region $(REGION) \
		--table-name $(DYNAMODB_TABLE) > /dev/null 2>&1 ; then \
			echo "$(BOLD)$(RED)Unable to delete DynamoDB table $(DYNAMODB_TABLE)$(RESET)"; \
	 else
		echo "$(BOLD)$(RED)DynamoDB table $(DYNAMODB_TABLE) does not exist.$(RESET)"; \
	 fi
	@if ! aws --profile $(AWS_PROFILE) s3api delete-objects \
		--region $(REGION) \
		--bucket $(S3_BUCKET) \
		--delete "$$(aws --profile $(AWS_PROFILE) s3api list-object-versions \
						--region $(REGION) \
						--bucket $(S3_BUCKET) \
						--output=json \
						--query='{Objects: Versions[].{Key:Key,VersionId:VersionId}}')" > /dev/null 2>&1 ; then \
			echo "$(BOLD)$(RED)Unable to delete objects in S3 bucket $(S3_BUCKET)$(RESET)"; \
	 fi
	@if ! aws --profile $(AWS_PROFILE) s3api delete-objects \
		--region $(REGION) \
		--bucket $(S3_BUCKET) \
		--delete "$$(aws --profile $(AWS_PROFILE) s3api list-object-versions \
						--region $(REGION) \
						--bucket $(S3_BUCKET) \
						--output=json \
						--query='{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}')" > /dev/null 2>&1 ; then \
			echo "$(BOLD)$(RED)Unable to delete markers in S3 bucket $(S3_BUCKET)$(RESET)"; \
	 fi
	@if ! aws --profile $(AWS_PROFILE)s3api delete-bucket \
		--region $(REGION) \
		--bucket $(S3_BUCKET) > /dev/null 2>&1 ; then \
			echo "$(BOLD)$(RED)Unable to delete S3 bucket $(S3_BUCKET) itself$(RESET)"; \
	 fi

decode: ## Have terraform do the things. This will cost money.
	@echo "$(USER) Secretkey is";
	@terraform output $(USER)-$(IAM_ROLE) | base64 --decode | gpg --decrypt && printf "\n"
	@echo "$(USER) Accesskey is";
	@terraform output $(USER)-$(IAM_ROLE) && printf "\n"
