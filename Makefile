NAPTAN_BUCKET_NAME="integrated-data-naptan-local"

dev: dev-containers-up
setup: dev-containers-up create-buckets migrate-local-db-to-latest

# Docker

dev-containers-up:
	docker compose --project-directory dev up -d
dev-containers-down:
	docker compose --project-directory dev down
dev-containers-kill:
	docker compose --project-directory dev kill

# Localstack

create-buckets:
	awslocal s3api create-bucket --region eu-west-2 --bucket ${NAPTAN_BUCKET_NAME} --create-bucket-configuration LocationConstraint=eu-west-2

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


# Test the data pipeline
	./scripts/put_test_data_firehose.sh -a "environment" -b "source_filename"
