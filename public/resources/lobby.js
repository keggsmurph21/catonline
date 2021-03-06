// functionality specific to /lobby

// FUNCTIONS
function checkIfUserInGame( user, game ) {
  for (let p=0; p<game.players.length; p++) {
    if ( usersCheckEqual(game.players[p], user) ) {
      return true;
    }
  }
  return false;
}
function sendLobbyAction(data) {
  if (data.action==='new_game') toggleNewGame();
  socket.emit('lobby action', data);
}
function toggleNewGame() {
  let button = $('button.show-hide');
  button.html( button.html()==='Host new game' ? 'Cancel' : 'Host new game' )
    .siblings('div').each( function(key,value) { $(value).toggle(); });
}
function bindButtons() {
  $( 'button.show-hide' ).unbind().click( function(event) {
    toggleNewGame();
  });
  $( 'button.post' ).unbind().click( function(event) {
    let data = { action:$(event.target).prop( 'name' ), args:{} };
    let form = $(event.target).closest( 'form' );
    form.find( 'input' ).each( function(key,value) {
      let input = $(value);
      if (input.is( 'input[type=checkbox]' )) {
        data.args[ input.prop('name') ] = input.is(':checked');
      } else {
        data.args[ input.prop('name') ] = input.val(); // will need to parseInt() on server
      }
    });
    form.find( 'select' ).each( function(key,value) {
      let select = $(value);
      data.args[ select.prop('name') ] = select.find(':selected').text().trim();
    });
    sendLobbyAction(data);
  });
}
function bindTableRows() {
  $( 'tr.lobby.min' ).unbind().click( function(event) {

      // default everything to collapsed view
      $('tr.min').children()
        .css( 'border-bottom-style', 'solid' )
        .css( 'background-color', '#ddd' );
      $('tr.max').css( 'display', 'none' )

      // find the stuff we clicked on
      id = $(event.target).closest('tr').prop('id');

      // and expand it if it's collapsed
      if (id !== expandedid)
        expandTableRow(id);

      // track which one is currently expanded
      expandedid = (id !== expandedid ? id : null)

  });
}
function outputGameMinRowString( data, type ) {
  console.log(data);
  let str = '';

  str +=   '<td class="turn"><strong>' + data.turn + '</strong> ( ' + ( data.waiting.length ? data.waiting.map(u=>formatUsername(u)).join(', ') : 'N/A' ) + ' ) </th>';
  str +=   '<td class="status"><strong class="' + data.status + '">' + data.status + '</strong></th>';
  str +=   '<td class="scenario">' + data.settings.scenario + '</th>';
  str +=   '<td>';
  str +=     '<span class="players">' + (data.settings.numHumans + data.settings.numCPUs) + '</span>';
  str +=     '<span class="humans">' + data.players.length + '/' + data.settings.numHumans + '</span>';
  str +=   '</th>';
  str +=   '<td>' + formatUsername( data.author ) + '</th>';
  str +=   '<td><span class="date-updated">' + data.updated + '</span></th>';
  str += '</tr>';

  return str;
}
function outputGameMaxRowString( data, type ) {
  let str = '', canDelete = usersCheckEqual(data.author, user);

  str += '<td colspan="6">';
  str +=   '<div class="lobby max-container">';
  str +=     '<div class="lobby max info">';
  str +=       '<p class="victory-points-info">';
  str +=         '<strong>' + data.settings.victoryPointsGoal + '&nbsp;';
  str +=         'Victory Points</strong> required for victory';
  str +=       '</p>';
  str +=       '<div class="players-list">';
  for (let p=0; p<data.settings.numHumans; p++) {
    str +=       '<p>';
    str +=         '<span class="num">Player ' + (p+1) + ':&nbsp;&nbsp</span>';
    str +=         formatUsername( data.players[p] );
    str +=       '</p>';
  }
  str +=       '</div>';
  str +=     '</div>';
  str +=     '<form class="post-buttons">';
  str +=       '<input type="hidden" name="gameid" value="' + data.id + '" />';
  switch (type) {
    case 'active':
      str += '<button type="button" class="lobby post" name="delete_game" '+(canDelete?'':'disabled')+'>Delete</button>';
      str +=   '<button type="button" class="lobby post" name="play">'+(checkIfUserInGame(user,data)?'Play':'Watch')+'</button>';
      break;
    case 'pending':
      str += '<button type="button" class="lobby post" name="delete_game" '+(canDelete?'':'disabled')+'>Delete</button>';
      str +=   '<button type="button" class="lobby post" name="leave">Leave</button>';
      str +=   '<button type="button" class="lobby post" name="share">Share</button>';
      str +=   '<button type="button" class="lobby post" name="launch" '+(data.isFull?'':'disabled')+'>Launch</button>';
      break;
    case 'available':
      if (user.isSuperAdmin)
        str += '<button type="button" class="lobby post" name="delete_game"">Delete</button>';
      if (!data.isFull)
        str += '<button type="button" class="lobby post" name="join">Join</button>';
      break;
  }
  str +=     '</form>';
  str +=   '</div>';
  str += '</th>';

  return str;
}
function checkIfEmptyTables() {

  // check if we need to add the "no current games ..." displays
  for (let i=0; i<3; i++) {
    let type = ['active', 'available', 'pending'][i];
    if ( $('#' + type + '-games').find('tr').length===1 ) {
      let table = $('#' + type + '-games tr:last');
      table.after( '<tr class="lobby null"><td colspan="10"><div class="lobby null-container">no current games ...</div></th></tr>' );
    }
  }

}
function updateTables(games) {
  /***
    take incoming data from socket connection and use it to populate our lobby tables
    ***/

  // remove the "no current games ..." displays
  $('tr.lobby.null').detach();

  // iterate over each incoming user
  for (let g=0; g<games.length; g++) {
    // and add it to the table if it's not there
    if (!$('table').has( '#' + games[g].id ).length)
      addTableRow( games[g] );
  }


  bindButtons();
  bindTableRows();
  checkIfEmptyTables();

  // open up the hashed object
  /*if (window.location.hash.length) {
    let id = window.location.hash.replace(/#/, 'min');
    handleClickListitem(null,id);
    window.location.hash = '';
  }*/
}
function getTableType(data) {
  // decide which table a bit of game data belongs in
  // function name is a bit misleading b/c it actually returns
  // a $('tr') object
  let type;
  if ( data.status==='in-progress' ) {
    return 'active';
  } else {
    for (let p=0; p<data.players.length; p++) {
      let player = data.players[p];
      console.log(data.players);
      if ( usersCheckEqual(player, user) ) {
        return 'pending';
      }
    }
    return 'available';
  }
}
function removeTableRow(data) {
  $('#'+data.id).detach();
  $('#__'+data.id).detach();
  expandedid = null;
}
function updateTableRow(data) {

  if (getTableType(data)===$('#'+data.id).closest('table').prop('class').replace(/\-games/,'')) {
    $('#' + data.id).html( outputGameMinRowString(data,type) );
    $('#__'+data.id).html( outputGameMaxRowString(data,type) );
  } else {
    $('#' + data.id).detach();
    $('#__'+data.id).detach();
    addTableRow(data);
  }

}
function addTableRow(data) {

  let row, type = getTableType(data);
  let table = $('#'+type+'-games tr:last');

  row  = '<tr class="lobby max" id="__' + data.id + '">';
  row +=   outputGameMaxRowString(data, type);
  row += '</tr>';
  table.after( row );

  row  = '<tr class="lobby min" id="' + data.id + '">';
  row +=   outputGameMinRowString(data, type);
  row += '</tr>';
  table.after( row );

}
function expandTableRow(id) {
  $( '#'+id ).children()
    .css( 'border-bottom-style', 'none' )
    .css( 'background-color', '#eee' );
  $( '#__'+id ).css( 'display', 'table-row' )
    .children().css( 'background-color', '#eee' );
}

// GLOBALS
var expandedid;

// ON READY
$( function() {

  socket.emit('lobby connect');
  socket.on('lobby connect', function(data) {
    user = data.user; // declared as GLOBAL in messages.js
    updateTables(data.games);
  });

  // Socket events
  socket.on('on connection', function(data) {
  });
  socket.on('new connection', function(data) {
    //updateTables(data.games);
  });
  socket.on('lobby callback', function(data) {
    console.log(data);
    $( 'tr.lobby.null' ).detach();
    switch (data.action) {
      case ('ERROR'): break;
      case ('ADD'):
        for (let u=0; u<data.users.length; u++) {
          //
        }
        for (let g=0; g<data.games.length; g++) {
          addTableRow( data.games[g] );
        }
        break;
      case ('UPDATE'):
        for (let u=0; u<data.users.length; u++) {
          //
        }
        for (let g=0; g<data.games.length; g++) {
          updateTableRow( data.games[g] );
        }
        break;
      case ('REMOVE'):
        for (let u=0; u<data.users.length; u++) {
          //
        }
        for (let g=0; g<data.games.length; g++) {
          removeTableRow( data.games[g] );
        }
        break;
      case ('SHARE'):
        break;
      case ('PLAY'):
        window.location.href = '/play/'+data.url;
        break;
      default:
        data = {
          action  : 'ERROR',
          request : 'MALFORMED SERVER RESPONSE',
          message : '<br />'+JSON.stringify(data)
        };
    }
    checkIfEmptyTables();
    bindTableRows();
    bindButtons();
    //$('input[type=checkbox]').prop( 'checked', false );
    //logToConsole(data);
  });


});














/*$(function() {*/
  /*
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize variables
  var $window = $(window);
  var $messages = $('.messages'); // Messages area
  var $inputMessage = $('.inputMessage'); // Input message input box

  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page

  var username;
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput;*/
  /*
  var username, userid;
  var messagesUL = $('ul.messages');
  var messagesDiv = $('div.messages.public');
  var messagesInput = $('input.messages');

  messagesInput.focus();

  function forceTwoDigits(num) {
    return num > 9 ? '' + num : '0' + num;
  }

  function getTimeStr() {
    let datetime = new Date();
    let datestr =
      forceTwoDigits(datetime.getHours()%12) + ':' +
      forceTwoDigits(datetime.getMinutes()) + ':' +
      forceTwoDigits(datetime.getSeconds()) + ' ' +
      (datetime.getHours() > 12 ? 'pm' : 'am');
    return datestr;
  }

  function hashStringToHex(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
      let value = (hash >> (i * 8)) & 0xFF;
      color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
  }

  function updateTables(data) {

    $('tr.lobby.null').detach();

    for (let f=0; f<data.length; f++) {
      let type;
      if ( data[f].status==='in-progress' ) {
        type = 'active';
      } else {
        type = 'available';
        for (let p=0; p<data[f].players.length; p++) {
          let player = data[f].players[p];
          if (player.name===username && player.id===userid) {
            type = 'current';
          }
        }
      }

      let isFull = data[f].players.length===data[f].numHumans;
      let isVisible = (!isFull&&data[f].public) || type==='current';
      let hasChanged = $('span#date'+data[f]._id ).html()!==data[f].updated.toString();
      let isInPending = $('table#pending-games').has( 'tr#min' + data[f]._id ).length > 0;
      let isInAvailable = $('table#available-games').has( 'tr#min' + data[f]._id ).length > 0;

      //console.log( 'id', data[f]._id, 'full', isFull, 'delta', hasChanged, 'current', isInCurrent, 'avail', isInAvailable );

      if ( isInAvailable && isFull ) {
        removeTableRow( data[f] );
      } else if ( !isInPending && !isInAvailable && isVisible ) {
        addTableRow( data[f], type );
      } else if ( hasChanged ) {
        updateTableRow( data[f] );
      }

    }

    for (let f=0; f<2; f++) {
      let type = ['current', 'available'][f];
      if ( $('table#' + type + '-games').find('tr').length===1 ) {
        let table = $('table#' + type + '-games tr:last');
        table.after( '<tr class="lobby null"><td colspan="10"><div class="lobby null-container">no current games ...</div></th></tr>' );
      }
    }

    $(".lobby.play.link").unbind().click( function(event) {
      let id = event.target.id.replace( 'play', '' );
      window.location.href=('/play/' + id);
    });
    $( 'tr.lobby.min' ).unbind().click( function(event) {
      handleClickListitem(event);
    });
    $('.lobby.delete.link').unbind().click( function(event) {
      let id = event.target.id.replace( 'delete', '');
      $('#ld'+id).submit();
    })
    $('.lobby.share.link').unbind().click( function(event) {
      let id = event.target.id.replace( 'share', '' );
      let input = $('#private-code-input');
      input.val(id);
      input.select()
      document.execCommand('copy');
      messagesInput.val( 'Hi, come @(join my game!,' + input.val() + ')' );
      messagesInput.focus();
      input.val('');
    });
    $('.lobby.leave.link').unbind().click( function(event) {
      let id = event.target.id.replace( 'leave', '' );
      $('#lf'+id).submit();
    });
    $(".lobby.launch.link").unbind().click( function(event) {
      let id = event.target.id.replace( 'launch', '' );
      $('#ll'+id).submit();
    });
    $(".lobby.join.link").unbind().click( function(event) {
      let id = event.target.id.replace( 'join', '' );
      $('#jf'+id).submit();
    });
  }

  function removeTableRow(data) {
    $('tr#min'+data._id).detach();
    $('tr#max'+data._id).detach();
  }

  function updateTableRow(data) {
    $('span.current-number#' + data._id).html( data.players.length );

    let html = '';

    for (let p=0; p<data.numHumans; p++) {
      html += '<p>';
      html +=   '<span class="num">Player ' + (p+1) + ':&nbsp;&nbsp</span>';
      html +=   '<strong class="name">' + (data.players[p] ? data.players[p].name : '') + '</strong>';
      html += '</p>';
    }

    $('div.players-list#pl' + data._id).html( html );
    console.log( 'old', $('span#date'+data._id).html(), 'new', data.updated );
    $('span#date' + data._id).html( data.updated );

    // update play button

  }

  function addTableRow(data, type) {

    let current = (type==='current');

    let minrow = '';

    minrow += '<tr class="lobby min" id="min' + data._id + '">';
    minrow +=   '<td><strong class="' + data.status + '" id="data' + data.status + '">' + data.status + '</strong></th>';
    minrow +=   '<td>' + data.scenario + '</th>';
    minrow +=   '<td>';
    minrow +=     '<span class="current-number" id="' + data._id + '">' + data.players.length + '</span>/';
    minrow +=     '<span class="required-number">'+ data.numHumans + '</span>';
    minrow +=   '</th>';
    minrow +=   '<td>' + data.author + '</th>';
    minrow +=   (current ? '<td>' + data.turn + '</th>' : '');
    minrow +=   '<td><span class="date-updated" id="date' + data._id + '">' + data.updated + '</span></th>';
    minrow += '</tr>';

    let maxrow = '';

    maxrow += '<tr class="lobby max" id="max' + data._id + '">';
    maxrow +=   '<td colspan="6">';
    maxrow +=     '<div class="lobby max-container">';
    maxrow +=       '<div class="lobby max info">';
    maxrow +=         '<p class="victory-points-info">';
    maxrow +=           '<strong>' + data.VPs + '&nbsp;';
    maxrow +=           'Victory Points</strong> required for victory';
    maxrow +=         '</p>';
    maxrow +=         '<div class="players-list" id="pl' + data._id + '">';
    for (let p=0; p<data.numHumans; p++) {
      let name = ( data.players[p] ? data.players[p].name : '' );
      let color = hashStringToHex(name);
      maxrow +=         '<p>';
      maxrow +=           '<span class="num">Player ' + (p+1) + ':&nbsp;&nbsp</span>';
      maxrow +=           '<strong class="name" style="color:' + color + '">' + name + '</strong>';
      maxrow +=         '</p>';
    }
    maxrow +=         '</div>';
    maxrow +=       '</div>';
    maxrow +=       '<div class="lobby max button">';
    if (current) {
      if (data.author===username) {
        maxrow +=     '<button class="lobby delete link" id="delete' + data._id + '">Delete</button>';
        maxrow +=     '<form action="/delete" method="POST" id="ld' + data._id + '" class="hidden-form">';
        maxrow +=       '<input type="hidden" name="gameid" value="' + data._id + '" />';
        maxrow +=     '</form>';
      } else {
        maxrow +=       '<button class="lobby leave link" id="leave' + data._id + '">Leave</button>';
        maxrow +=       '<form action="/leave" method="POST" id="lf' + data._id + '" class="hidden-form">';
        maxrow +=         '<input type="hidden" name="gameid" value="' + data._id + '" />';
        maxrow +=       '</form>';
      }
      maxrow +=       '<button class="lobby share link" id="share' + data._id + '">Share</button>';
      maxrow +=       '<button class="lobby launch link" id="launch'  + data._id + '" ' + (data.players.length===data.numHumans ? '' : 'disabled') + '>Launch</button>';
      maxrow +=       '<form action="/launch" method="POST" id="ll' + data._id + '" class="hidden-form">';
      maxrow +=         '<input type="hidden" name="gameid" value="' + data._id + '" />';
      maxrow +=       '</form>';

    } else {
      maxrow +=       '<button class="lobby join link" id="join' + data._id + '">Join</button>';
      maxrow +=       '<form action="/join" method="POST" id="jf' + data._id + '" class="hidden-form">';
      maxrow +=         '<input type="hidden" name="gameid" value="' + data._id + '" />';
      maxrow +=       '</form>';
    }
    maxrow +=       '</div>';
    maxrow +=     '</div>';
    maxrow +=   '</th>';
    maxrow += '</tr>';

    let table = (current ? $('table#pending-games tr:last') : $('table#available-games tr:last'))

    table.after( maxrow );
    table.after( minrow );

  }

  function handleClickListitem(event) {

    id = event.target.parentNode.id || event.target.parentNode.parentNode.id;

    min = $( '#' + id.replace(/max/, 'min') );
    if (id !== expandedid) {
      min.children()
        .css( 'border-bottom-style', 'none' )
        .css( 'background-color', '#eee' );
    } else {
      min.children()
        .css( 'border-bottom-style', 'solid' )
        .css( 'background-color', '#ddd' );
    }
    min.siblings().filter('.min').children()
      .css( 'border-bottom-style', 'solid' )
      .css( 'background-color', '#ddd' );

    max =  $( '#' + id.replace(/min/, 'max') );
    if (id !== expandedid) {
      max.css( 'display', 'table-row' )
        .children().css( 'background-color', '#eee' );
    } else {
      max.css( 'display', 'none' )
        .children().css( 'background-color', '#ddd' );
    }
    max.siblings().filter( '.max' )
      .css( 'display', 'none' )
      .children().css( 'background-color', '#ddd' );

    if (id.indexOf('min') > -1) {
      expandedid = (id !== expandedid ? id : null);
    }

  }*/

  /*
  function addParticipantsMessage (data) {
    var message = '';
    if (data.numUsers === 1) {
      message += "there's 1 participant";
    } else {
      message += "there are " + data.numUsers + " participants";
    }
    log(message);
  }

  // Sets the client's username
  function setUsername () {
    username = cleanInput($usernameInput.val().trim());

    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();

      // Tell the server your username
      socket.emit('add user', username);
    }
  }

  // Sends a chat message
  function sendMessage () {
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      addChatMessage({
        username: username,
        message: message
      });
      // tell server to execute 'new message' and send along one parameter
      socket.emit('new message', message);
    }
  }

  // Log a message
  function log (message, options) {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  function addChatMessage (data, options) {
    // Don't fade the message in if there is an 'X was typing'
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    var $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css('color', getUsernameColor(data.username));
    var $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);
  }
  *//*
  function addChatMessage(data, options={}) {
    let msgText = '<li class="';
    msgText += 'message ' + (options.class || '') + ' ' + data.username + '">';
    if (!options.omitTimestamp) {
      msgText += '<span class="timestamp">' + getTimeStr() + '</span>';
    }
    if (!options.omitUsername) {
      let color = hashStringToHex(data.username);
      msgText += '<strong class="username" style="color:' + color + '">' + data.username + '</strong>&nbsp;';
    }
    msgText += '<span class="body ' + (data.username===username ? 'self' : '') + '">' + escapeMessageBody(data.body) + '</span></li>';
    messagesUL.append( msgText );
    messagesDiv.scrollTop( messagesDiv[0].scrollHeight );
  }

  function escapeMessageBody(str) {

    let repl;
    const reg = (str.match(/@\(.*?\)/g) || []);

    for (let r=0; r<reg.length; r++) {

      const regr= reg[r].substring( 2, reg[r].length-1 );
      const split = regr.split(',');
      repl = '<strong style="color:'

      switch (split.length) {
        case 1:
          repl += hashStringToHex(split[0]) + '">';
          repl += regr;
          break;
        case 2:
          repl += hashStringToHex(split[1]) + '">';
          if ( split[1].length===24 && split[1].match(/^[a-z0-9]+$/i) ) { // i.e. it's a /join link
            repl += '<a class="chat-link" href="javascript:void(0);" onclick="javascript:$(`#private-code-input`).val(`' + split[1] + '`);">' + split[0] + '</a>';
          } else {
            repl += hashStringToHex(split[0]) + '">';
            repl += split[0];
          }
          break;
        default:
          repl += split.join(' ');
          break;
      }

      repl += '</strong>';
      str = str.replace( reg[r], repl );

    }
    return str;
  }

  function updateCurrentlyOnline(num) {
    $('span.currently-online').html(num);
  }

  function sendChatMessage() {
    var message = messagesInput.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message) {
      messagesInput.val('');
      addChatMessage({ body:message, username:username });
      *//*addChatMessage({
        username: username,
        message: message
      });*/
      // tell server to execute 'new message' and send along one parameter
      /*socket.emit('new message', message);
    }
  }

  // Prevents input from having injected markup
  function cleanInput (input) {
    return $('<div/>').text(input).html();
  }*/

  /*
  // Adds the visual chat typing message
  function addChatTyping (data) {
    data.typing = true;
    data.message = 'is typing';
    addChatMessage(data);
  }

  // Removes the visual chat typing message
  function removeChatTyping (data) {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addMessageElement (el, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // Prevents input from having injected markup
  function cleanInput (input) {
    return $('<div/>').text(input).html();
  }

  // Updates the typing event
  function updateTyping () {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(function () {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // Gets the 'X is typing' messages of a user
  function getTypingMessages (data) {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  }

  // Gets the color of a username through our hash function
  function getUsernameColor (username) {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
       hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

  // Keyboard events

  $window.keydown(function (event) {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (username) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        setUsername();
      }
    }
  });

  $inputMessage.on('input', function() {
    updateTyping();
  });

  // Click events

  // Focus input when clicking anywhere on login page
  $loginPage.click(function () {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(function () {
    $inputMessage.focus();
  });
  */

  // Keyboard events
  /*
  $(window).keydown( function(event) {
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (messagesInput.is(':focus')) {
        sendChatMessage();
        //socket.emit('stop typing');
        //typing = false;
      }
    }
  });

  // Socket events

  socket.on('on connection', function(data) {
    username = data.username;
    userid = data.userid;
    updateCurrentlyOnline(data.numUsers);
    updateTables(data.games);
  });

  socket.on('new connection', function(data) {
    //$('#put-shit-here').html( JSON.stringify(data.games) );
    updateTables(data.games);
    updateCurrentlyOnline(data.numUsers);
    addChatMessage({ body:'has connected!', username:data.username });
  });

  socket.on('end connection', function(data) {
    updateCurrentlyOnline(data.numUsers);
    addChatMessage({ body:'has disconnected', username:data.username });
  });

  socket.on('new message', function(data) {
    addChatMessage({ body:data.message, username:data.username });
  })*/

  /*
  // Whenever the server emits 'login', log the login message
  socket.on('login', function (data) {
    connected = true;
    // Display the welcome message
    var message = "Welcome to Socket.IO Chat – ";
    log(message, {
      prepend: true
    });
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', function (data) {
    addChatMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', function (data) {
    log(data.username + ' joined');
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function (data) {
    log(data.username + ' left');
    addParticipantsMessage(data);
    removeChatTyping(data);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', function (data) {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', function (data) {
    removeChatTyping(data);
  });

  socket.on('disconnect', function () {
    log('you have been disconnected');
  });

  socket.on('reconnect', function () {
    log('you have been reconnected');
    if (username) {
      socket.emit('add user', username);
    }
  });

  socket.on('reconnect_error', function () {
    log('attempt to reconnect has failed');
  });
  */
/*});*/
