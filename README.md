[![Docker Build Status](https://img.shields.io/docker/cloud/build/tg44/nicehash-exporter?style=flat-square)](https://hub.docker.com/r/tg44/nicehash-exporter)

# NiceHash exporter

A small service to expose miner stats from NH to Prometheus.

## Running the app

### Local install / dev
You need node 12, start with `npm i` and then `node app.js`.
For setting the NH api keys you need to `export NH_API_KEY="key"` and `export NH_API_SECRET="secret"` before the service start.

You can reach the metrics on `localhost:3000/metrics`.

### Docker and compose
For docker you can run;
```
docker run -e NH_API_KEY="key" -e NH_API_SECRET="secret" -e NH_API_ORG_ID="orgId" ghcr.io/tg44/nicehash-exporter
```
For docker compose;
```
version: '3.1'
services:
  nicehash-exporter:
    image: ghcr.io/tg44/nicehash-exporter
    restart: unless-stopped
    environment:
      - NH_API_KEY=key
      - NH_API_SECRET=secret
      - NH_API_ORG_ID=orgId
      - PORT=3000 #optionally you can override the port inside for dev reasons, default is 3000
      - REFRESH_RATE_SECONDS=30 #optionally you can override the api poll rate, default is 30
      - NODDE_METRICS_PREFIX=nh_ #optionally you can override the node system/app metrics prefix, default is empty
      - NH_METRICS_PREFIX=nh_ #optionally you can override the NH metrics prefix, default is nh_
      - NH_RATES=BTCUSDC,BTCEURS #optionally you can override the exported rates in a comma separated list of rates
    ports:
      - 3000:3000
```

## Breaking changes
 - 2021.07.27.
   - nh_total_btc modified to actually show the total money in btc for the account and not only just the total btc amount
   - we will permanently move away from dockerhub, the latest images will be pushed, but the documentation and the other infos will only be updated here
     - DH freeze the free builds, while GH-Actions not only build free, but gives us public repositories too
 - 2021.06.19.
   - due to changes on NH end, the orgId mandatory from now
 - 2021.05.31.
   - btc_usd_rate get renamed to btcusdc_rate due to the configurable rate list option

## Support

PRs are always welcome!

ETH: `0x58f2198cda7d6cac855dd3fa29abe67e98adb2cd`

But, if you want to support my work in any way just send me an email ;) (You can find my email address in the git commit history.)
