## Configuration

Put a file `.npmrc` like:

```ini
GITHUB_OWNER=chienwen
GITHUB_REPO=blahblah
GITHUB_AUTH_TOKEN=

PLURK_CONSUMER_KEY=
PLURK_CONSUMER_SECRET=
PLURK_OAUTH_ACCESS_TOKEN=
PLURK_OAUTH_ACCESS_TOKEN_SECRET=
```

## Backup plurks

```
npm run plurk -- --fetch-count-limit=10 --fetch-batch-size=10
```


