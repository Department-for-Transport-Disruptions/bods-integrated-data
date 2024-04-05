NAPTAN_BUCKET_NAME="integrated-data-naptan-local"
BODS_TXC_ZIPPED_BUCKET_NAME="integrated-data-bods-txc-zipped-local"
BODS_TXC_UNZIPPED_BUCKET_NAME="integrated-data-bods-txc-local"
TNDS_TXC_ZIPPED_BUCKET_NAME="integrated-data-tnds-txc-zipped-local"
TNDS_TXC_UNZIPPED_BUCKET_NAME="integrated-data-tnds-txc-local"
TNDS_TXC_FTP_CREDS_ARN=""
AVL_SIRI_BUCKET_NAME="avl-siri-vm-local"
AVL_UNPROCESSED_SIRI_BUCKET_NAME="integrated-data-siri-vm-local"
AVL_SUBSCRIPTION_TABLE_NAME="integrated-data-avl-subscriptions-local"
LAMBDA_ZIP_LOCATION="src/functions/dist"


dev: dev-containers-up
setup: dev-containers-up build-cli-helpers create-buckets install-deps migrate-local-db-to-latest create-lambdas create-avl-local-env

# This is required as the subst function used below would interpret the comma as a parameter separator
comma:= ,

define create_lambda

	awslocal lambda create-function \
	 --function-name $(1) \
	 --runtime nodejs20.x \
	 --zip-file fileb://${LAMBDA_ZIP_LOCATION}/$(2).zip \
	 --handler index.handler \
	 --role arn:aws:iam::000000000000:role/lambda-role \
	 --environment "Variables={$(subst ;,$(comma),$(3))}" \
	 --timeout 600 \
	 || true
endef

# Dev

asdf:
	asdf plugin add awscli && \
	asdf plugin add terraform https://github.com/asdf-community/asdf-hashicorp.git && \
	asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git && \
	asdf plugin-add sops https://github.com/feniix/asdf-sops.git && \
	asdf plugin-add tflocal https://github.com/localstack/terraform-local.git && \
	asdf install

dev-containers-up:
	docker compose --project-directory dev up -d

dev-containers-down:
	docker compose --project-directory dev down

dev-containers-kill:
	docker compose --project-directory dev kill

# Terraform

tf-init-%:
	terraform -chdir=terraform/$* init

tf-plan-%:
	terraform -chdir=terraform/$* plan

tf-apply-%:
	terraform -chdir=terraform/$* apply

# Build

create-avl-local-env:
	tflocal -chdir=terraform/local init && \
	tflocal -chdir=terraform/local apply --auto-approve

build-cli-helpers:
	cd cli-helpers && pnpm i && pnpm run build

install-deps:
	cd src && pnpm i

build-functions:
	cd src && pnpm build-all

lint-functions:
	cd src && pnpm lint

test-functions:
	cd src && pnpm test:ci

# Secrets

edit-secrets-%:
	cd terraform/$* && sops secrets.enc.json

# Localstack

create-buckets:
	awslocal s3api create-bucket --region eu-west-2 --bucket ${NAPTAN_BUCKET_NAME} --create-bucket-configuration LocationConstraint=eu-west-2 || true
	awslocal s3api create-bucket --region eu-west-2 --bucket ${BODS_TXC_ZIPPED_BUCKET_NAME} --create-bucket-configuration LocationConstraint=eu-west-2 || true
	awslocal s3api create-bucket --region eu-west-2 --bucket ${BODS_TXC_UNZIPPED_BUCKET_NAME} --create-bucket-configuration LocationConstraint=eu-west-2 || true
	awslocal s3api create-bucket --region eu-west-2 --bucket ${TNDS_TXC_ZIPPED_BUCKET_NAME} --create-bucket-configuration LocationConstraint=eu-west-2 || true
	awslocal s3api create-bucket --region eu-west-2 --bucket ${TNDS_TXC_UNZIPPED_BUCKET_NAME} --create-bucket-configuration LocationConstraint=eu-west-2 || true
	awslocal s3api create-bucket --region eu-west-2 --bucket ${AVL_SIRI_BUCKET_NAME} --create-bucket-configuration LocationConstraint=eu-west-2 || true
	awslocal s3api create-bucket --region eu-west-2 --bucket ${AVL_UNPROCESSED_SIRI_BUCKET_NAME} --create-bucket-configuration LocationConstraint=eu-west-2 || true


# Database

migrate-local-db-to-latest:
	IS_LOCAL=true npx tsx -e "import {handler} from './src/functions/db-migrator'; handler().catch(e => console.error(e))"

rollback-last-local-db-migration:
	IS_LOCAL=true ROLLBACK=true npx tsx -e "import {handler} from './src/functions/db-migrator'; handler().catch(e => console.error(e))"

bastion-tunnel:
	./scripts/bastion-tunnel.sh

get-db-credentials:
	./scripts/get-db-credentials.sh

# Dates

get-bank-holiday-dates:
	curl https://www.gov.uk/bank-holidays.json --output src/shared/uk-bank-holidays.json

# Naptan

run-local-naptan-retriever:
	IS_LOCAL=true BUCKET_NAME=${NAPTAN_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/naptan-retriever'; handler().catch(e => console.error(e))"

run-local-naptan-uploader:
	IS_LOCAL=true npx tsx -e "import {handler} from './src/functions/naptan-uploader'; handler({Records:[{s3:{bucket:{name:'${NAPTAN_BUCKET_NAME}'},object:{key:'Stops.csv'}}}]}).catch(e => console.error(e))"

run-full-local-naptan-pipeline: run-local-naptan-retriever run-local-naptan-uploader

invoke-local-naptan-retriever:
	awslocal lambda invoke --function-name naptan-retriever-local --output text /dev/stdout --cli-read-timeout 0

invoke-local-naptan-uploader:
	awslocal lambda invoke --function-name naptan-uploader-local --payload '{"Records":[{"s3":{"bucket":{"name":${NAPTAN_BUCKET_NAME}},"object":{"key":"Stops.csv"}}}]}' --output text /dev/stdout --cli-read-timeout 0

invoke-full-local-naptan-pipeline: invoke-local-naptan-retriever invoke-local-naptan-uploader

# TXC

run-local-bods-txc-retriever:
	IS_LOCAL=true TXC_ZIPPED_BUCKET_NAME=${BODS_TXC_ZIPPED_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/bods-txc-retriever'; handler().catch(e => console.error(e))"

run-local-tnds-txc-retriever:
	IS_LOCAL=true TXC_ZIPPED_BUCKET_NAME=${TNDS_TXC_ZIPPED_BUCKET_NAME} TNDS_FTP_ARN=${TNDS_TXC_FTP_CREDS_ARN} npx tsx -e "import {handler} from './src/functions/tnds-txc-retriever'; handler().catch(e => console.error(e))"

run-local-txc-retriever:
	IS_LOCAL=true BODS_TXC_RETRIEVER_FUNCTION_NAME="dummy" TNDS_TXC_RETRIEVER_FUNCTION_NAME="dummy" npx tsx -e "import {handler} from './src/functions/txc-retriever'; handler().catch(e => console.error(e))"

run-bods-txc-unzipper:
	FILE=${FILE} IS_LOCAL=true UNZIPPED_BUCKET_NAME=${BODS_TXC_UNZIPPED_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/unzipper'; handler({Records:[{s3:{bucket:{name:'${BODS_TXC_ZIPPED_BUCKET_NAME}'},object:{key:'${FILE}'}}}]}).catch(e => console.error(e))"

run-tnds-txc-unzipper:
	FILE=${FILE} IS_LOCAL=true UNZIPPED_BUCKET_NAME=${TNDS_TXC_UNZIPPED_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/unzipper'; handler({Records:[{s3:{bucket:{name:'${TNDS_TXC_ZIPPED_BUCKET_NAME}'},object:{key:'${FILE}'}}}]}).catch(e => console.error(e))"

run-local-bods-txc-processor:
	FILE=${FILE} IS_LOCAL=true npx tsx -e "import {handler} from './src/functions/txc-processor'; handler({Records:[{s3:{bucket:{name:'${BODS_TXC_UNZIPPED_BUCKET_NAME}'},object:{key:'${FILE}'}}}]}).catch(e => console.error(e))"

invoke-local-bods-txc-retriever:
	awslocal lambda invoke --function-name bods-txc-retriever-local --output text /dev/stdout --cli-read-timeout 0

invoke-local-tnds-txc-retriever:
	awslocal lambda invoke --function-name tnds-txc-retriever-local  --output text /dev/stdout --cli-read-timeout 0

invoke-local-txc-retriever:
	awslocal lambda invoke --function-name txc-retriever-local  --output text /dev/stdout --cli-read-timeout 0

invoke-local-bods-txc-unzipper:
	FILE=${FILE} awslocal lambda invoke --function-name bods-txc-unzipper-local --payload '{"Records":[{"s3":{"bucket":{"name":${BODS_TXC_ZIPPED_BUCKET_NAME}},"object":{"key":"${FILE}"}}}]}' --output text /dev/stdout --cli-read-timeout 0

invoke-local-tnds-txc-unzipper:
	FILE=${FILE} awslocal lambda invoke --function-name tnds-txc-unzipper-local --payload '{"Records":[{"s3":{"bucket":{"name":${TNDS_TXC_ZIPPED_BUCKET_NAME}},"object":{"key":"${FILE}"}}}]}' --output text /dev/stdout --cli-read-timeout 0

invoke-local-bods-txc-processor:
	FILE=${FILE} awslocal lambda invoke --function-name bods-txc-processor-local --payload '{"Records":[{"s3":{"bucket":{"name":${BODS_TXC_UNZIPPED_BUCKET_NAME}},"object":{"key":"${FILE}"}}}]}' --output text /dev/stdout --cli-read-timeout 0


# AVL

run-local-avl-subscriber:
	IS_LOCAL=true TABLE_NAME=${AVL_SUBSCRIPTION_TABLE_NAME} npx tsx -e "import {handler} from './src/functions/avl-subscriber'; handler({body: '\{\"dataProducerEndpoint\":\"http://ee7swjlq51jq0ri51nl3hlexwdleoc8n.lambda-url.eu-west-2.localhost.localstack.cloud:4566\",\"description\":\"description\",\"shortDescription\":\"shortDescription\",\"username\":\"test-user\",\"password\":\"dummy-password\"\}' }).catch(e => console.error(e))"

invoke-local-avl-subscriber:
	awslocal lambda invoke --function-name avl-subscriber-local output.txt --cli-read-timeout 0 --cli-binary-format raw-in-base64-out --payload file://payload.json

run-local-avl-data-endpoint:
	IS_LOCAL=true BUCKET_NAME=${AVL_UNPROCESSED_SIRI_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/avl-data-endpoint'; handler({body: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Siri/>', pathParameters: { subscriptionId:'1234'}}).catch(e => console.error(e))"

run-local-avl-aggregate-siri-vm:
	IS_LOCAL=true BUCKET_NAME=${AVL_SIRI_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/avl-aggregate-siri-vm'; handler()"

invoke-local-avl-aggregate-siri-vm:
	awslocal lambda invoke --function-name avl-aggregate-siri-vm-local  --output text /dev/stdout --cli-read-timeout 0

run-local-avl-mock-data-producer-subscribe:
	npx tsx -e "import {handler} from './src/functions/avl-mock-data-producer/subscribe'; handler().catch(e => console.error(e))"

run-local-avl-mock-data-producer-send-data:
	STAGE=local DATA_ENDPOINT="https://www.local.com" npx tsx -e "import {handler} from './src/functions/avl-mock-data-producer/send-data'; handler().catch(e => console.error(e))"

invoke-local-avl-mock-data-producer-subscribe:
	awslocal lambda invoke --function-name avl-mock-data-producer-subscribe-local --output text /dev/stdout --cli-read-timeout 0

invoke-local-avl-mock-data-producer-send-data:
	awslocal lambda invoke --function-name avl-mock-data-producer-send-data-local output.txt --cli-read-timeout 0

# Lambdas
create-lambdas: \
	create-lambda-avl-aggregate-siri-vm \
	create-lambda-naptan-retriever \
	create-lambda-naptan-uploader \
	create-lambda-bods-txc-retriever \
	create-lambda-bods-txc-unzipper \
	create-lambda-tnds-txc-retriever \
	create-lambda-tnds-txc-unzipper \
	create-lambda-txc-retriever \
	create-lambda-txc-processor

delete-lambdas: \
	delete-lambda-avl-aggregate-siri-vm \
	delete-lambda-naptan-retriever \
	delete-lambda-naptan-uploader \
	delete-lambda-bods-txc-retriever \
	delete-lambda-bods-txc-unzipper \
	delete-lambda-tnds-txc-retriever \
	delete-lambda-tnds-txc-unzipper \
	delete-lambda-txc-retriever \
	delete-lambda-txc-processor

remake-lambdas: delete-lambdas create-lambdas

remake-lambda-%:
	@$(MAKE) delete-lambda-$*
	@$(MAKE) create-lambda-$*

delete-lambda-%:
	awslocal lambda delete-function --function-name $*-local || true

create-lambda-avl-aggregate-siri-vm:
	$(call create_lambda,avl-aggregate-siri-vm-local,avl-aggregate-siri-vm,IS_LOCAL=true;BUCKET_NAME=${AVL_SIRI_BUCKET_NAME})

create-lambda-naptan-retriever:
	$(call create_lambda,naptan-retriever-local,naptan-retriever,IS_LOCAL=true;BUCKET_NAME=${NAPTAN_BUCKET_NAME})

create-lambda-naptan-uploader:
	$(call create_lambda,naptan-uploader-local,naptan-uploader,IS_LOCAL=true)

create-lambda-bods-txc-retriever:
	$(call create_lambda,bods-txc-retriever-local,bods-txc-retriever,IS_LOCAL=true;TXC_ZIPPED_BUCKET_NAME=${BODS_TXC_ZIPPED_BUCKET_NAME})

create-lambda-bods-txc-unzipper:
	$(call create_lambda,bods-txc-unzipper-local,unzipper,IS_LOCAL=true;UNZIPPED_BUCKET_NAME=${BODS_TXC_UNZIPPED_BUCKET_NAME})

create-lambda-tnds-txc-retriever:
	$(call create_lambda,tnds-txc-retriever-local,tnds-txc-retriever,IS_LOCAL=true;TXC_ZIPPED_BUCKET_NAME=${TNDS_TXC_ZIPPED_BUCKET_NAME};TNDS_FTP_ARN=${TNDS_TXC_FTP_CREDS_ARN})

create-lambda-tnds-txc-unzipper:
	$(call create_lambda,tnds-txc-unzipper-local,unzipper,IS_LOCAL=true;UNZIPPED_BUCKET_NAME=${TNDS_TXC_UNZIPPED_BUCKET_NAME})

create-lambda-txc-retriever:
	$(call create_lambda,txc-retriever-local,txc-retriever,IS_LOCAL=true;BODS_TXC_RETRIEVER_FUNCTION_NAME=bods-txc-retriever-local;TNDS_TXC_RETRIEVER_FUNCTION_NAME=tnds-txc-retriever-local)

create-lambda-txc-processor:
	$(call create_lambda,txc-processor-local,txc-processor,IS_LOCAL=true)

# CLI Helper Commands

create-mock-avl-data-producer:
	cd cli-helpers && \
	./bin/run.js create-avl-mock-data-producer