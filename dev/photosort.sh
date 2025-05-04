#!/bin/bash
#
# Quick script to organize locally downloaded photos for upload
#

PLANTS_JSON=~/projects/plants.anasta.si/plants.json
PHOTOS_DIR=~/projects/plants.anasta.si/photos

main() {
  local file name matches add
  for file in "$@"; do
    while true; do
      read -p "$file " name
      if [ "$name" = skip ]; then
        break
      fi
      if [ "$name" = exit ]; then
        exit
      fi
      photo_id=$(md5sum "$file" | grep -o '^........')
      add=false
      jq -r --arg name "$name" 'map(select(.name | test($name; "i"))) | map("\(.name) \(.id)") | .[]' "$PLANTS_JSON"
      read -p " # / y / add / retry? " plant_id

      if [ "$plant_id" = retry ]; then
        continue
      elif [ "$plant_id" = add ]; then
        plant_id="$(uuidgen | grep -o '^........')"
        add=true
      elif [ "$plant_id" = y ]; then
        plant_id=$(jq -r --arg name "$name" 'map(select(.name | test($name; "i"))) | map(.id) | .[]' "$PLANTS_JSON")
      fi
      
      mkdir -p "$PHOTOS_DIR/$plant_id/$photo_id"
      mv -v "$file" "$PHOTOS_DIR/$plant_id/$photo_id/original.jpg"

      new_file=$(mktemp)
      if $add; then
        jq --arg name "$name" \
          --arg plant_id "$plant_id" \
          --arg photo_id "$photo_id" \
          '. + [{id:$plant_id,name:$name,photos:[{id:$photo_id}]}]' "$PLANTS_JSON" >"$new_file"
      else
        jq --arg plant_id "$plant_id" \
          --arg photo_id "$photo_id" \
          '(.[] | select(.id == $plant_id)).photos |= ((. // []) + [{id:$photo_id}])' "$PLANTS_JSON" >"$new_file"
      fi
      mv "$new_file" "$PLANTS_JSON"
      break
      
    done
  done
}

main "$@"