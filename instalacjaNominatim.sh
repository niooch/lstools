#!/bin/bash
sudo docker run -it --name nominatim \
        -e PBF_PATH=/nominatim/data/europe-latest.osm.pbf \
        -e PGPASSWORD=D00psko15 \
        --shm-size=4g \
        -e REPLICATION_URL="https://download.geofabrik.de/europe-updates/" \
        -e UPDATE_MODE=catch-up \
        -e NOMINATIM_PASSWORD="D00psko15$" \
        -v /home/kogut/lstools/mapydane/data:/nominatim/data \
        -v /home/kogut/lstools/mapydane/flatnode:/nominatim/flatnode \
        -v /home/kogut/lstools/mapydane/pgdata:/var/lib/postgresql/16/main \
        -p 8080:8080 \
        mediagis/nominatim:5.1
