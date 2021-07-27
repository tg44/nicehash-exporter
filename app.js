const NicehashJS = require('./nicehash')
const client = require('prom-client')
const Gauge = client.Gauge
const express = require('express')
require('dotenv').config()

// settings

const port = process.env.PORT || 3000
const refreshRateSeconds = process.env.REFRESH_RATE_SECONDS || 30
const nodeMetricsPrefix = process.env.NODDE_METRICS_PREFIX || ''
const prefix = process.env.NH_METRICS_PREFIX || 'nh_'
const apiKey = process.env.NH_API_KEY
const apiSecret = process.env.NH_API_SECRET
const organizationId = process.env.NH_API_ORG_ID
const rates = process.env.NH_RATES ? process.env.NH_RATES.split(',') : ['BTCUSDC', 'BTCEURS']

if(!apiKey || !apiSecret || !organizationId) {
  console.log("You need an api key and an api secret and orgId!")
  console.log("https://www.nicehash.com/my/settings/keys")
  return 1
}

// init libs
const app = express()

const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({prefix: nodeMetricsPrefix})

const register = client.register;

const nhClient = new NicehashJS({
  apiKey,
  apiSecret,
  organizationId
});

// metrics

const totalRigs = new Gauge({
  name: prefix + 'total_rigs',
  help: 'Number of rigs you own'
});
const totalDevices = new Gauge({
  name: prefix +'total_devices',
  help: 'Number of devices in the rigs'
});
const totalProfitability = new Gauge({
  name: prefix +'total_profitability',
  help: 'totalProfitability'
});
const unpaidAmount = new Gauge({
  name: prefix +'unpaid_amount',
  help: 'unpaidAmount'
});
const totalBtc = new Gauge({
  name: prefix +'total_btc',
  help: 'totalBtc',
});
const rateGauges = rates.map(r => {
  return {
    rate: r,
    gauge: new Gauge({
      name: prefix + r.toLowerCase() + '_rate',
      help: r + ' rate',
    })
  }
});
const minerStatuses = new Gauge({
  name: prefix +'miner_statuses',
  help: 'minerStatuses',
  labelNames: ['status'],
});
const devicesStatuses = new Gauge({
  name: prefix +'devices_statuses',
  help: 'devicesStatuses',
  labelNames: ['status'],
});

const deviceTemp = new Gauge({
  name: prefix +'device_temp',
  help: 'deviceTemp',
  labelNames: ['rig_name', 'device_name', 'device_id', 'device_type'],
});
const deviceLoad = new Gauge({
  name: prefix +'device_load',
  help: 'deviceLoad',
  labelNames: ['rig_name', 'device_name', 'device_id', 'device_type'],
});
const devicePower = new Gauge({
  name: prefix +'device_power',
  help: 'devicePower',
  labelNames: ['rig_name', 'device_name', 'device_id', 'device_type'],
});
const deviceSpeed = new Gauge({
  name: prefix +'device_speed',
  help: 'deviceSpeed',
  labelNames: ['rig_name', 'device_name', 'device_id', 'device_type', 'algo', 'suffix'],
});

const rigStatusTime = new Gauge({
  name: prefix +'rig_status_time',
  help: 'rigStatusTime',
  labelNames: ['rig_name', 'rig_id'],
});
const rigJoinTime = new Gauge({
  name: prefix +'rig_join_time',
  help: 'rigJoinTime',
  labelNames: ['rig_name', 'rig_id'],
});

const deviceStatusInfo = new Gauge({
  name: prefix +'device_status_info',
  help: 'deviceStatusInfo',
  labelNames: ['rig_name', 'device_name', 'device_id', 'device_type', 'status'],
});

async function refreshMetrics() {
  deviceStatusInfo.reset()
  minerStatuses.reset()
  devicesStatuses.reset()
  try {
    const rawResponse = await nhClient.getMiningRigs()
    const data = rawResponse.data
    //console.log(data)

    totalRigs.set(data.totalRigs)
    totalDevices.set(data.totalDevices)
    totalProfitability.set(data.totalProfitability)
    unpaidAmount.set(+data.unpaidAmount)
    Object.keys(data.minerStatuses).forEach(k => minerStatuses.labels(k).set(data.minerStatuses[k]))
    Object.keys(data.devicesStatuses).forEach(k => devicesStatuses.labels(k).set(data.devicesStatuses[k]))
    data.miningRigs.forEach(rig => {
      rigStatusTime.labels(rig.name, rig.rigId).set(rig.statusTime)
      try {
        rigJoinTime.labels(rig.name, rig.rigId).set(rig.joinTime)
      } catch (e) {}
      (rig.devices || []).forEach(device => {
        try {
          deviceTemp.labels(rig.name, device.name, device.id, device.deviceType.enumName).set(device.temperature)
          deviceLoad.labels(rig.name, device.name, device.id, device.deviceType.enumName).set(device.load)
          devicePower.labels(rig.name, device.name, device.id, device.deviceType.enumName).set(device.powerUsage)
          deviceStatusInfo.labels(rig.name, device.name, device.id, device.deviceType.enumName, device.status.enumName).set(1)
          device.speeds.forEach(speed => {
            //console.log(speed)
            deviceSpeed.labels(rig.name, device.name, device.id, device.deviceType.enumName, speed.algorithm, speed.displaySuffix).set(+speed.speed)
          })
        } catch (e) {
          console.log("there was an error parsing " + JSON.stringify(device) + " with ", e)
        }
      })
    })
  } catch (e) {
    console.log("there was an error on request1 ", e)
  }

  try {
    const rawResponse2 = await nhClient.getWallets()
    const data2 = rawResponse2.data
    //console.log(data2)
    totalBtc.set(+data2.total.totalBalance)
    //fiatRate.set(data2.totalBalance)
  } catch (e) {
    console.log("there was an error on request2 ", e)
  }

  try {
    const rawResponse3 = await nhClient.getExchangeRates()
    const data3 = rawResponse3.data
    //console.log(data3)
    rateGauges.forEach( r => {
      try {
        r.gauge.set(+data3[r.rate])
      } catch (e) {
        console.log(`given rate ${r.rate} not found in ${data3}`)
      }
    })
  } catch (e) {
    console.log("there was an error on request3 ", e)
  }
}

// APIS

app.get('/', (req, res) => {
  res.send('This is an empty index, you want to go to the <a href="/metrics">metrics</a> endpoint for data!')
})

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
})

// Start the things

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})

refreshMetrics()

setInterval(() => {
  refreshMetrics();
}, refreshRateSeconds*1000);
