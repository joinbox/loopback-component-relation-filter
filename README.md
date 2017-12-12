# loopback-relation-filter
Enables where query filters on related loopback models.

## Configuration

Enable/disable extended searching for all models in your `component-config`:

```Json
{
    "loopback-component-relation-filter": {
        "enabled": true,
        "rejectUnknownProperties": true
    }
}

```

Enable/disable searching in a specific model config:

```Json
{
    "relationFilter": {
        "enabled": true,
        "rejectUnknownProperties": true
    }
}
```

If `rejectUnknownProperties` is set to true the component throws an error during the normalization.

## Testing

Check the `package.json` to see how to execute tests:

  - **all:** `npm test`
  - **unit:** `npm run test:unit`
  - **integration:** `npm run test:integration`
  - **watch tests during development:** `npm run test:watch` (uses mocha's `--watch` option)
  - **linting:** `npm run lint`
  
