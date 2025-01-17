const fs = require('fs-extra');
const path = require('path');
const bitcoin = require('bitgo-utxo-lib');
const txDecoder = require('agama-wallet-lib/src/transaction-decoder');
const komodoInterest = require('agama-wallet-lib/src/komodo-interest');
const {
  toSats,
  fromSats,
  getRandomIntInclusive,
} = require('agama-wallet-lib/src/utils');
const {
  pubToElectrumScriptHashHex,
  addressVersionCheck,
} = require('agama-wallet-lib/src/keys');
const btcnetworks = require('agama-wallet-lib/src/bitcoinjs-networks');
const {
  parseBlock,
  electrumMerkleRoot,
} = require('agama-wallet-lib/src/block');
const { kmdAssetChains } = require('agama-wallet-lib/src/coin-helpers');

const config = require('../config');
const remoteExplorers = require('../config').explorers;
const remoteExplorersInsight = require('../config').insight;
const _electrumServers = require('../config').electrumServers;
const { komodoParams } = require('../config');
const request = require('request');
const acSupply = require('./acSupply');
const electrumJSCore = require('./electrumjs.core.js');

const OVERVIEW_UPDATE_INTERVAL = 180000; // every 3 min
const SUMMARY_UPDATE_INTERVAL = 600000; // every 10 min
const MAX_REMOTE_EXPLORER_TIMEOUT = 10000;
const SOCKET_MAX_TIMEOUT = 20000;

const summaryFileLocation = path.join(__dirname, '../summary.json');
const overviewFileLocation = path.join(__dirname, '../overview.json');

// TODO: - add search one time caching, per request basis
//       - dump and provide data once it's available

let remoteExplorersArray = [];
let remoteExplorersArrayInsight = [];
let electrumServers = [];

for (let key in remoteExplorers) {
  remoteExplorersArray.push(key);
}

for (let key in remoteExplorersInsight) {
  if (key !== 'maxTxLength') {
    remoteExplorersArrayInsight.push(key);
  }
}

for (let key in _electrumServers) {
  electrumServers.push({
    coin: key,
    serverList: _electrumServers[key].serverList,
  });
}

const sortByDate = (data, sortKey) => {
  return data.sort((b, a) => {
    if (a[sortKey] < b[sortKey]) {
      return -1;
    }

    if (a[sortKey] > b[sortKey]) {
      return 1;
    }

    return 0;
  });
}

const sortTransactions = (transactions) => {
  return transactions.sort((b, a) => {
    if (a.height < b.height) {
      return -1;
    }

    if (a.height > b.height) {
      return 1;
    }

    return 0;
  });
}

module.exports = (api) => {
  api.get('/explorer/summary', (req, res, next) => {
    res.set({ 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      msg: 'success',
      result: api.explorer.summary,
    }));
  });

  api.get('/explorer/supply', (req, res, next) => {
    res.set({ 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      msg: 'success',
      result: req.query.coin && (acSupply[req.query.coin] || acSupply[req.query.coin.toUpperCase()]) ? acSupply[req.query.coin] || acSupply[req.query.coin.toUpperCase()] : acSupply,
    }));
  });

  api.getSummary = () => {
    if (!api.explorer.summary.length) {
      const cacheFileData = fs.readJsonSync(summaryFileLocation, { throws: false });
      
      if (cacheFileData) {
        api.explorer.summary = cacheFileData;
        api.log('set summary from cache');
      }
    }

    const _getSummary = () => {
      let remoteExplorersFinished = {};

      Promise.all(remoteExplorersArray.map((coin, index) => {
        return new Promise((resolve, reject) => {
          const options = {
            url: `${remoteExplorers[coin]}/ext/summary`,
            method: 'GET',
          };

          setTimeout(() => {
            if (!remoteExplorersFinished[coin]) {
              api.log(`summary ${coin} is stuck, cancel req`);
              resolve({
                coin,
                result: 'unable to get summary',
              });
            }
          }, MAX_REMOTE_EXPLORER_TIMEOUT);

          request(options, (error, response, body) => {
            remoteExplorersFinished[coin] = true;

            try {
              if (response &&
                  response.statusCode &&
                  response.statusCode === 200) {
                resolve({
                  coin,
                  data: JSON.parse(body).data,
                });
              } else {
                resolve({
                  coin,
                  data: 'unable to get summary',
                });
              }
            } catch (e) {
              resolve({
                coin,
                data: 'unable to get summary',
              });
            }
          });
        });
      }))
      .then(_result => {
        let result = _result;
        let _remoteExplorersFinished = {};

        // run insight explorers
        Promise.all(remoteExplorersArrayInsight.map((coin, index) => {
          return new Promise((resolve, reject) => {
            api.log(`insight summary ${coin}`);

            const options = {
              url: `${remoteExplorersInsight[coin].url}/status?q=getInfo`,
              method: 'GET',
            };

            setTimeout(() => {
              if (!_remoteExplorersFinished[coin]) {
                api.log(`summary ${coin} is stuck, cancel req`);
                resolve({
                  coin,
                  result: 'unable to get summary',
                });
              }
            }, MAX_REMOTE_EXPLORER_TIMEOUT);

            request(options, (error, response, body) => {
              _remoteExplorersFinished[coin] = true;

              try {
                if (response &&
                    response.statusCode &&
                    response.statusCode === 200) {
                  const {
                    difficulty,
                    blocks,
                    connections,
                  } = JSON.parse(body).info;
                  let data = [{
                    difficulty,
                    connections,
                    blockcount: blocks,
                    supply: acSupply[coin.toUpperCase()] || '',
                  }];
                  result.push({
                    coin: coin.toUpperCase(),
                    data,
                  });
                  resolve();
                } else {
                  resolve({
                    coin,
                    data: 'unable to get summary',
                  });
                }
              } catch (e) {
                resolve({
                  coin,
                  data: 'unable to get summary',
                });
              }
            });
          });
        }))
        .then(__result => {
          if (result &&
              result.length) {
            fs.writeFile(summaryFileLocation, JSON.stringify(result), (err) => {
              if (err) {
                api.log(`error updating summary cache file ${err}`);
              } else {
                const summaryFile = fs.readJsonSync(summaryFileLocation, { throws: false });
                let items = [];

                api.explorer.summary = summaryFile;

                api.log('explorer summary updated');
              }
            });
          }
        });
      });
    }

    _getSummary();
    setInterval(() => {
      _getSummary();
    }, SUMMARY_UPDATE_INTERVAL);
  }

  api.get('/explorer/overview', (req, res, next) => {
    res.set({ 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      msg: 'success',
      result: api.explorer.overview,
    }));
  });

  api.insightLastTransactions = (coin) => {
    return new Promise((resolveMain, rejectMain) => {
      const options = {
        url: `${config.insight[coin].url}/blocks?limit=${config.insight.maxTxLength}`,
        method: 'GET',
      };
      // api.log(`${config.insight[coin].url}/blocks?limit=${config.insight.maxTxLength}`);

      request(options, (error, response, body) => {
        if (response &&
            response.statusCode &&
            response.statusCode === 200) {
          try {
            const _blocks = JSON.parse(body).blocks;
            let _txs = [];
            // api.log(JSON.stringify(_blocks));

            if (_blocks &&
                _blocks.length) {
              Promise.all(_blocks.map((block, index) => {
                return new Promise((resolve, reject) => {
                  setTimeout(() => {
                    // api.log(`insight ${index}`);
                    // api.log(`${config.insight[coin].url}/txs?block=${block.hash}`);

                    const options = {
                      url: `${config.insight[coin].url}/txs?block=${block.hash}`,
                      method: 'GET',
                    };

                    request(options, (error, response, body) => {
                      if (response &&
                          response.statusCode &&
                          response.statusCode === 200) {
                        try {
                          let txs = JSON.parse(body);

                          if (txs &&
                              txs.txs) {
                            txs = txs.txs;
                            // api.log(txs);

                            for (let i = 0; i < txs.length; i++) {
                              _txs.push({
                                txid: txs[i].txid,
                                blockhash: block.hash,
                                blockindex: block.height,
                                timestamp: txs[i].time,
                                total: config.insight[coin].float ? toSats(txs[i].valueOut) : txs[i].valueOut,
                                vout: txs[i].vout,
                                vin: txs[i].vin,
                              });
                              resolve(true);
                            }
                          } else {
                            api.log(`unable to get txs in ${coin} block ${block.height}`);
                            resolve(false);
                          }
                        } catch (e) {
                          api.log(`unable to get txs in ${coin} block ${block.height}`);
                          resolve(false);
                        }
                      } else {
                        api.log(`unable to get txs in ${coin} block ${block.height}`);
                        resolve(false);
                      }
                    });
                  }, index * 1500);
                });
              }))
              .then(result => {
                api.log(`insight ${coin} last txs is finished, total txs ${_txs.length}`);
                // api.log(JSON.stringify(_txs));

                resolveMain({
                  coin,
                  result: JSON.stringify({
                    data: _txs,
                  }),
                });
              });
              // resolve(true);
            } else {
              resolveMain({
                coin,
                result: 'unable to get lasttx',
              });
              api.log(`unable to get insight last blocks for ${coin}`);
            }
          } catch (e) {
            resolveMain({
              coin,
              result: 'unable to get lasttx',
            });
            api.log(`unable to get insight last blocks for ${coin}`);
          }
        } else {
          resolveMain({
            coin,
            result: 'unable to get lasttx',
          });
          api.log(`unable to get insight last blocks for ${coin}`);
        }
      });
    });
  };

  api.getOverview = () => {
    if (!api.explorer.overview.length) {
      const cacheFileData = fs.readJsonSync(overviewFileLocation, { throws: false });
      
      if (cacheFileData) {
        api.explorer.overview = cacheFileData;
        api.log('set overview from cache');
      }
    }

    const _getOverview = () => {
      let remoteExplorersFinished = {};

      Promise.all(remoteExplorersArray.map((coin, index) => {
        return new Promise((resolve, reject) => {
          const options = {
            url: `${remoteExplorers[coin]}/ext/getlasttxs/0.00000001`,
            method: 'GET',
          };

          setTimeout(() => {
            if (!remoteExplorersFinished[coin]) {
              api.log(`overview ${coin} is stuck, cancel req`);
              resolve({
                coin,
                result: 'unable to get lasttx',
              });
            }
          }, MAX_REMOTE_EXPLORER_TIMEOUT);

          request(options, (error, response, body) => {
            remoteExplorersFinished[coin] = true;

            if (response &&
                response.statusCode &&
                response.statusCode === 200) {
              api.log(`overview got lasttx for ${coin}`);
              resolve({
                coin,
                result: body,
              });
            } else {
              api.log(`overview unable to get lasttx for ${coin}`);
              resolve({
                coin,
                result: 'unable to get lasttx',
              });
            }
          });
        });
      }))
      .then(_result => {
        let result = _result;

        api.log('overview executed');

        if (result &&
            result.length) {
          // run insight explorers
          Promise.all(remoteExplorersArrayInsight.map((coin, index) => {
            return new Promise((resolve, reject) => {
              api.log(`insight overview ${coin}`);

              api.insightLastTransactions(coin)
              .then((res) => {
                result.push(res);
                resolve();
              });
            });
          }))
          .then(__result => {
            const overviewData = result;
            
            const resSizeLimit = 1000;
            let items = [];

            api.log(`tracking ${overviewData.length} coin explorers`);

            for (let i = 0; i < overviewData.length; i++) {
              try {
                const _parseData = JSON.parse(overviewData[i].result).data;

                for (let j = 0; j < _parseData.length; j++) {
                  items.push({
                    coin: overviewData[i].coin,
                    txid: _parseData[j].txid,
                    blockhash: _parseData[j].blockhash,
                    blockindex: _parseData[j].blockindex,
                    timestamp: _parseData[j].timestamp,
                    total: overviewData[i].coin.toLowerCase() === 'chips' || overviewData[i].coin.toLowerCase() === 'ptx' ? Number(fromSats(_parseData[j].total).toFixed(8)) : _parseData[j].total,
                  });
                }
              } catch (e) {
                console.log(e)
              }
            }

            items = sortByDate(items, 'timestamp');
            items = items.slice(0, resSizeLimit + 1);

            api.explorer.overview = items;

            api.log(`explorer overview updated at ${Date.now()}`);

            fs.writeFile(overviewFileLocation, JSON.stringify(items), (err) => {
              if (err) {
                api.log(`error updating overview cache file ${err}`);
              }
            });
          });
        }
      });
    }

    _getOverview();
    setInterval(() => {
      _getOverview();
    }, OVERVIEW_UPDATE_INTERVAL);
  }

  api.get('/explorer/search', (req, res, next) => {
    const _searchTerm = req.query.term;

    if (_searchTerm.length === 64) {
      // txid
      let errorCount = 0;
      let coin;

      Promise.all(electrumServers.map((electrumServerData, index) => {
        return new Promise((resolve, reject) => {
          const _server = electrumServerData.serverList[0].split(':');
          const ecl = new electrumJSCore(_server[1], _server[0], _server[2]);

          ecl.connect();
          api.addElectrumConnection(ecl);
          ecl.blockchainTransactionGet(req.query.term)
          .then((_rawtxJSON) => {
            ecl.close();

            if (_rawtxJSON &&
                !_rawtxJSON.status &&
                !_rawtxJSON.code) {
              coin = electrumServerData.coin.toUpperCase();
            }
            resolve();
          });
        });
      }))
      .then(result => {
        if (!coin) {
          const retObj = {
            msg: 'error',
            result: 'txid not found',
          };

          res.set({ 'Content-Type': 'application/json' });
          res.end(JSON.stringify(retObj));
        } else {
          const retObj = {
            msg: 'success',
            result: coin,
          };

          res.set({ 'Content-Type': 'application/json' });
          res.end(JSON.stringify(retObj));
        }
      });
    } else {
      // pub address
      let errorCount = 0;
      let _finishedBalanceCalls = {};
      let incorrectAddress = true;
      
      const addressCheck = addressVersionCheck(btcnetworks.kmd, _searchTerm);
      
      if (addressCheck === true) {
        incorrectAddress = false;
      }

      if (incorrectAddress) {
        const retObj = {
          msg: 'error',
          result: 'wrong address',
        };

        res.set({ 'Content-Type': 'application/json' });
        res.end(JSON.stringify(retObj));
      } else {
        Promise.all(electrumServers.map((electrumServerData, index) => {
          return new Promise((resolve, reject) => {
            if (req.query.balance &&
                req.query.balance === 'false') {
              incorrectAddress = true;
            }

            if (!incorrectAddress) {
              const _server = electrumServerData.serverList.length > 1 ? electrumServerData.serverList[getRandomIntInclusive(0, 1)].split(':') : electrumServerData.serverList[0].split(':');
              const ecl = new electrumJSCore(_server[1], _server[0], _server[2]);
              
              ecl.connect();
              api.addElectrumConnection(ecl);
              
              (async function() {
                const serverProtocolVersion = await api.getServerVersion(ecl);
                const _address = ecl.protocolVersion && Number(ecl.protocolVersion) >= 1.2 ? pubToElectrumScriptHashHex(_searchTerm, btcnetworks[electrumServerData.coin.toLowerCase()] || btcnetworks.kmd) : _searchTerm;

                setTimeout(() => {
                  if (!_finishedBalanceCalls[electrumServerData.coin.toUpperCase()]) {
                    errorCount++;
                    resolve('error');
                    _finishedBalanceCalls[electrumServerData.coin.toUpperCase()] = 'error';

                    try {
                      ecl.close();
                    } catch (e) {}
                  }
                }, SOCKET_MAX_TIMEOUT);

                if (serverProtocolVersion &&
                    Number(serverProtocolVersion) === -777) {
                  resolve(req.query.balance && req.query.balance === 'false' ? '' : 'error');
                  _finishedBalanceCalls[electrumServerData.coin.toUpperCase()] = req.query.balance && req.query.balance === 'false' ? '' : 'error';
                } else {
                  ecl.blockchainAddressGetBalance(_address)
                  .then((json) => {
                    ecl.close();
                    api.log(`search ${_searchTerm} in ${electrumServerData.coin}`);
                    api.log(json);

                    if (json &&
                        json.hasOwnProperty('confirmed') &&
                        json.hasOwnProperty('unconfirmed')) {
                      resolve({
                        coin: electrumServerData.coin.toUpperCase(),
                        balanceSats: {
                          confirmed: json.confirmed,
                          unconfirmed: json.unconfirmed,
                        },
                        balance: {
                          confirmed: Number(fromSats(json.confirmed).toFixed(8)),
                          unconfirmed: Number(fromSats(json.unconfirmed).toFixed(8)),
                        },
                      });
                      _finishedBalanceCalls[electrumServerData.coin.toUpperCase()] = true;
                    } else {
                      errorCount++;
                      resolve('error');
                      _finishedBalanceCalls[electrumServerData.coin.toUpperCase()] = 'error';
                    }
                  });
                }
              })();
            } else {
              resolve(req.query.balance && req.query.balance === 'false' ? '' : 'error');
              _finishedBalanceCalls[electrumServerData.coin.toUpperCase()] = req.query.balance && req.query.balance === 'false' ? '' : 'error';
            }
          });
        }))
        .then(result => {
          if (errorCount === electrumServers.length) {
            const retObj = {
              msg: 'error',
              result: 'wrong address',
            };

            res.set({ 'Content-Type': 'application/json' });
            res.end(JSON.stringify(retObj));
          } else {
            const _balance = result;
            let _transactions = [];

            Promise.all(electrumServers.map((electrumServerData, index) => {
              if (_finishedBalanceCalls[electrumServerData.coin.toUpperCase()] !== 'error') {
                return new Promise((resolve, reject) => {
                  let incorrectAddress = true;
                  
                  try {
                    const _b58check = bitcoin.address.fromBase58Check(_searchTerm);
      
                    if (_b58check.version === config.komodoParams.pubKeyHash ||
                        _b58check.version === config.komodoParams.scriptHash) {
                      incorrectAddress = false;
                    }
                  } catch(e) {}

                  if (req.query.transactions &&
                      req.query.transactions === 'false') {
                    incorrectAddress = true;
                  }

                  if (!incorrectAddress) {
                    const _server = electrumServerData.serverList.length > 1 ? electrumServerData.serverList[getRandomIntInclusive(0, 1)].split(':') : electrumServerData.serverList[0].split(':');
                    const ecl = new electrumJSCore(_server[1], _server[0], _server[2]);
                    const MAX_TX = 20;

                    ecl.connect();
                    api.addElectrumConnection(ecl);
                    
                    (async function() {
                      const serverProtocolVersion = await api.getServerVersion(ecl);
                      const _address = ecl.protocolVersion && Number(ecl.protocolVersion) >= 1.2 ? pubToElectrumScriptHashHex(_searchTerm, btcnetworks[electrumServerData.coin.toLowerCase()] || btcnetworks.kmd) : _searchTerm;
                    
                      if (serverProtocolVersion &&
                          Number(serverProtocolVersion) === -777) {
                        resolve();
                      } else {
                        ecl.blockchainAddressGetHistory(_address)
                        .then((json) => {                        
                          if (!json.code) {
                            if (json &&
                                json.length) {
                              json = sortTransactions(json);
                              json = json.slice(0, MAX_TX);

                              Promise.all(json.map((transaction, index) => {
                                return new Promise((resolve, reject) => {
                                  ecl.blockchainBlockGetHeader(transaction.height)
                                  .then((blockInfo) => {                              
                                    if (typeof blockInfo === 'string') {            
                                      blockInfo = parseBlock(blockInfo, btcnetworks[electrumServerData.coin.toLowerCase()] || btcnetworks.kmd);
                        
                                      if (blockInfo.merkleRoot) {
                                        blockInfo.merkle_root = electrumMerkleRoot(blockInfo);
                                      }
                                    }

                                    if (blockInfo &&
                                        blockInfo.timestamp) {
                                      ecl.blockchainTransactionGet(transaction.tx_hash)
                                      .then((_rawtxJSON) => {
                                        _transactions.push({
                                          coin: electrumServerData.coin.toUpperCase(),
                                          blockindex: transaction.height,
                                          txid: transaction.tx_hash,
                                          timestamp: Number(transaction.height) === 0 ? Math.floor(Date.now() / 1000) : blockInfo.timestamp,
                                        });
                                        resolve();
                                      });
                                    } else {
                                      resolve();
                                    }
                                  });
                                });
                              }))
                              .then(promiseResult => {
                                ecl.close();
                                resolve();
                              });
                            } else {
                              ecl.close();
                              resolve();
                            }
                          } else {
                            resolve();
                            ecl.close();
                          }
                        });
                      }
                    })();
                  } else {
                    resolve();
                  }
                });
              }
            }))
            .then(result => {
              let retObj = {
                msg: 'success',
                result: {
                  balance: _balance,
                  transactions: _transactions,
                },
              };

              if (req.query.transactions &&
                  req.query.transactions === 'false') {
                retObj = {
                  msg: 'success',
                  result: {
                    balance: _balance,
                  },
                };
              } else if (
                req.query.balance &&
                req.query.balance === 'false'
              ) {
                retObj = {
                  msg: 'success',
                  result: {
                    transactions: _transactions,
                  },
                };
              }

              res.set({ 'Content-Type': 'application/json' });
              res.end(JSON.stringify(retObj));
            });
          }
        });
      }
    }
  });

  api.get('/kmd/rewards', (req, res, next) => {
    const randomServer = _electrumServers.kmd.serverList[getRandomIntInclusive(0, 1)].split(':');
    const ecl = new electrumJSCore(randomServer[1], randomServer[0], randomServer[2]);
    let incorrectAddress = true;

    try {
      const _b58check = bitcoin.address.fromBase58Check(req.query.address);

      if (_b58check.version === config.komodoParams.pubKeyHash ||
          _b58check.version === config.komodoParams.scriptHash) {
        incorrectAddress = false;
      }
    } catch(e) {}

    if (incorrectAddress) {
      const retObj = {
        msg: 'error',
        result: 'wrong address',
      };

      res.set({ 'Content-Type': 'application/json' });
      res.end(JSON.stringify(retObj));
    } else {
      ecl.connect();
      api.addElectrumConnection(ecl);
      
      (async function() {
        const serverProtocolVersion = await api.getServerVersion(ecl);
        const _address = ecl.protocolVersion && Number(ecl.protocolVersion) >= 1.2 ? pubToElectrumScriptHashHex(req.query.address, btcnetworks.kmd) : req.query.address;

        ecl.blockchainAddressGetBalance(_address)
        .then((json) => {
          if (json &&
              json.hasOwnProperty('confirmed') &&
              json.hasOwnProperty('unconfirmed')) {
            ecl.blockchainAddressListunspent(_address)
            .then((utxoList) => {
              if (utxoList &&
                  utxoList.length) {
                // filter out < 10 KMD amounts
                let _utxo = [];

                for (let i = 0; i < utxoList.length; i++) {
                  if (fromSats(Number(utxoList[i].value)) >= 10) {
                    _utxo.push(utxoList[i]);
                  }
                }

                if (_utxo &&
                    _utxo.length) {
                  let interestTotal = 0;

                  Promise.all(_utxo.map((_utxoItem, index) => {
                    return new Promise((resolve, reject) => {
                      ecl.blockchainTransactionGet(_utxoItem.tx_hash)
                      .then((_rawtxJSON) => {
                        // decode tx
                        const decodedTx = txDecoder(_rawtxJSON, komodoParams);

                        if (decodedTx &&
                            decodedTx.format &&
                            decodedTx.format.locktime > 0) {
                          interestTotal += Number(komodoInterest(decodedTx.format.locktime, _utxoItem.value, _utxoItem.height));
                        }

                        resolve(true);
                      });
                    });
                  }))
                  .then(promiseResult => {
                    ecl.close();
                    const retObj = {
                      msg: 'success',
                      result: {
                        balance: Number(fromSats(json.confirmed).toFixed(8)),
                        unconfirmed: Number(fromSats(json.unconfirmed).toFixed(8)),
                        unconfirmedSats: json.unconfirmed,
                        balanceSats: json.confirmed,
                        interest: Number(interestTotal.toFixed(8)),
                        interestSats: Math.floor(toSats(interestTotal)),
                        total: interestTotal > 0 ? Number((fromSats(json.confirmed) + interestTotal).toFixed(8)) : 0,
                        totalSats: interestTotal > 0 ? json.confirmed + Math.floor(toSats(interestTotal)) : 0,
                      },
                    };

                    res.set({ 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(retObj));
                  });
                } else {
                  const retObj = {
                    msg: 'success',
                    result: {
                      balance: Number(fromSats(json.confirmed).toFixed(8)),
                      unconfirmed: Number(fromSats(json.unconfirmed).toFixed(8)),
                      unconfirmedSats: json.unconfirmed,
                      balanceSats: json.confirmed,
                      interest: 0,
                      interestSats: 0,
                      total: 0,
                      totalSats: 0,
                    },
                  };

                  res.set({ 'Content-Type': 'application/json' });
                  res.end(JSON.stringify(retObj));
                }
              } else {
                const retObj = {
                  msg: 'success',
                  result: {
                    balance: Number(fromSats(json.confirmed).toFixed(8)),
                    unconfirmed: Number(fromSats(json.unconfirmed).toFixed(8)),
                    unconfirmedSats: json.unconfirmed,
                    balanceSats: json.confirmed,
                    interest: 0,
                    interestSats: 0,
                    total: 0,
                    totalSats: 0,
                  },
                };

                res.set({ 'Content-Type': 'application/json' });
                res.end(JSON.stringify(retObj));
              }
            });
          } else {
            const retObj = {
              msg: 'error',
              result: json,
            };

            res.set({ 'Content-Type': 'application/json' });
            res.end(JSON.stringify(retObj));
          }
        });
      })();
    }
  });

  api.electrumGetCurrentBlock = (ecl) => {
    return new Promise((resolve, reject) => {
      ecl.blockchainHeadersSubscribe()
      .then((json) => {
        if (json.hasOwnProperty('block_height')) {
          resolve(json.block_height);
        } else if (json.hasOwnProperty('height')) {
          resolve(json.height);
        } else {
          resolve(json);
        }
      });
    });
  }

  api.listunspent = (ecl, address, network) => {
    let _atLeastOneDecodeTxFailed = false;

    return new Promise((resolve, reject) => {      
      ecl.connect();
      api.addElectrumConnection(ecl);
    
      (async function() {
        const serverProtocolVersion = await api.getServerVersion(ecl);
        const _address = ecl.protocolVersion && Number(ecl.protocolVersion) >= 1.2 ? pubToElectrumScriptHashHex(address, btcnetworks[network.toLowerCase()] || btcnetworks.kmd) : address;

        ecl.blockchainAddressListunspent(_address)
        .then((_utxoJSON) => {
          if (_utxoJSON &&
              _utxoJSON.length) {
            let formattedUtxoList = [];
            let _utxo = [];

            api.electrumGetCurrentBlock(ecl)
            .then((currentHeight) => {
              if (currentHeight &&
                  Number(currentHeight) > 0) {
                // filter out unconfirmed utxos
                for (let i = 0; i < _utxoJSON.length; i++) {
                  if (Number(currentHeight) - Number(_utxoJSON[i].height) !== 0) {
                    _utxo.push(_utxoJSON[i]);
                  }
                }

                if (!_utxo.length) { // no confirmed utxo
                  resolve({
                    code: -777,
                    result: 'no valid utxo',
                  });
                } else {
                  Promise.all(_utxo.map((_utxoItem, index) => {
                    return new Promise((resolve, reject) => {
                      ecl.blockchainTransactionGet(_utxoItem.tx_hash)
                      .then((_rawtxJSON) => {
                        // decode tx
                        const decodedTx = txDecoder(_rawtxJSON, komodoParams);

                        if (!decodedTx) {
                          _atLeastOneDecodeTxFailed = true;
                          resolve('cant decode tx');
                        } else {
                          let interest = 0;

                          if (network === 'kmd') {
                            if (Number(fromSats(_utxoItem.value)) >= 10 &&
                                decodedTx.format.locktime > 0) {
                              interest = Number(komodoInterest(decodedTx.format.locktime, _utxoItem.value, _utxoItem.height));
                            }
                          }

                          let _resolveObj = {
                            txid: _utxoItem.tx_hash,
                            vout: _utxoItem.tx_pos,
                            address,
                            amount: Number(fromSats(_utxoItem.value).toFixed(8)),
                            amountSats: _utxoItem.value,
                            locktime: decodedTx.format.locktime,
                            interest: Number(interest.toFixed(8)),
                            interestSats: Math.floor(toSats(interest)),
                            confirmations: Number(_utxoItem.height) === 0 ? 0 : currentHeight - _utxoItem.height,
                          };

                          if (network !== 'kmd') {
                            delete _resolveObj.interest;
                            delete _resolveObj.interestSats;
                          }

                          resolve(_resolveObj);
                        }
                      });
                    });
                  }))
                  .then(promiseResult => {
                    ecl.close();

                    if (!_atLeastOneDecodeTxFailed) {
                      resolve(promiseResult);
                    } else {
                      resolve({
                        code: -777,
                        result: 'decode error',
                      });
                    }
                  });
                }
              } else {
                ecl.close();
                resolve({
                  code: -777,
                  result: 'cant get current height',
                });
              }
            });
          } else {
            ecl.close();
            resolve(_utxoJSON);
          }
        });
      })();
    });
  }

  api.get('/kmd/listunspent', (req, res, next) => {
    const network = 'kmd';
    const randomServer = _electrumServers.kmd.serverList[getRandomIntInclusive(0, 1)].split(':');
    const ecl = new electrumJSCore(randomServer[1], randomServer[0], randomServer[2]);
    const addressCheck = addressVersionCheck(kmdAssetChains.indexOf(network.toUpperCase()) > -1 ? btcnetworks.kmd : btcnetworks[network.toLowerCase()], req.query.address);
    
    if (addressCheck !== true) {
      const retObj = {
        msg: 'error',
        result: 'Invalid address',
      };

      res.set({ 'Content-Type': 'application/json' });
      res.end(JSON.stringify(retObj));
    }

    api.listunspent(
      ecl,
      req.query.address,
      network
    )
    .then((json) => {
      const retObj = {
        msg: json.code ? 'error' : 'success',
        result: json,
      };

      res.set({ 'Content-Type': 'application/json' });
      res.end(JSON.stringify(retObj));
    });
  });

  api.get('/coin/listunspent', (req, res, next) => {
    const network = req.query.coin || 'kmd';
    const randomServer = _electrumServers[network.toLowerCase()].serverList[getRandomIntInclusive(0, 1)].split(':');
    const ecl = new electrumJSCore(randomServer[1], randomServer[0], randomServer[2]);
    const addressCheck = addressVersionCheck(kmdAssetChains.indexOf(network.toUpperCase()) > -1 ? btcnetworks.kmd : btcnetworks[network.toLowerCase()], req.query.address);

    if (addressCheck !== true) {
      const retObj = {
        msg: 'error',
        result: 'Invalid address',
      };

      res.set({ 'Content-Type': 'application/json' });
      res.end(JSON.stringify(retObj));
    }

    api.listunspent(
      ecl,
      req.query.address,
      network.toLowerCase()
    )
    .then((json) => {
      const retObj = {
        msg: json.code ? 'error' : 'success',
        result: json,
      };

      res.set({ 'Content-Type': 'application/json' });
      res.end(JSON.stringify(retObj));
    });
  });

  api.post('/coin/push', (req, res, next) => {
    const network = req.body.coin || 'kmd';
    const rawtx = req.body.rawtx;
    const randomServer = _electrumServers[network.toLowerCase()].serverList[getRandomIntInclusive(0, 1)].split(':');
    const ecl = new electrumJSCore(randomServer[1], randomServer[0], randomServer[2]);

    if (!rawtx) {
      const retObj = {
        msg: 'error',
        result: 'missing rawtx param',
      };
      res.set({ 'Content-Type': 'application/json' });
      res.end(JSON.stringify(retObj));
    } else {
      ecl.connect();
      api.addElectrumConnection(ecl);
      ecl.blockchainTransactionBroadcast(rawtx)
      .then((txid) => {
        ecl.close();
    
        api.log(txid);
        api.log(JSON.stringify(txid));
    
        if (txid &&
            JSON.stringify(txid).indexOf('bad-txns-inputs-spent') > -1) {
          const retObj = {
            msg: 'error',
            result: 'Bad transaction inputs spent',
          };
    
          res.set({ 'Content-Type': 'application/json' });
          res.end(JSON.stringify(retObj));
        } else if (
          JSON.stringify(txid).indexOf('"code":') > -1 &&
          JSON.stringify(txid).indexOf('"message":') > -1) {
          const retObj = {
            msg: 'error',
            result: txid.message,
          };
    
          res.set({ 'Content-Type': 'application/json' });
          res.end(JSON.stringify(retObj));
        } else {
          if (txid &&
              txid.length === 64) {
            if (JSON.stringify(txid).indexOf('bad-txns-in-belowout') > -1) {
              const retObj = {
                msg: 'error',
                result: 'Bad transaction inputs spent',
              };
    
              res.set({ 'Content-Type': 'application/json' });
              res.end(JSON.stringify(retObj));
            } else {
              const retObj = {
                msg: 'success',
                result: txid,
              };
    
              res.set({ 'Content-Type': 'application/json' });
              res.end(JSON.stringify(retObj));
            }
          } else {
            if (txid &&
                JSON.stringify(txid).indexOf('bad-txns-in-belowout') > -1) {
              const retObj = {
                msg: 'error',
                result: 'Bad transaction inputs spent',
              };
    
              res.set({ 'Content-Type': 'application/json' });
              res.end(JSON.stringify(retObj));
            } else {
              const retObj = {
                msg: 'error',
                result: 'Can\'t broadcast transaction',
              };
    
              res.set({ 'Content-Type': 'application/json' });
              res.end(JSON.stringify(retObj));
            }
          }
        }
      });
    }
  });

  api.get('/timestamp/now', (req, res, next) => {
    const retObj = {
      msg: 'success',
      result: Date.now(),
    };

    res.set({ 'Content-Type': 'application/json' });
    res.end(JSON.stringify(retObj));
  });

  api.post('/decode-transaction', (req, res, next) => {
    const _coin = req.body.coin;

    if (!_coin) {
      const retObj = {
        msg: 'error',
        result: 'Missing coin param',
      };

      res.set({ 'Content-Type': 'application/json' });
      res.end(JSON.stringify(retObj));
    }

    if (!req.body.rawtx) {
      const retObj = {
        msg: 'error',
        result: 'Missing rawtx param',
      };

      res.set({ 'Content-Type': 'application/json' });
      res.end(JSON.stringify(retObj));
    }

    let decodedTx;
    
    try {
      decodedTx = txDecoder(req.body.rawtx, kmdAssetChains.indexOf(_coin.toUpperCase()) > -1 ? btcnetworks.kmd : btcnetworks[_coin.toLowerCase()]);
    } catch (e) {}

    if (!decodedTx) {
      const retObj = {
        msg: 'error',
        result: 'Unable to decode transaction',
      };

      res.set({ 'Content-Type': 'application/json' });
      res.end(JSON.stringify(retObj));
    } else {
      let formattedTx = {
        txid: decodedTx.format.txid,
        locktime: decodedTx.format.locktime,
        version: decodedTx.format.version,
        outputs: decodedTx.outputs,
        inputs: decodedTx.inputs,
      };

      if (decodedTx.tx.hasOwnProperty('versionGroupId')) {
        formattedTx.versionGroupId = decodedTx.tx.versionGroupId;
      }

      if (decodedTx.tx.hasOwnProperty('overwintered')) {
        formattedTx.overwintered = decodedTx.tx.overwintered;
      }

      const retObj = {
        msg: 'success',
        result: formattedTx,
      };

      res.set({ 'Content-Type': 'application/json' });
      res.end(JSON.stringify(retObj));
    }
  });

  return api;
};
