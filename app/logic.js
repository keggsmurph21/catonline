var funcs = require('./funcs.js');
var config = require('../config/catan.js');

function accrue(player, windfall) {
  for (let res in windfall) {
    player.resources[res] += windfall[res];
  }
}
function spend(player, cost) {
  if (!funcs.canAfford(player, cost))
    throw Error(`can't afford, insufficient funds (`+JSON.stringify(cost)+`)`);
  for (let res in cost) {
    player.resources[res] -= cost[res];
  }
}

function pave(game, player, road, pay=true) {
  if (pay) {
    let cost = getCost(game, 'build', 'road');
    spend(player, cost);
  }

  player.roads.push(road.num);
  road.owner = player.playerID;
}
function settle(game, player, junc, pay=true) {
  if (!junc.isSettleable)
    throw Error('junc cannot be settled');

  if (pay) {
    let cost = getCost(game, 'build', 'settlement');
    spend(player, cost);
  }

  player.settlements.push(junc.num);
  junc.owner = player.playerID;

  junc.isSettleable = false;
  funcs.juncGetAdjJuncs(game.board, junc.num).forEach( function(adj) {
    game.board.juncs[adj].isSettleable = false;
  });

  player.publicScore += 1;
  player.privateScore+= 1;
}

function getCanTradeBank(player) {
  for (let res in player.resources) {
    if (player.resources[res] >= player.bankTradeRates[res])
      return true;
  }
  return false;
}
function getCost(game, type, item) {
  if (type==='build') {
    let costs = config.getBuildObjects(game);
    return costs[item].cost;
  } else if (type==='buy') {
    let costs = config.getBuyObjects(game);
    return costs[item].cost;
  }
  throw Error('unable to get cost to '+type+' '+item);
}
function getFlags(game, i) {
  let player = game.state.players[i];
  /*console.log('players: ('+game.state.players.length+')');
  console.log('iteration:',i,'=>\n',game.state.players[i]);*/
  let data = {
    isGameOver       : game.state.isGameOver,
    isFirstTurn      : game.state.isFirstTurn,
    isSecondTurn     : game.state.isSecondTurn,
    isRollSeven      : game.state.isRollSeven,
    hasRolled        : game.state.hasRolled,
    canSteal         : game.state.canSteal,
    waitForDiscard   : game.state.waitForDiscard,
    tradeAccepted    : game.state.tradeAccepted,
    vertex           : player.vertex,
    discard          : player.discard,
    canAcceptTrade   : player.canAcceptTrade,
    hasHeavyPurse    : player.hasHeavyPurse,
    canPlayDC        : player.canPlayDC,
    canBuild         : player.canBuild,
    canBuy           : player.canBuy,
    canTradeBank     : getCanTradeBank(player),
    isHuman          : player.isHuman,
    isCurrentPlayer  : game.state.currentPlayerID===player.playerID,
    isWaitingFor     : false
  }
  //console.log('flags', data);
  for (let i=0; i<game.state.waiting.forWho.length; i++) {
    if (funcs.usersCheckEqual(game.state.waiting.forWho[i], player.lobbyData))
      data.isWaitingFor = true;
  }
  return data;
}
function getAllPlayerData(player, game) {
  for (let i=0; i<game.state.players.length; i++) {
    if (funcs.usersCheckEqual(player, game.state.players[i].lobbyData)) {
      return game.state.players[i];
    }
  }
}

function sumObject(obj) {
  let acc = 0;
  for (let key in obj) {
    acc += obj[key];
  }
  return acc;
}
function sumDevCards(player) {
  let acc = 0;
  acc += sumObject(player.unplayedDCs);
  acc += sumObject(player.playedDCs);
  return acc;
}
function sumResources(player) {
  return sumObject(player.resources);
}

function storeHistory(game, edge, args) {
  while (game.state.history.length <= game.state.turn) {
    game.state.history.push([]);
  }
  let extra = (args.length > 1 ? ' '+args.slice(1).join(' ') : '')
  game.state.history[game.state.turn].push( edge.name + extra );
}
function calcLargestArmy(game) {
  // console.log('calc largest army');
}
function calcLongestRoad(game) {
  // console.log('calc longest road');
}
function updateGameStates(game) {
  let waiting = { forWho:[], forWhat:[] };
  for (let i=0; i<game.state.players.length; i++) {
    let player = game.state.players[i];
    let flags = getFlags(game, i);
    player.flags = flags;
    let adjacents = config.getAdjacentGameStates(flags);
    player.adjacents = adjacents;
    if (adjacents.length) {
      waiting.forWho.push( player.lobbyData );
      waiting.forWhat.push( adjacents );
    }
  }
  return waiting;
}
function updateBuyOptions(game, player) {

  // check if > 7 cards
  player.hasHeavyPurse = (sumResources(player) > 7);

  // check build things
  let buildable = config.getBuildObjects(game);
  for (let build in buildable) {
    let canAfford = funcs.canAfford(player, buildable[build].cost),
      propName = (build=='city' ? 'cities' : build+'s'),
      available = player[propName].length < buildable[build].max;

    player.canBuild[build] = canAfford && available;
  }

  // check buy things
  let buyable   = config.getBuyObjects(game);
  for (let buy in buyable) {
    switch (buy) {
      case ('dc'):
        let canAfford = funcs.canAfford(player, buyable.dc.cost),
          available = sumDevCards(player) < buyable.dc.max;

        player.canBuy.dc = canAfford && available;
        break;
      default:
        throw Error('unrecognized `buy` item: '+buy);
    }
  }
}
function updateCanPlay(player, except={}) {
  for (let dc in player.unplayedDCs) {
    player.canPlayDC[dc] = (player.unplayedDCs[dc] - (except[dc]||0) > 0);
  }
}

const helpers = {
  acceptTradeAsOffer(game, player) {
    spend(player, game.state.currentTrade.out);
    accrue(player, game.state.currentTrade.in);

    helpers.cancelTrade(game);
  },

  acceptTradeAsOther(game, player) {
    spend(player, game.state.currentTrade.in);
    accrue(player, game.state.currentTrade.out);

    game.state.tradeAccepted = true;
  },

  buyDevCard(game, player) {
    let cost = getCost(game, 'buy', 'dc');
    spend(player, cost);

    let dc = game.board.dcdeck.pop(), except = {};
    if (dc === 'vp') {
      player.privateScore += 1;
      except.vp = 0;
    } else {
      except[dc] = 1;
    }

    player.unplayedDCs[dc] += 1;
    updateCanPlay(player, except);
  },

  cancelTrade(game) {
    game.state.tradeAccepted = false;
    game.state.currentTrade = { in:null, out:null };
    for (let p=0; p<game.state.players.length; p++) {
      game.state.players[p].canAcceptTrade = false;
    }
  },

  collectResource(game, player, hex) {
    let res = game.board.hexes[hex].resource;
    if (res !== 'desert')
      player.resources[res] += 1;
  },

  collectResources(game) {
    let sum = game.board.dice.values.reduce((acc,i)=>(acc+=i));
    for (let h=0; h<game.board.hexes.length; h++) {
      let hex = game.board.hexes[h];
      if (hex.roll === sum) {
        for (let j=0; j<hex.juncs.length; j++) {
          let junc = game.board.juncs[hex.juncs[j]];
          if (junc.owner > -1) {
            let player = game.state.players[junc.owner];
            helpers.collectResource(game, player, hex.num);
            console.log( player.lobbyData.name,'collects a',hex.resource);
          }
        }
      }
    }
  },

  discard(game, player, cards) {
    spend(player, cards);

    let discarding = sumObject(cards);
    if (discarding > player.discard)
      throw Error('you only need to discard '+player.discard);

    player.discard -= discarding;

    game.state.waitForDiscard = false;
    if (player.discard) {
      for (let p=0; p<game.state.players.length; p++) {
        if (game.state.players[p].discard > 0)
          game.state.waitForDiscard = true;
      }
    }
  },

  end(game) {
    console.log('game is over');
    throw Error('not implemented');
  },

  fortify(game, player, junc) {
    if (player.settlements.indexOf(junc.num) === -1)
      throw Error('cities must be built on existing settlements');

    // remove from settlements
    let index = player.settlements.indexOf(junc.num);
    player.settlements.splice(index, 1);

    // add to cities
    player.cities.push(junc.num);

    let cost = getCost(game, 'build', 'city');
    spend(player, cost);

    player.publicScore += 1;
    player.privateScore+= 1;
  },

  getLastSettlement(game, player) {
    return player.settlements.slice(-1).pop();
  },

  initPave(game, player, road) {
    if (road.owner > -1)
      throw Error('road is already owned');

    let valid=false, match=helpers.getLastSettlement(game,player);
    for (let j in road.juncs) {
      if (road.juncs[j] === match)
        valid=true;
    }
    if (!valid)
      throw Error('this junc is not adjacent');

    pave(game, player, road, pay=false);
  },

  initSettle(game, player, junc) {
    settle(game, player, junc, pay=false);
  },

  iterateTurn(game) {
    let turnset = (game.state.turn/game.state.players.length);
    game.state.isFirstTurn = false;
    game.state.isSecondTurn = false;
    if (turnset < 1) {
      game.state.isFirstTurn  = true;
    } else if (turnset < 2) {
      game.state.isSecondTurn = true;
    }
    game.state.currentPlayerID = game.state.turn % game.state.players.length;
    game.state.turn += 1;
    game.state.hasRolled = false;
  },

  moveRobber(game, player, hex) {

    if (hex.num===game.board.robber)
      throw Error('robber is already here');
    game.board.robber=hex.num;

    // check if there is anyone to steal from
    let juncs = game.board.hexes[game.board.robber].juncs;
    for (let j=0; j<juncs.length; j++) {
      let owner = game.board.juncs[juncs[j]].owner;
      game.state.canSteal = (owner > -1 && owner !== player.playerID);
    }
  },

  offerTrade(game, player, trade) {
    game.state.currentTrade = trade;
    for (let q=0; q<game.state.players.length; q++) {
      let other = game.state.players[q];
      other.canAcceptTrade = false;
      if (player !== other) {
        other.canAcceptTrade = funcs.canAfford(other, trade.out);
      }
    }
    //console.log('offer', trade);
  },

  parseTrade(game, args) {
    let trade = { in:{}, out:{} },
      parsing = trade.out,
      expecting ='int';
    for (let a=0; a<args.length; a++) {
      if (args[a]==='=') {
        parsing = trade.in;
      } else {
        let res = helpers.validateResource(game, args[a+1]),
          num = funcs.toInt(args[a]);
        parsing[res] = (parsing[res] ? parsing[res]+num : num);
        a += 1;
      }
    }
    return trade;
  },

  pave(game, player, road) {
    if (road.owner > -1)
      throw Error('road is already owned');

    let valid = false, adjs = Array.from(
      funcs.roadGetAdjRoads(game.board, road.num));

    for (let r=0; r<player.roads.length; r++) {
      if (adjs.indexOf(r) > -1)
        valid=true;
    }
    if (!valid)
      throw Error('this road is not adjacent');

    pave(game, player, road);
  },

  playDC(game, player, card, args) {
    player.unplayedDCs[card]  -= 1;
    player.playedDCs[card]    += 1;

    switch (card) {
      case ('vp'):
        player.publicScore        += 1;
        player.unplayedDCs.vp     -= 1;
        player.playedDCs.vp       += 1
        break;
      case ('knight'):
        // do nothing here, depend on _e_knight_move_robber
        break;
      case ('monopoly'):
        let res = args;
        for (let p=0; p<game.state.players.length; p++) {
          if (p !== player.playerID) {
            let from = game.state.players[p];
            player.resources[res] += from.resources[res];
            from.resources[res]    = 0;
          }
        }
        break;
      case ('rb'):
        let rollback = player.roads.slice(0);
        try {
          helpers.pave(game, player, args[0]);
          helpers.pave(game, player, args[1]);
        } catch (e) {
          player.roads = rollback;
          throw e;
        }
        break;
      case ('yop'):
        player.resources[args[0]] += 1;
        player.resources[args[1]] += 1;
        break;
      default:
        throw Error('unrecognized development card: '+card);
    }
    updateCanPlay(player);
  },

  roll(game, r1, r2) {
    r1 = r1 || funcs.getRandomInt(min=1,max=6);
    r2 = r2 || funcs.getRandomInt(min=1,max=6);
    game.board.dice.values = [r1,r2];
    game.state.hasRolled   = true;
    game.state.isRollSeven = false;
    game.state.waitForDiscard = false;
    if ((r1+r2) === 7) {
      game.state.isRollSeven = true
      for (let p=0; p<game.state.players.length; p++) {
        let player = game.state.players[p];
        if (player.hasHeavyPurse) {
          game.state.waitForDiscard = true;
          player.discard = Math.floor(sumResources(player)/2);
        }
      }
    }
    console.log('roll='+(r1+r2));
  },

  settle(game, player, junc, pay=true) {
    // check if close to a road
    for (let r=0; r<junc.roads.length; r++) {
      let road = game.board.roads[junc.roads[r]];
      if (road.owner === player.playerID)
        return settle(game, player, junc);
    }
    throw Error('you can only settle near your roads');
  },

  steal(game, player, from) {
    if (p===q)
      throw Error(`you can't steal from youself!`);
    let juncs = game.board.hexes[game.board.robber].juncs;
    for (let j=0; j<juncs.length; j++) {
      if (game.board.juncs[juncs[j]].owner === from.playerID) {
        let list = [];
        for (let res in from.resources) {
          for (let i=0; i<from.resources[res]; i++) {
            list.push(res);
          }
        }
        let res = funcs.getRandomChoice(list);
        player.resources[res] += 1;
        from.resources[res] -= 1;
        return;
      }
    }
    throw Error(from.lobbyData.name+' is not adjacent to the robber');
  },

  tradeWithBank(game, player, trade) {
    let rate = {},
      outResource = Object.keys(trade.out)[0],
      inResource  = Object.keys(trade.in)[0];
    rate[outResource] = player.bankTradeRates[outResource];

    if (outResource===inResource)
      throw Error(`can't trade these resources:`);
    if (trade.out[outResource]*trade.in[inResource]
      < rate[outResource]*trade.in[inResource])
      throw Error(`bank rate: `+rate[o_res]);

    spend(player, trade.out);
    accrue(player, trade.in);
  },

  validateHex(game, h) {
    h = parseInt(h);
    if (isNaN(h) || h<0 || game.board.hexes.length<=h)
      throw Error('invalid hex: '+h);
    return game.board.hexes[h];
  },

  validateJunc(game, j) {
    j = parseInt(j);
    if (isNaN(j) || j<0 || game.board.juncs.length<=j)
      throw Error('invalid junc: '+j);
    return game.board.juncs[j];
  },

  validatePlayer(game, p) {
    p = parseInt(p);
    if (isNaN(p) || p<0 || game.state.players.length<=p)
      throw Error('invalid player: '+p);
    return game.state.players[p];
  },

  validateResource(game, res) {
    if (config.validateResource(game, res))
      return res;
    throw Error('invalid resource: '+res);
  },

  validateRoad(game, r) {
    r = parseInt(r);
    if (isNaN(r) || r<0 || game.board.roads.length<=r)
      throw Error('invalid road: '+r);
    return game.board.roads[r];
  },

  validateTrade(game, player, trade) {
    if (!funcs.canAfford(player, trade.out))
      throw Error(`can't afford, insufficient funds (`+JSON.stringify(trade.out)+`)`);
  }

}

module.exports = {

  launch(game, next) {
    for (let i=0; i<game.meta.settings.numCPUs; i++) {
      game.state.players.push( config.getNewPlayerData(user,game,false) );
    }

    console.log('launching');
    funcs.shuffle(game.state.players);
    colors = config.getColors(game);

    for (let i=0; i<colors.length; i++) {
      let player = game.state.players[i];
      player.playerID = i;
      player.color    = colors[i];
    }

    game.state.currentPlayerID = 0;
    game.state.waiting= updateGameStates(game);
    game.state.turn   = 1;
    game.state.status = 'in-progress';
    game.meta.updated = new Date;

    return next(null);
  },
  getGameData(user, game) {
    console.log("getting game data");
    return {
      public  : game.getPublicGameData(),
      private : game.getPrivateGameData(user)
    };
  },
  getFlags(game,p) { return getFlags(game,p); },
  getAdjacentGameStates(game,p) {
    let flags = getFlags(game,p);
    return config.getAdjacentGameStates(flags);
  },
  validateArguments(player, edge, args) {
    let e_args = config.getStateEdge(edge).arguments.split(' ');
    if (e_args[0] === '*') return args; // opt out of this scheme for complex args (for now?)
    for (let a in e_args) {
      let arg = e_args[a];
      switch (arg) {
        case ('int'):
        case ('hex'):
        case ('player'):
        case ('road'):
        case ('settlement'):
          e_args[a] = funcs.toInt(args[a]);
          break;
        case ('resource'):
          e_args[a] = args[a];
          break;
        case (''):
          return [];
        default:
          throw Error('unrecognized argument type: '+arg);
      }
    }
    return e_args;
  },
  validateEdgeIsAdjacent(game, i, edge) {
    return game.state.players[i].adjacents.indexOf(edge) > -1;
  },
  executeEdge(game, p, edge, args) {
    let player = game.state.players[p];
    edge = config.getStateEdge(edge);
    args.unshift(p);
    try {
      storeHistory(game, edge, args);
      edge.execute(game, args);
    } catch (e) {
      console.log(edge.name);
      console.log(e);
      throw e;
    }

    player.vertex = edge.target;
    game.state.waiting = updateGameStates(game);

    calcLongestRoad(game);
    calcLargestArmy(game);

    for (let q=0; q<game.state.players.length; q++) {
      updateBuyOptions(game, player);
      updateCanPlay(player);
      for (let a in game.state.players[q].adjacents) {
        let adj = game.state.players[q].adjacents[a];
        if (config.getStateEdge(adj).isPriority)
          module.exports.executeEdge(game, q, adj, []);
      }
    }

  },

  helpers : helpers

}
