#!/bin/bash
set -euo pipefail

log() { printf "%s\n" "$@" >&2; }
die() { log "$@" && exit 1; }

hash aws || die "aws is required"

main() {
    local RECORD_TYPE=$1
    local RECORD_NAME=$2
    local RECORD_VALUE=$3
    local response change_id change_status
    log "Creating $RECORD_TYPE record $RECORD_NAME with value $RECORD_VALUE"

    response=$(
        aws --color off --profile AdministratorAccess \
            route53 change-resource-record-sets \
            --hosted-zone-id Z3PODT6L2Y6659 \
            --change-batch "$(
                jq -n \
                --arg RECORD_TYPE "$RECORD_TYPE" \
                --arg RECORD_NAME "$RECORD_NAME" \
                --arg RECORD_VALUE "$RECORD_VALUE" \
                '{
                    "Changes": [
                        {
                            "Action": "UPSERT",
                            "ResourceRecordSet": {
                                "Type": $RECORD_TYPE,
                                "Name": $RECORD_NAME,
                                "TTL": 60,
                                "ResourceRecords": [
                                    {
                                        "Value": $RECORD_VALUE
                                    }
                                ]
                            }
                        }
                    ]
                }'
            )" 2>&1
    )

    change_id=$(echo "$response" | jq -r .ChangeInfo.Id)
    change_status=$(echo "$response" | jq -r .ChangeInfo.Status)
    while [ "$change_status" = "PENDING" ]; do
        log "Change status is $change_status"
        sleep 1
        response=$(aws --profile AdministratorAccess route53 get-change --id "$change_id")
        change_status=$(echo "$response" | jq -r .ChangeInfo.Status)
    done

    log "Change status is $change_status"
    if [ "$change_status" != "INSYNC" ]; then
        exit 1
    fi
}

main "$@"