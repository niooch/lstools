#!/bin/bash

#check if run as root
if [ "$(id -u)" -ne 0 ]; then
  echo "odpal z sudo" 1>&2
  exit 1
fi

#chekc if there is a docker container named osrm-server
#sprawdz co zrocil grep
docker ps -a | grep osrm-server > /dev/null
if [ $? -eq 0 ]; then
  echo "Zatrzymuje i usuwam kontener osrm-server"
  docker start osrm-server
  exit
else
  echo "Nie ma osrm-server, odpalam"
fi
docker run -d --name osrm-server \
  -p 5000:5000 \
  -v /home/kogut/projekt/mapydysk/routing:/data \
  osrm/osrm-backend \
  osrm-routed \
    --algorithm mld \
    --max-table-size 5000000 \
    /data/europe-latest.osrm

