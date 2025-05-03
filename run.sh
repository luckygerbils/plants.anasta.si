#!/bin/bash
set -euo pipefail
if [ -n "${DEBUG:-}" ]; then set -x; fi
IFS=$'\n'
BASE_DIR=$(realpath "$(dirname "$0")")

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
    while getopts 'p:te:' opt; do
        case $opt in
            p) publish_opts+=($OPTARG) ;;
            t) use_tty=false ;;
            e) env_variables+=($OPTARG) ;;
        esac
    done
    shift "$((OPTIND-1))"

    local tty_opts
    if $use_tty; then tty_opts="--tty"; fi

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

build() {
    with:tools npm run build
}

ci:release() {
    npm ci
    npm run release
}

"${@:-help}"