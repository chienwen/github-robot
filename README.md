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

cron settings

```
0 8 * * * cd ~/github-robot/ && /usr/bin/npm run plurk -- --fetch-count-limit=50
```

## Backup facebook group

```
npm run facebook -- ~/Downloads/facebook-chienwenchen94/groups/your_posts_and_comments_in_groups.json 0 100
```

To backup approximately the 7k items:

```
npm run facebook -- ~/Downloads/facebook-chienwenchen94/groups/your_posts_and_comments_in_groups.json 0 1000 && npm run facebook -- ~/Downloads/facebook-chienwenchen94/groups/your_posts_and_comments_in_groups.json 1000, 2000 && npm run facebook -- ~/Downloads/facebook-chienwenchen94/groups/your_posts_and_comments_in_groups.json 2000 3000 && npm run facebook -- ~/Downloads/facebook-chienwenchen94/groups/your_posts_and_comments_in_groups.json 3000 4000 && npm run facebook -- ~/Downloads/facebook-chienwenchen94/groups/your_posts_and_comments_in_groups.json 4000 5000 && npm run facebook -- ~/Downloads/facebook-chienwenchen94/groups/your_posts_and_comments_in_groups.json 5000 6000 && npm run facebook -- ~/Downloads/facebook-chienwenchen94/groups/your_posts_and_comments_in_groups.json 6000 7000 && npm run facebook -- ~/Downloads/facebook-chienwenchen94/groups/your_posts_and_comments_in_groups.json 7000 8000
```

