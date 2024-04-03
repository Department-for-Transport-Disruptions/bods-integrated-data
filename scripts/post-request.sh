#!/bin/bash

set -e
set -u
set -o pipefail

helpFunction()
{
   echo ""
   echo "Usage: $0 -a APIGatewayEndpoint"
   echo -e "\t-a Pass the environment name"
   exit 1 # Exit script after printing help
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

count=10
uuid_var=$(uuidgen | tr 'A-Z' 'a-z')
for i in $(seq $count)
do
  echo "starting ssh database tunnel"
  sed  "s/{CURRENT_TIMESTAMP}/$(date +'%Y-%m-%d %H:%M:%S')/g" template.xml > temp.xml
  sed  "s/{CURRENT_DATE}/$(date +'%Y-%m-%d')/g" temp.xml > temp1.xml
  sed  "s/{RANDOM_UUID}/$(uuid_var)/g" temp1.xml > temp2.xml
  curl -X POST -H 'Content-Type: application/xml' -d @temp2.xml $APIGatewayEndpoint
done

