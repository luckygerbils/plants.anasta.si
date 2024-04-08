#!/bin/bash
set -euo pipefail
IFS=$'\n'
#
# Build a set of redirects as HTML meta redirect pages under dist/{id}/index.html
# (so they can be accessed as /{id})
#
mkdir -p dist
awk -F, <redirects.csv 'NF != 0 {
    system("mkdir -p dist/"$1)
    printf "<!DOCTYPE html>\n" >"dist/"$1"/index.html"
    printf "<html><head><title>%s</title><meta http-equiv=\"refresh\" content=\"0;URL='\''%s'\''\" /></head></html>\n", $2, $3 >>"dist/"$1"/index.html"
    printf "Built: %s/index.html: %s -> %s\n", $1, $2, $3
}'
