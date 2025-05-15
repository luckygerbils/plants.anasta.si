#!/bin/bash
set -euo pipefail
if [ -n "${DEBUG:-}" ]; then set -x; fi
BASE_DIR=$(realpath "$(dirname "$0")")
DEV_HOSTNAME=dev.plants.anasta.si
CERT_DIR=~/credentials/certificates/$DEV_HOSTNAME/config/live/$DEV_HOSTNAME
DEV_HTTPS_KEY=$CERT_DIR/privkey.pem
DEV_HTTPS_CERT=$CERT_DIR/fullchain.pem

log() { printf "%s\n" "$@" >&2; }
die() { log "$@" && exit 1; }

help() {
    #/ print descriptions of all tasks
    log "$0 <task> [[args]]"
    log "Tasks:"
    for function in $(compgen -A function | grep -Pv '^private:|log|die'); do
        echo "$function" | sed 's/^/    /'
        awk --assign fstart="^$function()" '
            $0 ~ fstart { p=1 }
            $0 ~ /}/ { p=0 }
            $0 ~ /#\// && p { print }
        ' "$0" | sed 's,#/,    ,'
    done
}

# Utility

with:tools() {
    #/ run the given arguments in a container with all the dev tools available
    if "${HAVE_TOOLS:-false}"; then "$@"; fi

    hash docker || die "docker is required"

    local OPTIND=1
    local publish_opts=() env_variables=()
    local use_tty=true
    while getopts 'p:v:te:' opt; do
        case $opt in
            p) publish_opts+=($OPTARG) ;;
            v) volume_opts+=($OPTARG) ;;
            t) use_tty=false ;;
            e) env_variables+=($OPTARG) ;;
        esac
    done
    shift "$((OPTIND-1))"

    local tty_opts
    if [ -t 1 ]; then
        tty_opts="--tty"
    fi

    local file_time image_time
    file_time=$(stat -c %Y "dev/Dockerfile")
    image_time=$(date -d "$(docker inspect --format '{{json .Metadata.LastTagTime}}' plants.anasta.si/tools | jq -r .)" +%s)
    if [ $file_time -gt $image_time ]; then
        docker build -t plants.anasta.si/tools \
            --build-arg uid=$(id -u) \
            --build-arg gid=$(id -g) \
            dev
    fi
    docker run \
        --volume "$BASE_DIR:/usr/src/app" \
        --volume ~/.aws:/home/user/.aws \
        $(printf "%s\n" "${publish_opts[@]}" | xargs -I '{}' echo --publish '{}' | paste -sd' ') \
        $(printf "%s\n" "${volume_opts[@]}" | xargs -I '{}' echo --volume '{}' | paste -sd' ') \
        $(printf "%s\n" "${env_variables[@]}" | xargs -I '{}' echo --env '{}' | paste -sd' ') \
        --add-host=host.docker.internal:host-gateway \
        --interactive ${tty_opts:-} \
        plants.anasta.si/tools ./run.sh "$@"
}

update() {
    #/ update all NPM dependencies
    with:tools private:update
}
private:update() {
    eval npm install --save-dev $(npm pkg get devDependencies | jq -r 'keys | map("\(.)@latest") | .[]' | paste -sd' ')
}

ci() {
    #/ install all NPM dependencies for CI
    npm ci
    in:cdk npm ci
}

build() {
    #/ build the project
    npx tsx dev/build.tsx
    npx tsc -p lambda-tsconfig.json
    jq 'del(.devDependencies)' package.json >lambda/dist/package.json
    cp package-lock.json lambda/dist/
    ( cd lambda/dist && npm ci --omit dev)
}

release() {
    #/ test and build the project
    npx eslint src dev/build.tsx
    build
}

synth() {
    #/ build the CDK project
    in:cdk npx cdk synth
}

clean() {
    rm -rf ./dist
}

watch() {
    with:tools npx tsx watch --include './src/**/*' --include plants.json dev/build.tsx
}

dev() {
    with:tools \
        -p 8443:8443 \
        -v "$DEV_HTTPS_KEY:$DEV_HTTPS_KEY" \
        -v "$DEV_HTTPS_CERT:$DEV_HTTPS_CERT" \
        npx tsx watch --include './src/**/*' dev/serve.tsx -- --port=8443 --key="$DEV_HTTPS_KEY" --cert="$DEV_HTTPS_CERT"
}

register-dns() {
    #/ register DEV_HOSTNAME as an A record pointing to this machine's local network IP
    #/ an actual hostname is necessary to test over HTTPS and this can't just be an /etc/hosts entry because I want to be able to test from my phone as well

    LOCAL_IP=$(ip -json -family inet addr | jq -r 'map(select(.ifname != "lo" and (.ifname | test("^docker") | not))) | .[0].addr_info[0].local')
    if [ "$(dig +short "$DEV_HOSTNAME")" != "$LOCAL_IP" ]; then
        with:tools dev/register-dns.sh A "${DEV_HOSTNAME}" "$LOCAL_IP"
    else
        log "$DEV_HOSTNAME already points to local IP $LOCAL_IP"
    fi
}

copy-photos() {
    local stage=${1?-Stage is required} 
    local data_bucket_name
    data_bucket_name=$(
        aws --region us-west-2 --profile AdministratorAccess \
            cloudformation describe-stack-resources \
            --stack-name $stage-Plants-PrimaryStack \
            --query "StackResources[?starts_with(LogicalResourceId, 'DataBucket')].PhysicalResourceId | [0]" \
            --output text)
    aws --profile AdministratorAccess --region us-west-2 \
        s3 sync photos "s3://$data_bucket_name/data/photos/"
}

create-user() {
    local stage=${1?-Stage is required} username=${2?-Username is required}
    local user_pool_id temporary_password
    user_pool_id=$(
        aws --region us-west-2 --profile AdministratorAccess \
            cloudformation describe-stack-resources \
            --stack-name "$stage-Plants-PrimaryStack" \
            --query "StackResources[?ResourceType=='AWS::Cognito::UserPool' && starts_with(LogicalResourceId, 'EditorUserPool')].PhysicalResourceId | [0]" \
            --output text)
    log "User Pool Id: $user_pool_id"
    set +o pipefail
    password=$(cat /dev/urandom | tr -dc '[:graph:]' | head -c 30)
    set -o pipefail
    log "Password: $password"
    aws --region us-west-2 --profile AdministratorAccess \
        cognito-idp admin-create-user \
        --user-pool-id "$user_pool_id" \
        --username "$username" \
        --message-action SUPPRESS \
        --temporary-password "$password"
    aws --region us-west-2 --profile AdministratorAccess \
        cognito-idp admin-set-user-password \
        --user-pool-id "$user_pool_id" \
        --username "$username" \
        --password "$password" \
        --permanent
}

tail() {
    local stage=${1?-Stage is required}
    local lambda_name
    lambda_name=$(
        aws --region us-west-2 --profile AdministratorAccess \
            cloudformation describe-stack-resources \
            --stack-name "$stage-Plants-PrimaryStack" \
            --query "StackResources[?ResourceType=='AWS::Lambda::Function' && starts_with(LogicalResourceId, 'ApiFunction')].PhysicalResourceId | [0]" \
            --output text)
    aws --region us-west-2 --profile AdministratorAccess \
        logs tail "/aws/lambda/$lambda_name" --format short --follow
}

in:cdk() { ( cd cdk && ../run.sh "$@" ); }
in:lambda() { ( cd lambda && ../run.sh "$@" ); }

"${@:-help}"