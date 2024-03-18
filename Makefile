NAPTAN_BUCKET_NAME="integrated-data-naptan-local"
BODS_TXC_ZIPPED_BUCKET_NAME="integrated-data-bods-txc-zipped-local"
BODS_TXC_UNZIPPED_BUCKET_NAME="integrated-data-bods-txc-local"
TNDS_TXC_ZIPPED_BUCKET_NAME="integrated-data-tnds-txc-zipped-local"
TNDS_TXC_UNZIPPED_BUCKET_NAME="integrated-data-tnds-txc-local"
TNDS_TXC_FTP_CREDS_ARN=""
AVL_SIRI_BUCKET_NAME="avl-siri-vm-local"
AVL_UNPROCESSED_SIRI_BUCKET_NAME="integrated-data-siri-vm-local"
AVL_SUBSCRIPTION_TABLE_NAME="integrated-data-avl-subscriptions-local"

dev: dev-containers-up
setup: dev-containers-up create-buckets install-deps migrate-local-db-to-latest create-dynamodb-table

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

create-dynamodb-table:
	awslocal dynamodb create-table \
    --table-name integrated-data-avl-subscriptions-local \
    --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
    --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
    --billing-mode PAY_PER_REQUEST \
    --region eu-west-2

# Database

migrate-local-db-to-latest:
	IS_LOCAL=true npx tsx -e "import {handler} from './src/functions/db-migrator'; handler().catch(e => console.error(e))"

rollback-last-local-db-migration:
	IS_LOCAL=true ROLLBACK=true npx tsx -e "import {handler} from './src/functions/db-migrator'; handler().catch(e => console.error(e))"

bastion-tunnel:
	./scripts/bastion-tunnel.sh

# Naptan

run-local-naptan-retriever:
	IS_LOCAL=true BUCKET_NAME=${NAPTAN_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/naptan-retriever'; handler().catch(e => console.error(e))"

run-local-naptan-uploader:
	IS_LOCAL=true npx tsx -e "import {handler} from './src/functions/naptan-uploader'; handler({Records:[{s3:{bucket:{name:'${NAPTAN_BUCKET_NAME}'},object:{key:'Stops.csv'}}}]}).catch(e => console.error(e))"

run-full-local-naptan-pipeline: run-local-naptan-retriever run-local-naptan-uploader

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

# AVL

run-local-avl-subscriber:
	IS_LOCAL=true TABLE_NAME=${AVL_SUBSCRIPTION_TABLE_NAME} npx tsx -e "import {handler} from './src/functions/avl-subscriber'; handler({body: '\{\"dataProducerEndpoint\":\"https://mock-data-producer.com\",\"description\":\"description\",\"shortDescription\":\"shortDescription\",\"username\":\"test-user\",\"password\":\"dummy-password\"\}' }).catch(e => console.error(e))"

run-local-avl-data-endpoint:
	IS_LOCAL=true BUCKET_NAME=${AVL_UNPROCESSED_SIRI_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/avl-data-endpoint'; handler({body: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Siri/>', pathParameters: { subscriptionId:'1234'}}).catch(e => console.error(e))"

run-avl-aggregate-siri-vm:
	IS_LOCAL=true BUCKET_NAME=${AVL_SIRI_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/avl-aggregate-siri-vm'; handler()"
