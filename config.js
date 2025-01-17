const {
  coin,
  eservers,
  btcnetworks,
} = require('agama-wallet-lib');

const _config = {
  isDev: true,
  debug: true,
  https: false,
  ip: 'localhost',
  port: 8115,
  explorers: [ // iquidus
    'CHIPS',
    'PTX',
    'KOIN',
  ],
  modules: {
    mm: true, // price api methods included
    kv: true,
    faucet: true,
    faucetMini: true,
    explorer: true,
    mm: true,
    multisig: true,
    exchanges: true,
    ticker: true,
    wallet: true,
    fees: true,
  },
  rates: {
    useWget: false,
  },
  insight: {
    maxTxLength: 50,
    KMD: {
      url: 'https://www.kmdexplorer.io/insight-api-komodo',
    },
    MSHARK: {
      url: 'https://mshark.kmdexplorer.io/insight-api-komodo',
    },
    ZILLA: {
      url: 'https://zilla.kmdexplorer.io/insight-api-komodo',
    },
    OOT: {
      url: 'https://oot.kmdexplorer.io/insight-api-komodo',
    },
    PRLPAY: {
      url: 'https://prlpay.kmdexplorer.io/insight-api-komodo',
    },
    CHAIN: {
      url: 'https://chain.kmdexplorer.io/insight-api-komodo',
    },
    BNTN: {
      url: 'https://bntn.kmdexplorer.io/insight-api-komodo',
    },
    REVS: {
      url: 'https://revs.kmdexplorer.io/insight-api-komodo',
    },
    SUPERNET: {
      url: 'https://supernet.kmdexplorer.io/insight-api-komodo',
    },
    DEX: {
      url: 'https://dex.kmdexplorer.io/insight-api-komodo',
    },
    PANGEA: {
      url: 'https://pangea.kmdexplorer.io/insight-api-komodo',
    },
    JUMBLR: {
      url: 'https://jumblr.kmdexplorer.io/insight-api-komodo',
    },
    BET: {
      url: 'https://bet.kmdexplorer.io/insight-api-komodo',
    },
    CRYPTO: {
      url: 'https://crypto.kmdexplorer.io/insight-api-komodo',
    },
    HODL: {
      url: 'https://hodl.kmdexplorer.io/insight-api-komodo',
    },
    BOTS: {
      url: 'https://bots.kmdexplorer.io/insight-api-komodo',
    },
    MGW: {
      url: 'https://mgw.kmdexplorer.io/insight-api-komodo',
    },
    WLC: {
      url: 'https://wlc.kmdexplorer.io/insight-api-komodo',
    },
    COQUI: {
      url: 'https://coqui.kmdexplorer.io/insight-api-komodo',
    },
    BTCH: {
      url: 'https://btch.kmdexplorer.io/insight-api-komodo',
    },
    EQL: {
      url: 'https://eql.kmdexplorer.io/insight-api-komodo',
    },
    GLXT: {
      url: 'https://glxt.kmdexplorer.io/insight-api-komodo',
    },
    DSEC: {
      url: 'https://dsec.kmdexplorer.io/insight-api-komodo',
    },
    VRSC: {
      url: 'https://vrsc.explorer.dexstats.info/insight-api-komodo',
    },
    KV: {
      url: 'https://kv.kmdexplorer.io/insight-api-komodo',
    },
    NINJA: {
      url: 'https://ninja.kmdexplorer.io/insight-api-komodo',
    },
    MGNX: {
      url: 'http://mgnx.explorer.dexstats.info/insight-api-komodo',
    },
    PIRATE: {
      url: 'http://pirate.explorer.dexstats.info/insight-api-komodo',
    },
    CCL: {
      url: 'http://ccl.explorer.dexstats.info/insight-api-komodo',
    },
    DION: {
      url: 'https://explorer.dionpay.com/insight-api-komodo',
    },
    DION: {
      url: 'https://explorer.dionpay.com/insight-api-komodo',
    },
    KMDICE: {
      url: 'http://kmdice.explorer.dexstats.info/insight-api-komodo',
    },
    ZEXO: {
      url: 'http://zexo.explorer.dexstats.info/insight-api-komodo',
    },
    KSB: {
      url: 'http://ksb.explorer.dexstats.info/insight-api-komodo',
    },
    OUR: {
      url: 'http://our.explorer.dexstats.info/insight-api-komodo',
    },
    LUMBER: {
      url: 'https://explorer.lumberscout.io/insight-api-komodo',
    },
    ILN: {
      url: 'https://explorer.ilien.io/insight-api-komodo',
    },
    PGT: {
      url: 'https://explorer.pungotoken.com/insight-api-komodo',
    },
    RICK: {
      url: 'https://rick.kmd.dev/api',
    },
    MORTY: {
      url: 'https://morty.kmd.dev/api',
    },
    VOTE2019: {
      url: 'https://vote2019.world/insight-api-komodo',
    },
    BEER: {
      url: 'https://beer.kmdexplorer.io/insight-api-komodo',
    },
    PIZZA: {
      url: 'https://pizza.kmdexplorer.io/insight-api-komodo',
    },
    RFOX: {
      url: 'https://rfox.kmdexplorer.io/insight-api-komodo',
    },
    LABS: {
      url: 'https://labs.explorer.dexstats.info/insight-api-komodo',
    },
    HUSH: {
      url: 'https://explorer.myhush.org/insight-api-komodo',
    },
    COMMOD: {
      url: 'http://commod.explorer.dexstats.info/insight-api-komodo',
    },
    MCL: {
      url: 'http://mcl.explorer.dexstats.info/insight-api-komodo',
    },
  },
  kv: {
    contentLimit: 300, // chars
    wif: '',
  },
  faucet: {
    beer: {
      wif: '',
      fee: 0.0001,
      outSize: [1,1,1],
    },
    rick: {
      wif: '',
      fee: 0.0001,
      outSize: [1,2,4.777],
      resetTimeout: 300,
      freeLeechFrom: 1572517860,
      freeLeechTo: 1572566400,
    },
    morty: {
      wif: '',
      fee: 0.0001,
      outSize: [1,2,4.777],
    },
    pizza: {
      wif: '',
      fee: 0.0001,
      outSize: 0.777,
    },
    coqui: {
      wif: '',
      fee: 0.0001,
      outSize: 0.1,
    },
    prlpay: {
      wif: '',
      fee: 0.0001,
      outSize: 0.1,
    },
    tokensv2: {
      wif: '',
      fee: 0.0001,
      outSize: 0.1,
      insightApi: 'https://explorer.komodoplatform.com:10000/tokensv2/api',
    },
  },
  recaptchaKey: '',
  faucetCaptcha: false,
  ticker: [
    'kmd',
    'coqui',
    'revs',
    'supernet',
    'dex',
    'bots',
    'crypto',
    'hodl',
    'pangea',
    'bet',
    'mshark',
    'wlc',
    'jumblr',
    'mgw',
    'kmd',
    'chips',
    'btch',
    'beer',
    'pizza',
    'oot',
    'bntn',
    'chain',
    'kv',
    'prlpay',
    'zilla',
    'eql',
    'glxt',
    'ninja',
    'ccl',
    'call',
    'vrsc',
  ],
  tickerUrl: 'http://localhost:7783',
  komodoParams: btcnetworks.kmd,
  charts: {
    feedAPIPort: 8889,
    feedSourceIP: 'localhost',
    feedSourcePort: 7783,
  },
  electrumServers: [
    'coqui',
    'revs',
    'supernet',
    'dex',
    'bots',
    'crypto',
    'hodl',
    'pangea',
    'bet',
    'mshark',
    'wlc',
    'jumblr',
    'mgw',
    'kmd',
    'chips',
    'btch',
    'beer',
    'pizza',
    'oot',
    'bntn',
    'chain',
    'kv',
    'prlpay',
    'zilla',
    //'eql',
    'glxt',
    'ninja',
    'ccl',
    'vrsc',
    'dion',
    'kmdice',
    'ptx',
    'pgt',
    'lumber',
    'iln',
    'ksb',
    'our',
    'rick',
    'morty',
    'vote2019',
    'rfox',
    'zexo',
    'labs',
    'hush',
    'commod',
  ],
  electrumServersExtend: [
    'btc',
    'arg',
    'crw',
    'dash',
    'dgb',
    'doge',
    'emc2',
    'fair',
    'ltc',
    'mona',
    'nmc',
    'via',
    'vtc',
    'zec',
    'bch',
    'btg',
    'blk',
    'sib',
    'zcl',
    'hodlc',
    'btx',
    'btcz',
    'qtum',
  ],
  exchanges: {
    coinswitch: '',
    changelly: {
      secretKey: '',
      apiKey: '',
    },
  },
};

let config = JSON.parse(JSON.stringify(_config));

const explorers = () => {
  config.explorers = {};

  for (let i = 0; i < _config.explorers.length; i++) {
    config.explorers[_config.explorers[i]] = coin.explorerList[_config.explorers[i]];
  }
};

const electrumServers = () => {
  config.electrumServers = {};
  config.electrumServersExtend = {};

  for (let i = 0; i < _config.electrumServers.length; i++) {
    if (eservers &&
        eservers[_config.electrumServers[i]] &&
        eservers[_config.electrumServers[i]].serverList) {
      config.electrumServers[_config.electrumServers[i]] = {
        serverList: eservers[_config.electrumServers[i]].serverList,
      };
    }
  }

  for (let i = 0; i < _config.electrumServersExtend.length; i++) {
    if (eservers &&
        eservers[_config.electrumServersExtend[i]] &&
        eservers[_config.electrumServersExtend[i]].serverList) {
      config.electrumServersExtend[_config.electrumServersExtend[i]] = {
        serverList: eservers[_config.electrumServersExtend[i]].serverList,
      };
    }
  }
};

explorers();
electrumServers();

module.exports = config;
