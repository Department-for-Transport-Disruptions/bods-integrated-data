aws scheduler list-schedules --region eu-west-2 --query 'Schedules [?contains(Name, `consumer-sub`)].[Name,GroupName]' --output text | xargs -P 8 -n2 sh -c 'aws scheduler delete-schedule --region eu-west-2 --name "$1" --group-name "$2" && echo "deleted $1"' _

aws sqs list-queues --region eu-west-2 --page-size 1000 --query 'QueueUrls[?contains(@, `consumer-sub`)]' --output text | tr '\t' '\n' | xargs -P 8 -n1 -I{} sh -c 'aws sqs delete-queue --region eu-west-2 --queue-url "$1" && echo "deleted $1"' _ {}

aws cloudwatch describe-alarms --region eu-west-2 --query 'MetricAlarms[?contains(AlarmName, `consumer-queue-alarm`)].AlarmName' --output text | tr '\t' '\n' | xargs -n100 aws cloudwatch delete-alarms --region eu-west-2 --alarm-names