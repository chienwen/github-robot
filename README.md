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
PLURK_MY_USER_ID=

FACEBOOK_TITLE_MATCH_PATTERN=

PTT_USERS_COMMA_SEP=
PTT_BOARDS_COMMA_SEP=ALLPOST
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
npm run facebook -- my_facebook_dump/groups/your_posts_and_comments_in_groups.json 0 8000 >> log.txt 2>&1
```

## Backup ptt

```
npm run ptt
```
