// The code is mostly from https://github.com/dannychua/nicehashjs2
// also it has pieces from https://github.com/bhusalb/nicehash-api

const axios = require('axios')
const buildURL = require('axios/lib/helpers/buildURL')
const crypto = require('crypto')

const API_BASE_URL = 'https://api2.nicehash.com';
const axiosConfig = {
  baseURL: API_BASE_URL,
  timeout: 1000 * 10,
}

class NiceHashClient {
  /**
   * Creates a new client
   * @param options Object
   * @param options.apiKey String - API Key
   * @param options.apiSecret String - API Secret
   * @param options.orgsnizationId String - Organization Id
   */
  constructor(options) {
    this.apiKey = options.apiKey;
    this.apiSecret = options.apiSecret;
    this.organizationId = options.organizationId || '';
    this.axios = axios.create(axiosConfig);
  }

  hasAuthTokens() {
    return !!this.apiKey && !!this.apiSecret;
  }

  getAuthParams() {
    return { key: this.apiKey, secret: this.apiSecret };
  }

  getRandomString() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  getServerTimestamp() {
    return Date.now().toString()
  }

  hmacSha256BySegments(input) {
    let signature = crypto.createHmac('sha256', this.apiSecret)

    for (let index in input) {
      if (+index) {
        signature.update(Buffer.from([0]))
      }

      if (input[index] !== null) {
        signature.update(Buffer.from(input[index]))
      }
    }

    return signature.digest('hex')
  }

  getHeaders(httpMethod, requestPath, params) {
    const ts = this.getServerTimestamp()
    const query = buildURL('',params).substring(1)
    const nonce = this.getRandomString()

    const input = [
      this.apiKey,
      ts,
      nonce,
      null,
      this.organizationId,
      null,
      httpMethod.toUpperCase(),
      requestPath,
      query
    ]


    return {
      'X-Request-Id': ts,
      'X-Time': ts,
      'X-Nonce': nonce,
      'X-Auth': `${this.apiKey}:${this.hmacSha256BySegments(input)}`
    }
  }

  getRequestPromise(httpMethod, requestPath, params) {
    const payload =
      {
        headers: this.getHeaders(httpMethod, requestPath, params),
        params: params
      };

    return this.axios.get(requestPath, payload)
  }

  getUnsignedRequestPromise(httpMethod, requestPath, params) {
    const payload =
      {
        headers: {},
        params: params
      };
    return this.axios.get(requestPath, payload)
  }

  getWallets() {
    return this.getRequestPromise('GET', '/main/api/v2/accounting/accounts2', {})
  }

  getWallet(currency) {
    return this.getRequestPromise('GET', `/main/api/v2/accounting/account2/${currency}`, {extendedResponse: true})
  }

  getPayouts() {
    return this.getRequestPromise('GET', '/main/api/v2/mining/rigs/payouts', {})
  }

  getHashpowerEarnings() {
    const currency = 'BTC'
    const params = {
      op: 'LT',
      timestamp: Date.now(),
    }
    return this.getRequestPromise('GET', '/main/api/v2/accounting/hashpowerEarnings/'+currency, params)
  }

  getMiningRigs() {
    return this.getRequestPromise('GET', '/main/api/v2/mining/rigs2', {})
  }

  getMiningRigsStats(afterTimestamp) {
    const params = {}
    if(afterTimestamp) {
      params['afterTimestamp'] = afterTimestamp
    }

    return this.getRequestPromise('GET', '/main/api/v2/mining/rigs/stats/unpaid', params)
  }

  getMiningUnpaid() {
    return this.getRequestPromise('GET', '/main/api/v2/mining/rigs/stats/unpaid', {})
  }

  /**
   * Get the latest forex exchange rates
   *
   *  - This is a public API endpoint
   */
  getExchangeRates() {
    return this.getUnsignedRequestPromise('GET', '/main/api/v2/exchangeRate/list', {});
  }
}

module.exports = NiceHashClient;
