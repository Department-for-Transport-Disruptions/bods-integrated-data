NAPTAN_BUCKET_NAME="integrated-data-naptan-local"
AVL_SIRI_BUCKET_NAME="avl-siri-vm-local"

dev: dev-containers-up
setup: dev-containers-up create-buckets migrate-local-db-to-latest

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
	awslocal s3api create-bucket --region eu-west-2 --bucket ${AVL_SIRI_BUCKET_NAME} --create-bucket-configuration LocationConstraint=eu-west-2 || true

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

# AVL

run-avl-aggregate-siri:
	IS_LOCAL=true BUCKET_NAME=${AVL_SIRI_BUCKET_NAME} npx tsx -e "import {handler} from './src/functions/aggregate-siri'; handler()"