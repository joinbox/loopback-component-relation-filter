# loopback-component-relation-filter

Enables where query filters on related Loopback (3) models attached to a postgres data source.

> Since Loopback3 is will reach its
> [EOL in December 2020](https://loopback.io/doc/en/contrib/Long-term-support.html) we will likely
> stop updating this package. Fixing its current limitations would require us to do a significant
> rewrite.

## Purpose

By default, Loopback3 does not allow filtering over relations and related models. This component
enables said feature by adding query pre-processing which loads the ids of the requested entities in
one single query from the database.

## Configuration

Enable/disable extended searching for all models in your `component-config`:

```Json
{
    "@joinbox/loopback-component-relation-filter": {
        "enabled": true,
        "rejectUnknownProperties": true,
        "preserveColumnCase": true
    }
}
```

Enable/disable searching for a specific model in your `model-config.json` (or also in your models
definition file):

```Json
{
    "YourModel": {
        "options": {
            "relationFilter": {
                "enabled": false,
                "rejectUnknownProperties": true,
                "preserveColumnCase": false
            }
        }
    }
}
```

### RejectUnknownProperties

If `rejectUnknownProperties` (default is `true`) is set to `false` the component will not throw an
error during the normalization if the queried property/relation does not exist on the queried model.
One can use this configuration value to ensure that legacy queries still work properly and do not
fail.

### PreserveColumnCase

If `preserveColumnCase` is set to false, column names are converted to lowercase when building the
query. This option allows the user to make the filtering work with older, auto generated models
(i.e. using `automigrate/-update`) where the column names were lowercased (e.g. property `startDate`
will be converted to a column `startdate`).

## Usage

The component uses Loopback's [where query](https://loopback.io/doc/en/lb3/Where-filter.html) to
create a big sql query against the database. Enable the filtering on your model and nest your where
queries. The component supports a majority of the documented operators except near and regexp.

```javascript
// e.g. load all books having an author which is employed by a certain publisher and is older than
// a certain age
const filter = {
    where: {
        author {
            employer: {
                identifier: 'fancy-publishing'
            },
            age: {
                gt: 20,
            },
        },
    },
};
const books = await Book.find(filter);
```

## Caveats/Limitations

This package still has some serious limitations which are worth considering:

- It is compatible with Loopback3 only.
- The query building does not work correctly with or queries.
- We do not support all documented operators namely: near and regexp (even though it is supported by
  postgres).
- It only supports postgres databases.

## Testing

Check the `package.json` to see how to execute tests:

  - **all:** `npm test`
  - **unit:** `npm run test:unit`
  - **integration:** `npm run test:integration`
  - **watch tests during development:** `npm run test:watch` (uses mocha's `--watch` option)
  - **linting:** `npm run lint`
  
