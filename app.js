const NicehashJS = require('./nicehash');
const client = require('prom-client');
const Gauge = client.Gauge;
const express = require('express');
require('dotenv').config();

// Impostazioni
const port = process.env.PORT || 3000;
const refreshRateSeconds = process.env.REFRESH_RATE_SECONDS || 30;
const nodeMetricsPrefix = process.env.NODE_METRICS_PREFIX || '';
const prefix = process.env.NH_METRICS_PREFIX || 'nh_';
const apiKey = process.env.NH_API_KEY;
const apiSecret = process.env.NH_API_SECRET;
const organizationId = process.env.NH_API_ORG_ID;
const rates = process.env.NH_RATES ? process.env.NH_RATES.split(',') : ['BTCUSDC', 'BTCEURS'];

if (!apiKey || !apiSecret || !organizationId) {
  console.log("You need an api key and an api secret and orgId!");
  console.log("https://www.nicehash.com/my/settings/keys");
  return 1;
}

// Inizializzazione librerie
const app = express();

const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ prefix: nodeMetricsPrefix });

const register = client.register;

const nhClient = new NicehashJS({
  apiKey,
  apiSecret,
  organizationId
});

// Metriche Prometheus per il singolo rig
const rigStatus = new Gauge({
  name: prefix + 'rig_status',
  help: 'Status of the mining rig',
  labelNames: ['rig_id', 'status']
});

const rigTemperature = new Gauge({
  name: prefix + 'rig_temperature',
  help: 'Temperature of the mining rig',
  labelNames: ['rig_id']
});

const rigLoad = new Gauge({
  name: prefix + 'rig_load',
  help: 'Load of the mining rig',
  labelNames: ['rig_id']
});

const rigPower = new Gauge({
  name: prefix + 'rig_power',
  help: 'Power usage of the mining rig',
  labelNames: ['rig_id']
});

const rigSpeed = new Gauge({
  name: prefix + 'rig_speed',
  help: 'Mining speed of the mining rig',
  labelNames: ['rig_id', 'algorithm']
});

// Metriche Prometheus per i gruppi di mining
const totalRigsByGroup = new Gauge({
  name: prefix + 'total_rigs_by_group',
  help: 'Number of rigs in each mining group',
  labelNames: ['group_name']
});

const totalDevicesByGroup = new Gauge({
  name: prefix + 'total_devices_by_group',
  help: 'Number of devices in each mining group',
  labelNames: ['group_name']
});

const totalProfitabilityByGroup = new Gauge({
  name: prefix + 'total_profitability_by_group',
  help: 'Total profitability of rigs in each mining group',
  labelNames: ['group_name']
});

const unpaidAmountByGroup = new Gauge({
  name: prefix + 'unpaid_amount_by_group',
  help: 'Unpaid amount of rigs in each mining group',
  labelNames: ['group_name']
});

async function refreshMetrics() {
  try {
    const rawResponse = await nhClient.getMiningRigs();
    const data = rawResponse.data;

    // Aggiorna le metriche per i singoli rig
    updateRigMetrics(data);

    // Aggiorna le metriche per i gruppi di mining
    updateGroupMetrics(data);

    // Aggiorna le altre metriche...
  } catch (e) {
    console.log("There was an error on request1 ", e);
  }
}

// Funzione per aggiornare le metriche per i singoli rig
function updateRigMetrics(data) {
  data.miningRigs.forEach(rig => {
    const rigId = rig.rigId;
    rigStatus.labels(rigId, rig.minerStatus).set(1);
    rig.devices.forEach(device => {
      rigTemperature.labels(rigId).set(device.temperature);
      rigLoad.labels(rigId).set(device.load);
      rigPower.labels(rigId).set(device.powerUsage);
      device.speeds.forEach(speed => {
        rigSpeed.labels(rigId, speed.algorithm).set(speed.speed);
      });
    });
  });
}

// Funzione per aggiornare le metriche per i gruppi di mining
function updateGroupMetrics(data) {
  data.miningRigGroups.forEach(group => {
    const groupName = group.groupName;
    totalRigsByGroup.labels(groupName).set(group.totalRigs);
    totalDevicesByGroup.labels(groupName).set(group.totalDevices);
    totalProfitabilityByGroup.labels(groupName).set(group.totalProfitability);
    unpaidAmountByGroup.labels(groupName).set(parseFloat(group.unpaidAmount));
  });
}

// Avvia il server Express
app.get('/', (req, res) => {
  res.send('This is an empty index, you want to go to the <a href="/metrics">metrics</a> endpoint for data!');
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

refreshMetrics();

setInterval(() => {
  refreshMetrics();
}, refreshRateSeconds * 1000);
