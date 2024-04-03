#!/bin/bash

set -e
set -u
set -o pipefail

helpFunction()
{
   echo ""
   echo "Usage: $0 -a APIGatewayEndpoint"
   echo -e "\t-a Pass the environment name"
   exit 1 # Exit script after printing helpgit 
}

while getopts "a:" opt
do
   case "$opt" in
      a ) APIGatewayEndpoint="$OPTARG" ;;
      ? ) helpFunction ;; # Print helpFunction in case parameter is non-existent
   esac
done

if [ -z "$APIGatewayEndpoint" ]
then
   echo "APIGatewayEndpoint parameter is missing";
   helpFunction
fi

count=100
date_file=$(date +"%Y-%m-%d")
for i in $(seq $count)
do
  echo "Starting Data Endpoint Post request"
  uuid_var=$(uuidgen | tr 'A-Z' 'a-z')
  echo "Cureent Loop number is : $i and Item identifier is : $uuid_var" >> logfile_$date_file.txt
  sed -e  "s/{CURRENT_TIMESTAMP}/$(date +'%Y-%m-%d %H:%M:%S')/g" -e "s/{CURRENT_DATE}/$(date +'%Y-%m-%d')/g" -e "s/{RANDOM_UUID}/$uuid_var/g" -e "s/{CURRENT_TIMESTAMP_PLUS_6_HOURS}/$(date -v+6H +'%Y-%m-%d %H:%M:%S')/g"  template.xml > temp.xml
  curl -X POST -H 'Content-Type: application/xml' -d @temp.xml $APIGatewayEndpoint
  sleep 5
done
rm temp.xml

