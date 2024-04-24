terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_iam_role" "integrated_data_timetables_sfn_role" {
  name = "integrated-data-timetables-sfn-role-${var.environment}"

  assume_role_policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Principal" : {
          "Service" : "states.amazonaws.com"
        },
        "Action" : "sts:AssumeRole",
        "Condition" : {
          "StringEquals" : {
            "aws:SourceAccount" : "${data.aws_caller_identity.current.account_id}"
          },
          "ArnLike" : {
            "aws:SourceArn" : "arn:aws:states:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:stateMachine:*"
          }
        }
      }
    ]
  })
}

resource "aws_sfn_state_machine" "integrated_data_timetables_sfn" {
  name       = "integrated-data-timetables-sfn-${var.environment}"
  role_arn   = aws_iam_role.integrated_data_timetables_sfn_role.arn
  definition = <<EOF
  {
  "Comment": "Import reference data and generate GTFS timetables",
  "StartAt": "DB Cleardown",
  "States": {
    "DB Cleardown": {
      "Type": "Task",
      "Resource": "arn:aws:states:::lambda:invoke",
      "Parameters": {
        "FunctionName": "${var.db_cleardown_function_arn}:$LATEST"
      },
      "Retry": [
        {
          "ErrorEquals": [
            "Lambda.ServiceException",
            "Lambda.AWSLambdaException",
            "Lambda.SdkClientException",
            "Lambda.TooManyRequestsException"
          ],
          "IntervalSeconds": 1,
          "MaxAttempts": 3,
          "BackoffRate": 2
        }
      ],
      "Next": "Retrieve and Process Reference Data"
    },
    "Retrieve and Process Reference Data": {
      "Type": "Parallel",
      "Branches": [
        {
          "StartAt": "Retrieve NOC Data",
          "States": {
            "Retrieve NOC Data": {
              "Type": "Task",
              "Resource": "arn:aws:states:::lambda:invoke",
              "Parameters": {
                "FunctionName": "${var.noc_retriever_function_arn}:$LATEST"
              },
              "Retry": [
                {
                  "ErrorEquals": [
                    "Lambda.ServiceException",
                    "Lambda.AWSLambdaException",
                    "Lambda.SdkClientException",
                    "Lambda.TooManyRequestsException"
                  ],
                  "IntervalSeconds": 1,
                  "MaxAttempts": 3,
                  "BackoffRate": 2
                }
              ],
              "Next": "Process NOC Data"
            },
            "Process NOC Data": {
              "Type": "Task",
              "Resource": "arn:aws:states:::lambda:invoke",
              "OutputPath": "$.Payload",
              "Parameters": {
                "FunctionName": "${var.noc_processor_function_arn}:$LATEST",
                "Payload": {
                  "Records": [
                    {
                      "s3": {
                        "object": {
                          "key": "noc.xml"
                        },
                        "bucket": {
                          "name": "${var.noc_bucket_name}"
                        }
                      }
                    }
                  ]
                }
              },
              "Retry": [
                {
                  "ErrorEquals": [
                    "Lambda.ServiceException",
                    "Lambda.AWSLambdaException",
                    "Lambda.SdkClientException",
                    "Lambda.TooManyRequestsException"
                  ],
                  "IntervalSeconds": 1,
                  "MaxAttempts": 3,
                  "BackoffRate": 2
                }
              ],
              "End": true
            }
          }
        },
        {
          "StartAt": "Retrieve NaPTAN Data",
          "States": {
            "Retrieve NaPTAN Data": {
              "Type": "Task",
              "Resource": "arn:aws:states:::lambda:invoke",
              "Parameters": {
                "FunctionName": "${var.naptan_retriever_function_arn}:$LATEST"
              },
              "Retry": [
                {
                  "ErrorEquals": [
                    "Lambda.ServiceException",
                    "Lambda.AWSLambdaException",
                    "Lambda.SdkClientException",
                    "Lambda.TooManyRequestsException"
                  ],
                  "IntervalSeconds": 1,
                  "MaxAttempts": 3,
                  "BackoffRate": 2
                }
              ],
              "Next": "Process NaPTAN Data"
            },
            "Process NaPTAN Data": {
              "Type": "Task",
              "Resource": "arn:aws:states:::lambda:invoke",
              "Parameters": {
                "FunctionName": "${var.naptan_uploader_function_arn}:$LATEST",
                "Payload": {
                  "Records": [
                    {
                      "s3": {
                        "object": {
                          "key": "Stops.csv"
                        },
                        "bucket": {
                          "name": "${var.naptan_bucket_name}"
                        }
                      }
                    }
                  ]
                }
              },
              "Retry": [
                {
                  "ErrorEquals": [
                    "Lambda.ServiceException",
                    "Lambda.AWSLambdaException",
                    "Lambda.SdkClientException",
                    "Lambda.TooManyRequestsException"
                  ],
                  "IntervalSeconds": 1,
                  "MaxAttempts": 3,
                  "BackoffRate": 2
                }
              ],
              "End": true
            }
          }
        },
        {
          "StartAt": "Retrieve NPTG Data",
          "States": {
            "Retrieve NPTG Data": {
              "Type": "Task",
              "Resource": "arn:aws:states:::lambda:invoke",
              "Parameters": {
                "FunctionName": "${var.nptg_retriever_function_arn}:$LATEST"
              },
              "Retry": [
                {
                  "ErrorEquals": [
                    "Lambda.ServiceException",
                    "Lambda.AWSLambdaException",
                    "Lambda.SdkClientException",
                    "Lambda.TooManyRequestsException"
                  ],
                  "IntervalSeconds": 1,
                  "MaxAttempts": 3,
                  "BackoffRate": 2
                }
              ],
              "Next": "Process NPTG Data"
            },
            "Process NPTG Data": {
              "Type": "Task",
              "Resource": "arn:aws:states:::lambda:invoke",
              "Parameters": {
                "FunctionName": "${var.nptg_uploader_function_arn}:$LATEST",
                "Payload": {
                  "Records": [
                    {
                      "s3": {
                        "object": {
                          "key": "NPTG.xml"
                        },
                        "bucket": {
                          "name": "${var.nptg_bucket_name}"
                        }
                      }
                    }
                  ]
                }
              },
              "Retry": [
                {
                  "ErrorEquals": [
                    "Lambda.ServiceException",
                    "Lambda.AWSLambdaException",
                    "Lambda.SdkClientException",
                    "Lambda.TooManyRequestsException"
                  ],
                  "IntervalSeconds": 1,
                  "MaxAttempts": 3,
                  "BackoffRate": 2
                }
              ],
              "End": true
            }
          }
        },
        {
          "StartAt": "Retrieve Bank Holidays Data",
          "States": {
            "Retrieve Bank Holidays Data": {
              "Type": "Task",
              "Resource": "arn:aws:states:::lambda:invoke",
              "Parameters": {
                "FunctionName": "${var.bank_holidays_retriever_function_arn}:$LATEST"
              },
              "Retry": [
                {
                  "ErrorEquals": [
                    "Lambda.ServiceException",
                    "Lambda.AWSLambdaException",
                    "Lambda.SdkClientException",
                    "Lambda.TooManyRequestsException"
                  ],
                  "IntervalSeconds": 1,
                  "MaxAttempts": 3,
                  "BackoffRate": 2
                }
              ],
              "End": true
            }
          }
        }
      ],
      "Next": "Retrieve BODS TXC Data"
    },
    "Retrieve BODS TXC Data": {
      "Type": "Task",
      "Resource": "arn:aws:states:::lambda:invoke",
      "Parameters": {
        "FunctionName": "${var.bods_txc_retriever_function_arn}:$LATEST"
      },
      "Retry": [
        {
          "ErrorEquals": [
            "Lambda.ServiceException",
            "Lambda.AWSLambdaException",
            "Lambda.SdkClientException",
            "Lambda.TooManyRequestsException"
          ],
          "IntervalSeconds": 1,
          "MaxAttempts": 3,
          "BackoffRate": 2
        }
      ],
      "OutputPath": "$.Payload",
      "Next": "Get Zipped BODS TXC Keys"
    },
    "Get Zipped BODS TXC Keys": {
      "Type": "Map",
      "ItemProcessor": {
        "ProcessorConfig": {
          "Mode": "DISTRIBUTED",
          "ExecutionType": "STANDARD"
        },
        "StartAt": "Unzip BODS TXC Data",
        "States": {
          "Unzip BODS TXC Data": {
            "Type": "Task",
            "Resource": "arn:aws:states:::lambda:invoke",
            "Parameters": {
              "FunctionName": "${var.unzipper_function_arn}:$LATEST",
              "Payload": {
                "Records": [
                  {
                    "s3": {
                      "bucket": {
                        "name": "${var.bods_txc_zipped_bucket_name}"
                      },
                      "object": {
                        "key.$": "$.Key"
                      }
                    }
                  }
                ]
              }
            },
            "End": true,
            "Retry": [
              {
                "ErrorEquals": [
                  "Lambda.ServiceException",
                  "Lambda.AWSLambdaException",
                  "Lambda.SdkClientException",
                  "Lambda.TooManyRequestsException"
                ],
                "BackoffRate": 2,
                "IntervalSeconds": 1,
                "MaxAttempts": 3
              }
            ]
          }
        }
      },
      "Label": "GetZippedBODSTXCKeys",
      "ItemReader": {
        "Resource": "arn:aws:states:::s3:listObjectsV2",
        "Parameters": {
          "Bucket.$": "$.bodsTxcZippedBucketName",
          "Prefix.$": "$.bodsTxcPrefix"
        }
      },
      "ResultPath": null,
      "Next": "Get BODS TXC Object Keys"
    },
    "Get BODS TXC Object Keys": {
      "Type": "Map",
      "ItemProcessor": {
        "ProcessorConfig": {
          "Mode": "DISTRIBUTED",
          "ExecutionType": "STANDARD"
        },
        "StartAt": "Process BODS TXC",
        "States": {
          "Process BODS TXC": {
            "Type": "Task",
            "Resource": "arn:aws:states:::lambda:invoke",
            "Parameters": {
              "FunctionName": "${var.txc_processor_function_arn}:$LATEST",
              "Payload": {
                "Records": [
                  {
                    "s3": {
                      "bucket": {
                        "name": "${var.txc_bucket_name}"
                      },
                      "object": {
                        "key.$": "$.Key"
                      }
                    }
                  }
                ]
              }
            },
            "End": true
          }
        }
      },
      "ItemReader": {
        "Resource": "arn:aws:states:::s3:listObjectsV2",
        "Parameters": {
          "Bucket.$": "$.txcBucketName",
          "Prefix.$": "$.bodsTxcPrefix"
        },
        "ReaderConfig": {}
      },
      "MaxConcurrency": 50,
      "Label": "GetBODSTXCObjectKeys",
      "ToleratedFailureCount": 10,
      "Next": "Retrieve TNDS TXC Data",
      "ResultPath": null
    },
    "Retrieve TNDS TXC Data": {
      "Type": "Task",
      "Resource": "arn:aws:states:::lambda:invoke",
      "Parameters": {
        "FunctionName": "${var.tnds_txc_retriever_function_arn}:$LATEST"
      },
      "Retry": [
        {
          "ErrorEquals": [
            "Lambda.ServiceException",
            "Lambda.AWSLambdaException",
            "Lambda.SdkClientException",
            "Lambda.TooManyRequestsException"
          ],
          "IntervalSeconds": 1,
          "MaxAttempts": 3,
          "BackoffRate": 2
        }
      ],
      "Next": "Get Zipped TNDS TXC Keys",
      "ResultPath": "$.tndsRetrieverOutput",
      "ResultSelector": {
        "tndsTxcPrefix.$": "$.Payload.tndsTxcPrefix",
        "tndsTxcZippedBucketName.$": "$.Payload.tndsTxcZippedBucketName"
      }
    },
    "Get Zipped TNDS TXC Keys": {
      "Type": "Map",
      "ItemProcessor": {
        "ProcessorConfig": {
          "Mode": "DISTRIBUTED",
          "ExecutionType": "STANDARD"
        },
        "StartAt": "Unzip TNDS TXC Data",
        "States": {
          "Unzip TNDS TXC Data": {
            "Type": "Task",
            "Resource": "arn:aws:states:::lambda:invoke",
            "Parameters": {
              "FunctionName": "${var.unzipper_function_arn}:$LATEST",
              "Payload": {
                "Records": [
                  {
                    "s3": {
                      "bucket": {
                        "name": "${var.tnds_txc_zipped_bucket_name}"
                      },
                      "object": {
                        "key.$": "$.Key"
                      }
                    }
                  }
                ]
              }
            },
            "Retry": [
              {
                "ErrorEquals": [
                  "Lambda.ServiceException",
                  "Lambda.AWSLambdaException",
                  "Lambda.SdkClientException",
                  "Lambda.TooManyRequestsException"
                ],
                "IntervalSeconds": 1,
                "MaxAttempts": 3,
                "BackoffRate": 2
              }
            ],
            "End": true
          }
        }
      },
      "Label": "GetZippedTNDSTXCKeys",
      "ItemReader": {
        "Resource": "arn:aws:states:::s3:listObjectsV2",
        "Parameters": {
          "Bucket.$": "$.tndsRetrieverOutput.tndsTxcZippedBucketName",
          "Prefix.$": "$.tndsRetrieverOutput.tndsTxcPrefix"
        }
      },
      "ResultPath": null,
      "Next": "Get TNDS TXC Object Keys"
    },
    "Get TNDS TXC Object Keys": {
      "Type": "Map",
      "ItemProcessor": {
        "ProcessorConfig": {
          "Mode": "DISTRIBUTED",
          "ExecutionType": "STANDARD"
        },
        "StartAt": "Process TNDS TXC",
        "States": {
          "Process TNDS TXC": {
            "Type": "Task",
            "Resource": "arn:aws:states:::lambda:invoke",
            "Parameters": {
              "FunctionName": "${var.txc_processor_function_arn}:$LATEST",
              "Payload": {
                "Records": [
                  {
                    "s3": {
                      "bucket": {
                        "name": "${var.txc_bucket_name}"
                      },
                      "object": {
                        "key.$": "$.Key"
                      }
                    }
                  }
                ]
              }
            },
            "End": true
          }
        }
      },
      "ItemReader": {
        "Resource": "arn:aws:states:::s3:listObjectsV2",
        "Parameters": {
          "Bucket.$": "$.txcBucketName",
          "Prefix.$": "$.tndsRetrieverOutput.tndsTxcPrefix"
        },
        "ReaderConfig": {}
      },
      "MaxConcurrency": 50,
      "Label": "GetTNDSTXCObjectKeys",
      "ToleratedFailureCount": 10,
      "ResultPath": null,
      "Next": "Run Table Renamer"
    },
    "Run Table Renamer": {
      "Type": "Task",
      "Resource": "arn:aws:states:::lambda:invoke",
      "Parameters": {
        "FunctionName": "${var.table_renamer_function_arn}:$LATEST"
      },
      "Retry": [
        {
          "ErrorEquals": [
            "Lambda.ServiceException",
            "Lambda.AWSLambdaException",
            "Lambda.SdkClientException",
            "Lambda.TooManyRequestsException"
          ],
          "IntervalSeconds": 1,
          "MaxAttempts": 3,
          "BackoffRate": 2
        }
      ],
      "Next": "Generate GTFS Timetables"
    },
    "Generate GTFS Timetables": {
      "Type": "Task",
      "Resource": "arn:aws:states:::lambda:invoke",
      "Parameters": {
        "FunctionName": "${var.gtfs_timetables_generator_function_arn}:$LATEST"
      },
      "Retry": [
        {
          "ErrorEquals": [
            "Lambda.ServiceException",
            "Lambda.AWSLambdaException",
            "Lambda.SdkClientException",
            "Lambda.TooManyRequestsException"
          ],
          "IntervalSeconds": 1,
          "MaxAttempts": 3,
          "BackoffRate": 2
        }
      ],
      "End": true
    }
  }
}
EOF
}

resource "aws_iam_policy" "integrated_data_timetables_sfn_policy" {
  name = "integrated-data-timetables-sfn-policy-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        "Effect" : "Allow",
        "Action" : [
          "lambda:InvokeFunction"
        ],
        "Resource" : [
          var.nptg_retriever_function_arn,
          var.nptg_uploader_function_arn,
          var.noc_retriever_function_arn,
          var.noc_processor_function_arn,
          var.bods_txc_retriever_function_arn,
          var.tnds_txc_retriever_function_arn,
          var.unzipper_function_arn,
          var.txc_processor_function_arn,
          var.gtfs_timetables_generator_function_arn,
          var.db_cleardown_function_arn,
          var.table_renamer_function_arn,
          var.naptan_retriever_function_arn,
          var.naptan_uploader_function_arn,
          var.bank_holidays_retriever_function_arn,
          "${var.nptg_retriever_function_arn}*",
          "${var.nptg_uploader_function_arn}*",
          "${var.noc_retriever_function_arn}*",
          "${var.noc_processor_function_arn}*",
          "${var.bods_txc_retriever_function_arn}*",
          "${var.tnds_txc_retriever_function_arn}*",
          "${var.unzipper_function_arn}*",
          "${var.txc_processor_function_arn}*",
          "${var.gtfs_timetables_generator_function_arn}*",
          "${var.db_cleardown_function_arn}*",
          "${var.table_renamer_function_arn}*",
          "${var.naptan_retriever_function_arn}*",
          "${var.naptan_uploader_function_arn}*",
          "${var.bank_holidays_retriever_function_arn}*"
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "s3:ListBucket"
        ],
        "Resource" : [
          "arn:aws:s3:::${var.bods_txc_zipped_bucket_name}",
          "arn:aws:s3:::${var.tnds_txc_zipped_bucket_name}",
          "arn:aws:s3:::${var.txc_bucket_name}"
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "states:RedriveExecution"
        ],
        "Resource" : [
          "arn:aws:states:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:execution:${aws_sfn_state_machine.integrated_data_timetables_sfn.name}/*"
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "states:StartExecution"
        ],
        "Resource" : [
          "${aws_sfn_state_machine.integrated_data_timetables_sfn.arn}"
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "states:DescribeExecution",
          "states:StopExecution"
        ],
        "Resource" : [
          "${aws_sfn_state_machine.integrated_data_timetables_sfn.arn}"
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets"
        ],
        "Resource" : [
          "*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "integrated_data_timetables_sfn_policy_attachment" {
  policy_arn = aws_iam_policy.integrated_data_timetables_sfn_policy.arn
  role       = aws_iam_role.integrated_data_timetables_sfn_role.name
}
