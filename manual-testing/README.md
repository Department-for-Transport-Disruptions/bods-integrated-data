# Manual testing

The `.http` files in this directory can be used to send requests using the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) VS Code extension.
See the extension's readme for more details on usage. Other IDEs may have similar extensions to use `.http` files.

## Usage

To send a request, click the "Send Request" link that appears next to a request in the file.
Some requests use prompt variables to allow you to set values at the point of sending a request.
You can leave the prompts blank if you wish to send a blank value.

## Environment variables

Environment variables are used in the files in order to access both sensitive and environment-specific values such as endpoints and API keys.
Add these variables in your VS Code settings JSON file (or equivalent IDE settings), for example:

```json
{
  "rest-client.environmentVariables": {
    "$shared": {},
    "dev": {
      "avlProducerEndpoint": "https://example.com",
      "avlProducerApiKey": "secret-api-key",
      "cancellationsProducerEndpoint": "https://example.com",
      "cancellationsProducerApiKey": "secret-api-key",
      "gtfsApiEndpoint": "https://example.com",
      "mockDataReceiverEndpoint": "https://example.com",
      "siriConsumerEndpoint": "https://example.com",
    },
    "test": {
      "avlProducerEndpoint": "https://example.com",
      "avlProducerApiKey": "secret-api-key",
      "cancellationsProducerEndpoint": "https://example.com",
      "cancellationsProducerApiKey": "secret-api-key",
      "gtfsApiEndpoint": "https://example.com",
      "mockDataReceiverEndpoint": "https://example.com",
      "siriConsumerEndpoint": "https://example.com",
    }
  }
}
```

You can acquire the values from another developer, or by accessing the secret values from AWS Secrets Manager in each AWS account.

To change which active environment is being used, open a `.http` and click the name of the environment in the bottom taskbar in VS Code.
