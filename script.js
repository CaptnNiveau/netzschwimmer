/* TODO
host functionality, kick players, start game
double name glitch: not properly disconnected from channel -> still found as member
closing only causes turn indicator to freeze (only in own tab), nothing else
*/

const key = '1BLuPg.FSDv4w:ZzhPMpBcfzGfW_elvX6uzKdeWXm8ZBKf65o5sa-VNrg';
let realtime;
let ownDeck, middleDeck, close;
let playerIndex, playerActive, playerArray, pointArray;

function dealCards() {
    channel.presence.get(function(err, members) {
        //console.log(members);
        players = [];
        for (let i in members){
            let temp = {clientId: members[i].clientId, connectionId: members[i].connectionId};
            players.push(temp);
        }
    });

    channel.publish('turnList', players);

    //32 cards permit max 9 players
    if (players.length > 9){
        console.log("9 Players Maximum");
        return;
    }

    //generate deck as 2d array
    //[0]: color
    //[1]: card
    deck = [];
    for (i = 0; i < 32; i++){
        temp = [Math.floor(i/8), i % 8];
        deck.push(temp);
    }

    //distribute 3 cards to each player + 1
    plDecks = [];
    for (i = 0; i < players.length+1; i++){
        tempD = [];

        //push player identifier to deck
        if (i == players.length) {tempD.push('middleStack')}
        else {tempD.push(players[i].connectionId)};
        
        //push 3 random cards to deck
        for (x = 0; x < 3; x++){
            randIn = Math.floor(Math.random() * (deck.length-1));
            tempD.push(deck[randIn]);
            deck.splice(randIn, 1);
        }
        plDecks.push(tempD);
    }

    channel.publish('dealCards', plDecks);
    document.getElementById('btnStart').style.display = "none";

    channel.publish('nextPlayer', '0');
}

function checkPoints(){
    //count sums of colors
    sepPoints = [0,0,0,0];
    for (i in ownDeck) {
        if (ownDeck[i][0] == 7) {
            sepPoints[ownDeck[i][1]] += 11;
        } else if (ownDeck[i][0] > 3) {
            sepPoints[ownDeck[i][1]] += 10;
        } else {
            sepPoints[ownDeck[i][1]] += ownDeck[i][0] + 7;
        }
    };

    //check for halbe and assign valid value
    if ((ownDeck[0][0] == ownDeck[1][0]) & (ownDeck[0][0] == ownDeck[2][0])) {
        points = 30.5;
    } else {
        points = Math.max(...sepPoints);
    }

    return points;
}

function connectChannel(){
    realtime = new Ably.Realtime({key: key, clientId: document.getElementById('nameinput').value});

    if (realtime.connection.state = "connected"){
        console.log("Connected to Ably");
        //console.log(realtime);

        channelId = document.getElementById('idinput').value;
        channel = realtime.channels.get(channelId);

        channel.subscribe((message) => messageHandler(message));

        document.getElementById('login').style.display = "none";
        document.getElementById('members').style.display = "inline";

        channel.presence.enter();

        channel.presence.get(function(err, members) {
            if (members.length == 0){
                document.getElementById('btnStart').style.display = "inline";
            } else {
                for (let i in members){
                    if (members[i].connectionId != realtime.connection.id){
                        addPlayerName(members[i].connectionId, members[i].clientId);
                    }
                }
            }
        });

        channel.presence.subscribe('enter', function(member) {
            addPlayerName(member.connectionId, member.clientId);
        });

        channel.presence.subscribe('leave', function(member) {
            document.getElementById(member.connectionId).remove();
        });
    } else {
        alert('Ably could not be reached');
    }
}

function addPlayerName(conID, name){
    var tag = document.createElement("p");
    var text = document.createTextNode(name);
    tag.appendChild(text);
    tag.id = conID;
    var element = document.getElementById("members");
    element.appendChild(tag);
}

function messageHandler(message){
    switch(message.name){
        case 'dealCards':
            pointArray = [];

            for (let i in message.data){
                if (message.data[i][0] == realtime.connection.id){
                    ownDeck = message.data[i];
                    ownDeck.splice(0,1);
                    displayCards('own');
                } else if (message.data[i][0] == 'middleStack') {
                    middleDeck = message.data[i];
                    middleDeck.splice(0,1);
                    displayCards('middle');
                } else {
                    let playerTag = document.getElementById(message.data[i][0]);
                    playerTag.innerHTML += ': ';
                    for (let x = 1; x < 4; x++){
                        playerTag.innerHTML += message.data[i][x][0].toString() + ';' + message.data[i][x][1].toString() + ' ';
                    }
                }
            }
            break;

        case 'turnList':
            playerArray = message.data;
            for (i in playerArray){
                if (playerArray[i].connectionId == realtime.channels.all['lockenecker'].connectionManager.connectionId){playerIndex = parseInt(i)};
            }
            break;

        case 'newMiddle':
            middleDeck = message.data;
            displayCards('middle');
            break;

        case 'nextPlayer':
            playerActive = false;
            playerTag = document.getElementsByClassName('player-active');
            if (playerTag.length == 1){
                playerTag[0].classList.remove('player-active');
            }
            document.getElementById(playerArray[parseInt(message.data)].connectionId).classList.add('player-active');

            
            if (parseInt(message.data) == playerIndex){
                if (close){channel.publish('endRound', '#lockenecker4eva');}
                else {playerActive = true;};
            }
            break;

        case 'endRound':
            channel.publish('points', checkPoints().toString());
            break;

        case 'points':
            pointArray.push([parseInt(message.data), message.connectionId]);

            if (pointArray.length == playerArray.length){
                let losers = {smallest: 31, players: []};
                for (let i in pointArray){
                    if (pointArray[i][0] == losers.smallest) {losers.players.push(pointArray[i][1])}
                    else if (pointArray[i][0] < losers.smallest) {
                        losers.smallest = pointArray[i][0];
                        losers.players.length = 0;
                        losers.players.push(pointArray[i][1]);
                    }
                }
                console.log(losers);
            }
            break;

        default:
            console.log(message);
    }
}

function displayCards(deck){
    let picList = document.getElementsByClassName(deck);

    switch(deck){
        case 'own': tempDeck = ownDeck; break;
        case 'middle': tempDeck = middleDeck; break;
    }

    for (let x = 0; x < 3; x++){
        picList[x].src = 'cards/' + tempDeck[x][0].toString() + '/' + tempDeck[x][1].toString() + '.png';
    }
}

function validateRoomName(name){
    if (name[0] == '['){return false}
    if (name[0] == ':'){return false}
    if (name.length == 0){return false}
}

function makeid(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
    }
    return result;
}

function swapCard(index){
    if (playerActive){
        active = document.getElementsByClassName('swap-active');
        element = document.getElementsByClassName('middle')[index];

        if (active.length != 0){
            if (active[0].classList.contains('one')){ownIndex = 0};
            if (active[0].classList.contains('two')){ownIndex = 1};
            if (active[0].classList.contains('three')){ownIndex = 2};

            if (element.classList.contains('one')){middleIndex = 0};
            if (element.classList.contains('two')){middleIndex = 1};
            if (element.classList.contains('three')){middleIndex = 2};

            sCard = ownDeck[ownIndex];
            ownDeck[ownIndex] = middleDeck[middleIndex];
            middleDeck[middleIndex] = sCard;

            active[0].classList.remove('swap-active');
            displayCards('own');
            displayCards('middle');

            channel.publish('newMiddle', middleDeck);

            nextPlayer();
        }
    }
}

function nextPlayer(){
    if (playerIndex == playerArray.length-1){channel.publish('nextPlayer', '0')}
    else {nextIndex = playerIndex+1; channel.publish('nextPlayer', nextIndex.toString());};
}

function activateCard(index){
    active = document.getElementsByClassName('swap-active');
    if (active.length == 1){active[0].classList.remove('swap-active')};

    element = document.getElementsByClassName('own')[index];
    element.classList.add('swap-active');
}

function machzu(){
    close = true;
    nextPlayer();
}

function swapAll(){
    let temp = middleDeck;
    channel.publish('newMiddle', ownDeck);
    ownDeck = temp;
    displayCards('own');

    nextPlayer();
}

function pass(){
    nextPlayer();
}