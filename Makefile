NAPTAN_BUCKET_NAME="integrated-data-naptan-stops-local"
NPTG_BUCKET_NAME="integrated-data-nptg-local"
BODS_TXC_ZIPPED_BUCKET_NAME="integrated-data-bods-txc-zipped-local"
BODS_TXC_UNZIPPED_BUCKET_NAME="integrated-data-bods-txc-local"
TNDS_TXC_ZIPPED_BUCKET_NAME="integrated-data-tnds-txc-zipped-local"
TNDS_TXC_UNZIPPED_BUCKET_NAME="integrated-data-tnds-txc-local"
TNDS_FTP_ARN=""
AVL_SIRI_BUCKET_NAME="integrated-data-avl-aggregated-siri-vm-local"
AVL_UNPROCESSED_SIRI_BUCKET_NAME="integrated-data-avl-local"
AVL_SUBSCRIPTION_TABLE_NAME="integrated-data-avl-subscription-table-local"
GTFS_ZIPPED_BUCKET_NAME="integrated-data-gtfs-local"
GTFS_RT_BUCKET_NAME="integrated-data-gtfs-rt-local"
NOC_BUCKET_NAME="integrated-data-noc-local"
TXC_QUEUE_NAME="integrated-data-txc-queue-local"
AURORA_OUTPUT_BUCKET_NAME="integrated-data-aurora-output-local"
BANK_HOLIDAYS_BUCKET_NAME="integrated-data-bank-holidays-local"
BODS_FARES_ZIPPED_BUCKET_NAME="integrated-data-bods-fares-local"
GTFS_RT_DOWNLOADER_INPUT="{}"
TFL_API_ARN=""

# Dev

setup: dev-containers-up install-deps build-functions create-local-env migrate-local-db-to-latest

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

# Terraform local

tf-init-local:
	tflocal -chdir=terraform/local init

tf-plan-local:
	tflocal -chdir=terraform/local plan

tf-apply-local:
	tflocal -chdir=terraform/local apply

create-local-env:
	tflocal -chdir=terraform/local init && \
	tflocal -chdir=terraform/local apply --auto-approve

# Build

install-deps:
	(cd src && pnpm i) && \
	cd cli-helpers && pnpm i

build-functions:
	cd src && pnpm build-all

lint-functions:
	cd src && pnpm lint

test-functions:
	cd src && pnpm test:ci

docker-build-%:
	docker build src --build-arg servicePath=$* -t $*

# CLI helpers

commands:
	cd cli-helpers && pnpm command;

command-%:
	cd cli-helpers && pnpm command $* ${FLAGS};

# Secrets

edit-secrets-%:
	cd terraform/$* && sops secrets.enc.json

# Database

migrate-local-db-to-latest:
	STAGE=local npx tsx -e "import {handler} from './src/functions/db-migrator'; handler().catch(e => console.error(e))"

rollback-last-local-db-migration:
	STAGE=local ROLLBACK=true npx tsx -e "import {handler} from './src/functions/db-migrator'; handler().catch(e => console.error(e))"

bastion-tunnel:
	./scripts/bastion-tunnel.sh

get-db-credentials:
	./scripts/get-db-credentials.sh

# Dates

get-bank-holiday-dates:
	curl https://www.gov.uk/bank-holidays.json --output src/shared/uk-bank-holidays.json

# Naptan

run-local-naptan-retriever:
	STAGE=local BUCKET_NAME=${NAPTAN_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/naptan-retriever'; handler().catch(e => console.error(e))"

run-local-naptan-uploader:
	STAGE=local npx tsx -e "import {handler} from './src/functions/naptan-uploader'; handler({Records:[{s3:{bucket:{name:'${NAPTAN_BUCKET_NAME}'},object:{key:'Stops.csv'}}}]}).catch(e => console.error(e))"

# NPTG

run-local-nptg-retriever:
	STAGE=local BUCKET_NAME=${NPTG_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/nptg-retriever'; handler().catch(e => console.error(e))"

run-local-nptg-uploader:
	STAGE=local npx tsx -e "import {handler} from './src/functions/nptg-uploader'; handler({Records:[{s3:{bucket:{name:'${NPTG_BUCKET_NAME}'},object:{key:'NPTG.xml'}}}]}).catch(e => console.error(e))"

# TXC

run-local-bods-txc-retriever:
	STAGE=local TXC_ZIPPED_BUCKET_NAME=${BODS_TXC_ZIPPED_BUCKET_NAME} TXC_BUCKET_NAME=${BODS_TXC_UNZIPPED_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/bods-txc-retriever'; handler().catch(e => console.error(e))"

run-local-tnds-txc-retriever:
	STAGE=local TXC_ZIPPED_BUCKET_NAME=${TNDS_TXC_ZIPPED_BUCKET_NAME} TNDS_FTP_ARN=${TNDS_FTP_ARN} npx tsx -e "import {handler} from './src/functions/tnds-txc-retriever'; handler().catch(e => console.error(e))"

run-local-db-cleardown:
	STAGE=local npx tsx -e "import {handler} from './src/functions/db-cleardown'; handler().catch(e => console.error(e))"

run-local-db-cleardown-gtfs-only:
	STAGE=local ONLY_GTFS=true npx tsx -e "import {handler} from './src/functions/db-cleardown'; handler().catch(e => console.error(e))"

run-local-bods-txc-unzipper:
	STAGE=local FILE="${FILE}" UNZIPPED_BUCKET_NAME=${BODS_TXC_UNZIPPED_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/unzipper'; handler({Records:[{s3:{bucket:{name:'${BODS_TXC_ZIPPED_BUCKET_NAME}'},object:{key:\"${FILE}\"}}}]}).catch(e => console.error(e))"

run-local-tnds-txc-unzipper:
	STAGE=local FILE="${FILE}" UNZIPPED_BUCKET_NAME=${TNDS_TXC_UNZIPPED_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/unzipper'; handler({Records:[{s3:{bucket:{name:'${TNDS_TXC_ZIPPED_BUCKET_NAME}'},object:{key:\"${FILE}\"}}}]}).catch(e => console.error(e))"

run-local-bods-txc-processor:
	STAGE=local FILE="${FILE}" BANK_HOLIDAYS_BUCKET_NAME=${BANK_HOLIDAYS_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/txc-processor'; handler({Records:[{s3:{bucket:{name:'${BODS_TXC_UNZIPPED_BUCKET_NAME}'},object:{key:\"${FILE}\"}}}]}).catch(e => console.error(e))"

run-local-tnds-txc-processor:
	STAGE=local FILE="${FILE}" BANK_HOLIDAYS_BUCKET_NAME=${BANK_HOLIDAYS_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/txc-processor'; handler({Records:[{s3:{bucket:{name:'${TNDS_TXC_UNZIPPED_BUCKET_NAME}'},object:{key:\"${FILE}\"}}}]}).catch(e => console.error(e))"

# GTFS

run-local-gtfs-timetables-generator:
	STAGE=local OUTPUT_BUCKET=${AURORA_OUTPUT_BUCKET_NAME} GTFS_BUCKET=${GTFS_ZIPPED_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/gtfs-timetables-generator'; handler().catch(e => console.error(e))"

run-local-gtfs-downloader:
	STAGE=local BUCKET_NAME=${GTFS_ZIPPED_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/gtfs-downloader'; handler().then((response) => console.log(response)).catch(e => console.error(e))"

run-local-gtfs-rt-generator:
	STAGE=local BUCKET_NAME=${GTFS_RT_BUCKET_NAME} SAVE_JSON=true npx tsx -e "import {handler} from './src/functions/gtfs-rt-generator'; handler().catch(e => console.error(e))"

# example usage with query params: make run-local-gtfs-rt-downloader GTFS_RT_DOWNLOADER_INPUT="{ queryStringParameters: { routeId: "1,2", startTimeAfter: 1712288820 } }"
run-local-gtfs-rt-downloader:
	STAGE=local BUCKET_NAME=${GTFS_RT_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/gtfs-rt-downloader'; handler(${GTFS_RT_DOWNLOADER_INPUT}).then(r => console.log(r)).catch(e => console.error(e))"

# AVL

run-local-avl-subscriber:
	STAGE=local TABLE_NAME=${AVL_SUBSCRIPTION_TABLE_NAME} npx tsx -e "import {handler} from './src/functions/avl-subscriber'; handler({body: '\{\"dataProducerEndpoint\":\"http://ee7swjlq51jq0ri51nl3hlexwdleoc8n.lambda-url.eu-west-2.localhost.localstack.cloud:4566\",\"description\":\"description\",\"shortDescription\":\"shortDescription\",\"username\":\"test-user\",\"password\":\"dummy-password\"\}' }).catch(e => console.error(e))"

run-local-avl-data-endpoint:
	STAGE=local SUBSCRIPTION_ID=${SUBSCRIPTION_ID} FILE="${FILE}" BUCKET_NAME=${AVL_UNPROCESSED_SIRI_BUCKET_NAME} TABLE_NAME=${AVL_SUBSCRIPTION_TABLE_NAME} npx tsx -e "import {handler} from './src/functions/avl-data-endpoint'; handler({body: '$(shell cat ${FILE} | sed -e 's/\"/\\"/g')', pathParameters: { subscription_id:'${SUBSCRIPTION_ID}'}}).catch(e => console.error(e))"

run-local-avl-processor:
	STAGE=local FILE="${FILE}" npx tsx -e "import {handler} from './src/functions/avl-processor'; handler({Records:[{body:'{\"Records\":[{\"s3\":{\"bucket\":{\"name\":\"${AVL_UNPROCESSED_SIRI_BUCKET_NAME}\"},\"object\":{\"key\":\"${FILE}\"}}}]}'}]}).catch(e => console.error(e))"

run-local-avl-aggregate-siri-vm:
	STAGE=local BUCKET_NAME=${AVL_SIRI_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/avl-aggregate-siri-vm'; handler().catch(e => console.error(e))"

run-local-avl-retriever:
	STAGE=local TARGET_BUCKET_NAME=${AVL_UNPROCESSED_SIRI_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/avl-retriever'; handler().catch(e => console.error(e))"

run-local-avl-mock-data-producer-subscribe:
	STAGE=local npx tsx -e "import {handler} from './src/functions/avl-mock-data-producer-subscribe'; handler().catch(e => console.error(e))"

run-local-avl-mock-data-producer-send-data:
	STAGE=local DATA_ENDPOINT="https://www.local.com" npx tsx -e "import {handler} from './src/functions/avl-mock-data-producer-send-data'; handler().catch(e => console.error(e))"

run-local-avl-unsubscriber:
	STAGE=local SUBSCRIPTION_ID="${SUBSCRIPTION_ID}" STAGE="local" TABLE_NAME=${AVL_SUBSCRIPTION_TABLE_NAME} npx tsx -e "import {handler} from './src/functions/avl-unsubscriber'; handler({pathParameters: {'subscription_id':'${SUBSCRIPTION_ID}'} }).catch(e => console.error(e))"

run-local-avl-tfl-line-id-retriever:
	STAGE=local npx tsx -e "import {handler} from './src/functions/avl-tfl-line-id-retriever'; handler().catch(e => console.error(e))"

run-local-avl-tfl-location-retriever:
	STAGE=local TFL_API_ARN=${TFL_API_ARN} npx tsx -e "import {handler} from './src/functions/avl-tfl-location-retriever'; handler().catch(e => console.error(e))"

run-local-avl-siri-vm-downloader:
	STAGE=local BUCKET_NAME=${AVL_SIRI_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/avl-siri-vm-downloader'; handler().catch(e => console.error(e))"

# NOC

run-local-noc-retriever:
	STAGE=local NOC_BUCKET_NAME=${NOC_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/noc-retriever'; handler().catch(e => console.error(e))"

run-local-noc-processor:
	STAGE=local npx tsx -e "import {handler} from './src/functions/noc-processor'; handler({Records:[{s3:{bucket:{name:'${NOC_BUCKET_NAME}'},object:{key:'noc.xml'}}}]}).catch(e => console.error(e))"

# Table renamer

run-local-table-renamer:
	STAGE=local npx tsx -e "import {handler} from './src/functions/table-renamer'; handler().catch(e => console.error(e))"

# Bank Holidays retriever

run-local-bank-holidays-retriever:
	STAGE=local BANK_HOLIDAYS_BUCKET_NAME=${BANK_HOLIDAYS_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/bank-holidays-retriever'; handler().catch(e => console.error(e))"

# Fares retriever

run-local-bods-fares-retriever:
	STAGE=local FARES_ZIPPED_BUCKET_NAME=${BODS_FARES_ZIPPED_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/bods-fares-retriever'; handler().catch(e => console.error(e))"
