NAPTAN_BUCKET_NAME="integrated-data-naptan-local"
BODS_TXC_ZIPPED_BUCKET_NAME="integrated-data-bods-txc-zipped-local"
BODS_TXC_UNZIPPED_BUCKET_NAME="integrated-data-bods-txc-local"
TNDS_TXC_ZIPPED_BUCKET_NAME="integrated-data-tnds-txc-zipped-local"
TNDS_TXC_UNZIPPED_BUCKET_NAME="integrated-data-tnds-txc-local"
TNDS_TXC_FTP_CREDS_ARN=""
AVL_SIRI_BUCKET_NAME="avl-siri-vm-local"
AVL_UNPROCESSED_SIRI_BUCKET_NAME="integrated-data-siri-vm-local"
AVL_SUBSCRIPTION_TABLE_NAME="integrated-data-avl-subscriptions-local"
GTFS_ZIPPED_BUCKET_NAME="integrated-data-gtfs-local"
GTFS_RT_BUCKET_NAME="integrated-data-gtfs-rt-local"
LAMBDA_ZIP_LOCATION="src/functions/dist"
NOC_BUCKET_NAME="integrated-data-noc-local"
TXC_QUEUE_NAME="integrated-data-txc-queue-local"

dev: dev-containers-up
setup: dev-containers-up create-buckets install-deps migrate-local-db-to-latest create-dynamodb-table create-lambdas

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
	awslocal s3api create-bucket --region eu-west-2 --bucket ${GTFS_ZIPPED_BUCKET_NAME} --create-bucket-configuration LocationConstraint=eu-west-2 || true
	awslocal s3api create-bucket --region eu-west-2 --bucket ${GTFS_RT_BUCKET_NAME} --create-bucket-configuration LocationConstraint=eu-west-2 || true
	awslocal s3api create-bucket --region eu-west-2 --bucket ${NOC_BUCKET_NAME} --create-bucket-configuration LocationConstraint=eu-west-2 || true

create-dynamodb-table:
	awslocal dynamodb create-table \
    --table-name integrated-data-avl-subscriptions-local \
    --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
    --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
    --billing-mode PAY_PER_REQUEST \
    --region eu-west-2

create-txc-queue:
	queue_url=$$(awslocal sqs create-queue --queue-name ${TXC_QUEUE_NAME} --query 'QueueUrl' --output text); \
	queue_arn=$$(awslocal sqs get-queue-attributes --queue-url $$queue_url --attribute-names QueueArn --query 'Attributes.QueueArn' --output text); \
	awslocal s3api put-bucket-notification-configuration --bucket ${BODS_TXC_UNZIPPED_BUCKET_NAME} --notification-configuration "{\"QueueConfigurations\": [{\"QueueArn\": \"$$queue_arn\", \"Events\":[\"s3:ObjectCreated:*\"]}]}"
	awslocal lambda create-event-source-mapping --event-source-arn $$queue_arn --function-name txc-processor-local

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
	FILE="${FILE}" IS_LOCAL=true UNZIPPED_BUCKET_NAME=${BODS_TXC_UNZIPPED_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/unzipper'; handler({Records:[{s3:{bucket:{name:'${BODS_TXC_ZIPPED_BUCKET_NAME}'},object:{key:\"${FILE}\"}}}]}).catch(e => console.error(e))"

run-tnds-txc-unzipper:
	FILE="${FILE}" IS_LOCAL=true UNZIPPED_BUCKET_NAME=${TNDS_TXC_UNZIPPED_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/unzipper'; handler({Records:[{s3:{bucket:{name:'${TNDS_TXC_ZIPPED_BUCKET_NAME}'},object:{key:\"${FILE}\"}}}]}).catch(e => console.error(e))"

run-local-bods-txc-processor:
	FILE="${FILE}" IS_LOCAL=true npx tsx -e "import {handler} from './src/functions/txc-processor'; handler({Records:[{body: '{\"Records\": [{\"s3\":{\"bucket\":{\"name\":\"${BODS_TXC_UNZIPPED_BUCKET_NAME}\"},\"object\":{\"key\":\"${FILE}\"}}}]}'}]}).catch(e => console.error(e))"

run-local-gtfs-timetables-generator:
	FILE=${FILE} IS_LOCAL=true npx tsx -e "import {handler} from './src/functions/gtfs-timetables-generator'; handler().catch(e => console.error(e))"

invoke-local-bods-txc-retriever:
	awslocal lambda invoke --function-name bods-txc-retriever-local --output text /dev/stdout --cli-read-timeout 0

invoke-local-tnds-txc-retriever:
	awslocal lambda invoke --function-name tnds-txc-retriever-local --output text /dev/stdout --cli-read-timeout 0

invoke-local-txc-retriever:
	awslocal lambda invoke --function-name txc-retriever-local --output text /dev/stdout --cli-read-timeout 0

invoke-local-bods-txc-unzipper:
	FILE=${FILE} awslocal lambda invoke --function-name bods-txc-unzipper-local --payload '{"Records":[{"s3":{"bucket":{"name":${BODS_TXC_ZIPPED_BUCKET_NAME}},"object":{"key":"${FILE}"}}}]}' --output text /dev/stdout --cli-read-timeout 0

invoke-local-tnds-txc-unzipper:
	FILE=${FILE} awslocal lambda invoke --function-name tnds-txc-unzipper-local --payload '{"Records":[{"s3":{"bucket":{"name":${TNDS_TXC_ZIPPED_BUCKET_NAME}},"object":{"key":"${FILE}"}}}]}' --output text /dev/stdout --cli-read-timeout 0

invoke-local-bods-txc-processor:
	FILE=${FILE} awslocal lambda invoke --function-name txc-processor-local --payload '{"Records":[{"s3":{"bucket":{"name":${BODS_TXC_UNZIPPED_BUCKET_NAME}},"object":{"key":"${FILE}"}}}]}' --output text /dev/stdout --cli-read-timeout 0


# GTFS

run-local-gtfs-downloader:
	IS_LOCAL=true BUCKET_NAME=${GTFS_ZIPPED_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/gtfs-downloader'; handler().then((response) => console.log(response)).catch(e => console.error(e))"

invoke-local-gtfs-downloader:
	awslocal lambda invoke --function-name gtfs-downloader-local --output text /dev/stdout --cli-read-timeout 0

run-gtfs-rt-generator:
	IS_LOCAL=true BUCKET_NAME=${GTFS_RT_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/gtfs-rt-generator'; handler().catch(e => console.error(e))"

invoke-local-gtfs-rt-generator:
	awslocal lambda invoke --function-name gtfs-rt-generator-local --output text /dev/stdout --cli-read-timeout 0

# AVL

run-local-avl-subscriber:
	IS_LOCAL=true TABLE_NAME=${AVL_SUBSCRIPTION_TABLE_NAME} npx tsx -e "import {handler} from './src/functions/avl-subscriber'; handler({body: '\{\"dataProducerEndpoint\":\"https://mock-data-producer.com\",\"description\":\"description\",\"shortDescription\":\"shortDescription\",\"username\":\"test-user\",\"password\":\"dummy-password\"\}' }).catch(e => console.error(e))"

run-local-avl-data-endpoint:
	IS_LOCAL=true FILE="${FILE}" BUCKET_NAME=${AVL_UNPROCESSED_SIRI_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/avl-data-endpoint'; handler({body: '$(shell cat ${FILE} | sed -e 's/\"/\\"/g')', pathParameters: { subscriptionId:'1234'}}).catch(e => console.error(e))"

run-local-avl-processor:
	IS_LOCAL=true FILE="${FILE}" npx tsx -e "import {handler} from './src/functions/avl-processor'; handler({Records:[{body:'{\"Records\":[{\"s3\":{\"bucket\":{\"name\":\"${AVL_UNPROCESSED_SIRI_BUCKET_NAME}\"},\"object\":{\"key\":\"${FILE}\"}}}]}'}]}).catch(e => console.error(e))"

invoke-local-avl-processor:
	awslocal lambda invoke --function-name avl-processor-local --output text /dev/stdout --cli-read-timeout 0

run-avl-aggregate-siri-vm:
	IS_LOCAL=true BUCKET_NAME=${AVL_SIRI_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/avl-aggregate-siri-vm'; handler()"

run-local-avl-retriever:
	IS_LOCAL=true TARGET_BUCKET_NAME=${AVL_SIRI_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/avl-retriever'; handler().catch(e => console.error(e))"

invoke-local-avl-aggregate-siri-vm:
	awslocal lambda invoke --function-name avl-aggregate-siri-vm-local --output text /dev/stdout --cli-read-timeout 0

# NOC

run-local-noc-retriever:
	IS_LOCAL=true NOC_BUCKET_NAME=${NOC_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/noc-retriever'; handler().catch(e => console.error(e))"

run-local-noc-processor:
	FILE="${FILE}" IS_LOCAL=true npx tsx -e "import {handler} from './src/functions/noc-processor'; handler({Records:[{s3:{bucket:{name:'${NOC_BUCKET_NAME}'},object:{key:\"${FILE}\"}}}]}).catch(e => console.error(e))"

# Lambdas
create-lambdas: \
	create-lambda-avl-aggregate-siri-vm \
	create-lambda-avl-processor \
	create-lambda-naptan-retriever \
	create-lambda-naptan-uploader \
	create-lambda-bods-txc-retriever \
	create-lambda-bods-txc-unzipper \
	create-lambda-tnds-txc-retriever \
	create-lambda-tnds-txc-unzipper \
	create-lambda-txc-retriever \
	create-lambda-txc-processor \
	create-lambda-gtfs-downloader \
	create-lambda-noc-retriever \
	create-lambda-noc-processor
	create-lambda-gtfs-rt-generator

delete-lambdas: \
	delete-lambda-avl-aggregate-siri-vm \
	delete-lambda-avl-processor \
	delete-lambda-naptan-retriever \
	delete-lambda-naptan-uploader \
	delete-lambda-bods-txc-retriever \
	delete-lambda-bods-txc-unzipper \
	delete-lambda-tnds-txc-retriever \
	delete-lambda-tnds-txc-unzipper \
	delete-lambda-txc-retriever \
	delete-lambda-txc-processor \
	delete-lambda-gtfs-downloader \
	delete-lambda-noc-retriever \
	delete-lambda-noc-processor
	delete-lambda-gtfs-rt-generator

remake-lambdas: delete-lambdas create-lambdas

remake-lambda-%:
	@$(MAKE) delete-lambda-$*
	@$(MAKE) create-lambda-$*

delete-lambda-%:
	awslocal lambda delete-function --function-name $*-local || true

create-lambda-avl-aggregate-siri-vm:
	$(call create_lambda,avl-aggregate-siri-vm-local,avl-aggregate-siri-vm,IS_LOCAL=true;BUCKET_NAME=${AVL_SIRI_BUCKET_NAME})

create-lambda-avl-processor:
	$(call create_lambda,avl-processor-local,avl-processor,IS_LOCAL=true;AVL_UNPROCESSED_SIRI_BUCKET_NAME=${AVL_UNPROCESSED_SIRI_BUCKET_NAME})

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

create-lambda-gtfs-downloader:
	$(call create_lambda,gtfs-downloader-local,gtfs-downloader,IS_LOCAL=true;BUCKET_NAME=${GTFS_ZIPPED_BUCKET_NAME})

create-lambda-gtfs-rt-generator:
	$(call create_lambda,gtfs-rt-generator-local,gtfs-rt-generator,IS_LOCAL=true;BUCKET_NAME=${GTFS_RT_BUCKET_NAME})

create-lambda-noc-retriever:
	$(call create_lambda,noc-retriever-local,noc-retriever,IS_LOCAL=true;NOC_BUCKET_NAME=${NOC_BUCKET_NAME})

create-lambda-noc-processor:
	$(call create_lambda,noc-processor-local,noc-processor,IS_LOCAL=true)
