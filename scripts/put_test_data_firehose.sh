#!/bin/bash
# put-test-data-on-firehose
# script to perform direct PUTs of SIRI-VM data onto the firehose stream, this will allow us to test the data pipeline.
helpFunction()
{
   echo ""
   echo "Usage: $0 -a environment -b sourcefile"
   echo -e "\t-a Pass the environment name"
   exit 1 # Exit script after printing help
}

while getopts "a:b:" opt
do
   case "$opt" in
      a ) environment="$OPTARG" ;;
      b ) sourcefile="$OPTARG" ;;
      ? ) helpFunction ;; # Print helpFunction in case parameter is non-existent
   esac
done

if [ -z "$environment" ]|| [ -z "$sourcefile" ]
then
   echo "Environment or Sourcefile parameter is missing";
   helpFunction
fi

base64 -i ${sourcefile} -o encodedfile.txt
ENCODED_VALUE=$(cat encodedfile.txt)
aws firehose put-record \
    --delivery-stream-name cavl-kinesis-firehose-stream-${environment} \
    --record '{"Data":"'"${ENCODED_VALUE}"'"}'

exit 0