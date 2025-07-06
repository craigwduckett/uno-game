const nameInput = document.getElementById('name');
const lobbyIdInput = document.getElementById('lobby-id');
const joinButton = document.getElementById('join');
const playersList = document.getElementById('players');
const readyButton = document.getElementById('ready');
const lobbyDiv = document.getElementById('lobby');
const gameDiv = document.getElementById('game');
const opponentHandsDiv = document.getElementById('opponent-hands');
const playerHandDiv = document.getElementById('player-hand');
const discardPileDiv = document.getElementById('discard-pile');
const drawCardButton = document.getElementById('draw-card');
const calloutButton = document.getElementById('callout-button');
const turnIndicator = document.getElementById('turn-indicator');
const turnText = document.getElementById('turn-text');
const wildColorPicker = document.getElementById('wild-color-picker');
const colorOptions = document.getElementById('color-options');
const lobbyInfo = document.getElementById('lobby-info');
const currentLobbyId = document.getElementById('current-lobby-id');

let myId;
let ws;
let currentTurn = -1;
let players = [];
let pendingWildCard = null;
let selectedCards = [];
let isSelectingMultiple = false;
let myHand = [];
let myLobbyId = null;

// Add these elements to the existing DOM references
const joinFormContainer = document.createElement('div');
joinFormContainer.id = 'join-form-container';

function connect() {
    ws = new WebSocket('ws://localhost:8080');

    ws.onopen = () => {
        console.log('Connected to server');
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        if (message.action === 'error') {
            alert(message.message);
            // Re-enable form inputs so user can try again
            nameInput.disabled = false;
            lobbyIdInput.disabled = false;
            joinButton.disabled = false;
            return;
        }
        
        if (message.action === 'players') {
            players = message.players;
            currentTurn = message.turn;
            myLobbyId = message.lobbyId;
            updatePlayers(message.players, message.turn);
            updateTurnIndicator();
            showLobbyInfo(message.lobbyId);
        }

        if (message.action === 'start') {
            myId = message.id;
            lobbyDiv.style.display = 'none';
            gameDiv.style.display = 'block';
            players = message.players;
            currentTurn = message.turn;
            myHand = message.hand;
            updatePlayers(message.players, message.turn);
            updateHand(message.hand);
            updateDiscardPile(message.discardPile);
            updateTurnIndicator();
        }

        if (message.action === 'update') {
            players = message.players;
            currentTurn = message.turn;
            myHand = message.hand;
            updatePlayers(message.players, message.turn);
            updateHand(message.hand);
            updateDiscardPile(message.discardPile);
            updateTurnIndicator();
        }

        if (message.action === 'win') {
            alert(`${message.winner} wins!`);
            resetGameState();
        }
    };

    ws.onclose = (event) => {
        console.log('Disconnected from server. Reconnecting...', event.code, event.reason);
        // Only reconnect if it wasn't a manual close
        if (event.code !== 1000) {
            setTimeout(connect, 1000);
        }
    };

    ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        // Don't manually close on error, let the browser handle it
    };
}

function canSendMessage() {
    return ws && ws.readyState === WebSocket.OPEN;
}

function sendMessage(message) {
    if (canSendMessage()) {
        ws.send(JSON.stringify(message));
    } else {
        console.warn('WebSocket is not connected. Message not sent:', message);
    }
}

function updateTurnIndicator() {
    if (currentTurn === -1 || !players.length) {
        turnText.textContent = 'Waiting for game to start...';
        turnIndicator.classList.remove('my-turn');
        return;
    }

    const currentPlayer = players[currentTurn];
    const isMyTurn = currentPlayer && currentPlayer.id === myId;
    
    if (isMyTurn) {
        turnText.textContent = 'Your turn!';
        turnIndicator.classList.add('my-turn');
    } else {
        turnText.textContent = `${currentPlayer ? currentPlayer.name : 'Unknown'}'s turn`;
        turnIndicator.classList.remove('my-turn');
    }
}

function showLobbyInfo(lobbyId) {
    if (lobbyId) {
        currentLobbyId.textContent = lobbyId;
        
        // Find the creator and update the lobby info
        const creator = players.find(p => p.isCreator);
        const lobbyInfoTitle = document.querySelector('#lobby-info h3');
        if (creator) {
            lobbyInfoTitle.innerHTML = `Lobby: <span id="current-lobby-id">${lobbyId}</span><br><small style="font-size: 0.8em; opacity: 0.8;">Created by ${creator.name} 👑</small>`;
            // Re-add the click functionality to the new span
            const newLobbyIdSpan = document.getElementById('current-lobby-id');
            newLobbyIdSpan.style.cursor = 'pointer';
            newLobbyIdSpan.title = 'Click to copy lobby ID';
            newLobbyIdSpan.addEventListener('click', copyLobbyId);
        } else {
            lobbyInfoTitle.innerHTML = `Lobby: <span id="current-lobby-id">${lobbyId}</span>`;
        }
        
        lobbyInfo.style.display = 'block';
        hideJoinForm();
        
        localStorage.setItem('unoLobbyId', lobbyId);
        localStorage.setItem('unoPlayerName', nameInput.value);
    }
}

function attemptRejoin() {
    const savedLobbyId = localStorage.getItem('unoLobbyId');
    const savedPlayerName = localStorage.getItem('unoPlayerName');
    
    if (savedLobbyId && savedPlayerName) {
        lobbyIdInput.value = savedLobbyId;
        nameInput.value = savedPlayerName;
    }
}

function resetGameState() {
    // Reset to lobby
    lobbyDiv.style.display = 'block';
    gameDiv.style.display = 'none';
    
    // Reset form
    nameInput.value = '';
    nameInput.disabled = false;
    joinButton.disabled = false;
    lobbyIdInput.disabled = false;
    
    // Clear game state
    myId = null;
    currentTurn = -1;
    players = [];
    pendingWildCard = null;
    selectedCards = [];
    isSelectingMultiple = false;
    myHand = [];
    myLobbyId = null;
    
    // Hide wild color picker and lobby info
    wildColorPicker.style.display = 'none';
    hideLobbyInfo();
    
    // Clear players list
    playersList.innerHTML = '';
    
    // Reset turn indicator
    turnText.textContent = 'Waiting for game to start...';
    turnIndicator.classList.remove('my-turn');
    
    // Clear localStorage
    localStorage.removeItem('unoLobbyId');
    localStorage.removeItem('unoPlayerName');
}

function updatePlayers(players, turn) {
    opponentHandsDiv.innerHTML = '';
    playersList.innerHTML = '';
    for (let i = 0; i < players.length; i++) {
        const player = players[i];
        const playerDiv = document.createElement('div');
        playerDiv.classList.add('player');
        if (i === turn) {
            playerDiv.classList.add('active');
        }
        
        // Check for UNO condition (1 card or multiple same-number cards)
        if (player.hand && isUnoCondition(player.hand)) {
            playerDiv.classList.add('uno');
        }
        
        // Add creator styling to opponent display too
        if (player.isCreator) {
            playerDiv.classList.add('creator');
        }
        
        let displayText = player.name;
        if (player.isCreator) {
            displayText += ' 👑';
        }
        
        if (player.hand) {
            playerDiv.textContent = `${displayText} (${player.hand.length} cards)`;
        } else {
            playerDiv.textContent = displayText;
        }

        if (player.id !== myId) {
            opponentHandsDiv.appendChild(playerDiv);
        }

        const li = document.createElement('li');
        let playerText = player.name;
        
        // Add creator indicator
        if (player.isCreator) {
            playerText += ' 👑';
        }
        
        // Add ready status
        if (player.ready) {
            playerText += ' (Ready)';
        }
        
        li.textContent = playerText;
        
        if (i === turn) {
            li.style.fontWeight = 'bold';
        }
        
        // Add special styling for creator
        if (player.isCreator) {
            li.classList.add('creator');
        }
        
        playersList.appendChild(li);
    }
}

function isUnoCondition(hand) {
    if (hand.length === 1) return true;
    
    // Check if all cards have the same number/type
    if (hand.length > 1) {
        const firstCard = hand[0];
        return hand.every(card => card.type === firstCard.type && card.type !== 'wild' && card.type !== 'wild4');
    }
    
    return false;
}

function updateHand(hand) {
    playerHandDiv.innerHTML = '';
    
    for (let i = 0; i < hand.length; i++) {
        const card = hand[i];
        const cardDiv = createCard(card);
        
        // Add card index for identification
        cardDiv.dataset.cardIndex = i;
        
        // Check if card is selected
        if (selectedCards.some(selected => selected.index === i)) {
            cardDiv.classList.add('selected');
        }
        
        cardDiv.addEventListener('click', () => handleCardClick(card, i, hand));
        playerHandDiv.appendChild(cardDiv);
    }
    
    // Add play selected cards button if multiple cards are selected (below the hand)
    if (selectedCards.length > 1) {
        const playButton = document.createElement('button');
        playButton.textContent = `Play ${selectedCards.length} cards`;
        playButton.classList.add('play-multiple-btn');
        playButton.addEventListener('click', playSelectedCards);
        playerHandDiv.appendChild(playButton);
        
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel Selection';
        cancelButton.classList.add('cancel-selection-btn');
        cancelButton.addEventListener('click', clearSelection);
        playerHandDiv.appendChild(cancelButton);
    }
}

function handleCardClick(card, cardIndex, hand) {
    // Check if we're selecting multiple cards
    if (isSelectingMultiple) {
        toggleCardSelection(card, cardIndex, hand);
    } else {
        // Check if this card can be played with others of the same type
        const sameTypeCards = hand.filter((c, i) => 
            c.type === card.type && 
            c.type !== 'wild' && 
            c.type !== 'wild4' && 
            i !== cardIndex
        );
        
        if (sameTypeCards.length > 0) {
            // Ask user if they want to play multiple cards
            if (confirm(`You have ${sameTypeCards.length + 1} cards of type "${card.type}". Do you want to select multiple cards to play?`)) {
                startMultipleSelection(card, cardIndex);
                return;
            }
        }
        
        // Single card play
        if (card.type === 'wild' || card.type === 'wild4') {
            showWildColorPicker(card);
        } else {
            sendMessage({ action: 'play', card: card });
        }
    }
}

function startMultipleSelection(card, cardIndex) {
    isSelectingMultiple = true;
    selectedCards = [{ card, index: cardIndex }];
    updateHand(getCurrentHand());
}

function toggleCardSelection(card, cardIndex, hand) {
    const existingIndex = selectedCards.findIndex(selected => selected.index === cardIndex);
    
    if (existingIndex >= 0) {
        // Remove from selection
        selectedCards.splice(existingIndex, 1);
    } else {
        // Add to selection if same type as first selected card
        if (selectedCards.length === 0 || selectedCards[0].card.type === card.type) {
            selectedCards.push({ card, index: cardIndex });
        } else {
            alert('You can only select cards of the same type!');
            return;
        }
    }
    
    // If no cards selected, exit multiple selection mode
    if (selectedCards.length === 0) {
        isSelectingMultiple = false;
    }
    
    updateHand(hand);
}

function playSelectedCards() {
    if (selectedCards.length === 0) return;
    
    const firstCard = selectedCards[0].card;
    if (firstCard.type === 'wild' || firstCard.type === 'wild4') {
        // For wild cards, we need to pick a color first
        pendingWildCard = selectedCards.map(s => s.card);
        wildColorPicker.style.display = 'block';
    } else {
        // Send multiple cards to server
        sendMessage({ 
            action: 'play_multiple', 
            cards: selectedCards.map(s => s.card),
            indices: selectedCards.map(s => s.index)
        });
        clearSelection();
    }
}

function clearSelection() {
    selectedCards = [];
    isSelectingMultiple = false;
    updateHand(getCurrentHand());
}

function getCurrentHand() {
    return myHand;
}

function showWildColorPicker(card) {
    pendingWildCard = card;
    wildColorPicker.style.display = 'block';
}

function hideWildColorPicker() {
    wildColorPicker.style.display = 'none';
    pendingWildCard = null;
}

function updateDiscardPile(discardPile) {
    discardPileDiv.innerHTML = '';
    const card = discardPile[discardPile.length - 1];
    const cardDiv = createCard(card);
    discardPileDiv.appendChild(cardDiv);
}

function createCard(card) {
    const cardDiv = document.createElement('div');
    cardDiv.classList.add('card');
    cardDiv.style.backgroundColor = card.color || 'black';
    cardDiv.textContent = card.type;
    return cardDiv;
}

// Update the color picker to handle multiple wild cards
colorOptions.addEventListener('click', (e) => {
    if (e.target.classList.contains('color-option')) {
        const color = e.target.dataset.color;
        if (pendingWildCard) {
            if (Array.isArray(pendingWildCard)) {
                // Multiple wild cards
                sendMessage({ 
                    action: 'play_multiple', 
                    cards: pendingWildCard.map(card => ({ ...card, color: color })),
                    indices: selectedCards.map(s => s.index)
                });
                clearSelection();
            } else {
                // Single wild card
                sendMessage({ action: 'play', card: { ...pendingWildCard, color: color } });
            }
            hideWildColorPicker();
        }
    }
});

joinButton.addEventListener('click', () => {
    const name = nameInput.value.trim();
    const lobbyId = lobbyIdInput.value.trim().toUpperCase();
    
    if (!name) {
        alert('Please enter your name');
        return;
    }
    
    if (name.length < 2) {
        alert('Name must be at least 2 characters long');
        return;
    }
    
    if (name.length > 20) {
        alert('Name must be 20 characters or less');
        return;
    }
    
    // Disable form to prevent multiple submissions
    nameInput.disabled = true;
    lobbyIdInput.disabled = true;
    joinButton.disabled = true;
    
    const message = { action: 'join', name: name };
    if (lobbyId) {
        message.lobbyId = lobbyId;
    }
    sendMessage(message);
});

readyButton.addEventListener('click', () => {
    sendMessage({ action: 'ready' });
});

drawCardButton.addEventListener('click', () => {
    sendMessage({ action: 'draw' });
});

document.addEventListener('DOMContentLoaded', () => {
    connect();
    attemptRejoin();
    
    // Create form container and move elements
    const nameDiv = nameInput.parentNode;
    const lobbyDiv = lobbyIdInput.parentNode;
    
    joinFormContainer.appendChild(nameDiv);
    joinFormContainer.appendChild(lobbyDiv);
    joinFormContainer.appendChild(joinButton);
    
    // Insert before players list
    const playersUl = document.getElementById('players');
    playersUl.parentNode.insertBefore(joinFormContainer, playersUl);
    
    // Add click-to-copy functionality to lobby ID
    const lobbyIdSpan = document.getElementById('current-lobby-id');
    if (lobbyIdSpan) {
        lobbyIdSpan.style.cursor = 'pointer';
        lobbyIdSpan.title = 'Click to copy lobby ID';
        lobbyIdSpan.addEventListener('click', copyLobbyId);
    }
});

function copyLobbyId() {
    const lobbyIdSpan = document.getElementById('current-lobby-id');
    const lobbyId = lobbyIdSpan.textContent;
    
    // Use the modern clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(lobbyId).then(() => {
            showCopyFeedback(lobbyIdSpan);
        }).catch(() => {
            // Fallback for older browsers
            fallbackCopyToClipboard(lobbyId, lobbyIdSpan);
        });
    } else {
        // Fallback for older browsers
        fallbackCopyToClipboard(lobbyId, lobbyIdSpan);
    }
}

function fallbackCopyToClipboard(text, element) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showCopyFeedback(element);
    } catch (err) {
        console.error('Failed to copy lobby ID:', err);
    }
    
    document.body.removeChild(textArea);
}

function showCopyFeedback(element) {
    const originalText = element.textContent;
    element.textContent = 'COPIED!';
    element.style.background = 'rgba(72, 187, 120, 0.3)';
    
    setTimeout(() => {
        element.textContent = originalText;
        element.style.background = 'rgba(255,255,255,0.2)';
    }, 1000);
}

function createLeaveLobbyButton() {
    const leaveLobbyBtn = document.createElement('button');
    leaveLobbyBtn.id = 'leave-lobby';
    leaveLobbyBtn.textContent = 'Leave Lobby';
    leaveLobbyBtn.classList.add('leave-lobby-btn');
    leaveLobbyBtn.addEventListener('click', leaveLobby);
    return leaveLobbyBtn;
}

function leaveLobby() {
    if (confirm('Are you sure you want to leave the lobby?')) {
        // Send leave message to server
        sendMessage({ action: 'leave' });
        
        // Reset to join form state
        showJoinForm();
        hideLobbyInfo();
        
        // Clear lobby data
        myLobbyId = null;
        localStorage.removeItem('unoLobbyId');
        localStorage.removeItem('unoPlayerName');
        
        // Clear players list
        playersList.innerHTML = '';
        
        // Re-enable form inputs
        nameInput.disabled = false;
        lobbyIdInput.disabled = false;
        joinButton.disabled = false;
        
        // Clear name input
        nameInput.value = '';
    }
}

function showJoinForm() {
    joinFormContainer.style.display = 'block';
    
    // Remove leave lobby button if it exists
    const existingLeaveBtn = document.getElementById('leave-lobby');
    if (existingLeaveBtn) {
        existingLeaveBtn.remove();
    }
}

function hideJoinForm() {
    joinFormContainer.style.display = 'none';
    
    // Add leave lobby button if it doesn't exist
    let leaveLobbyBtn = document.getElementById('leave-lobby');
    if (!leaveLobbyBtn) {
        leaveLobbyBtn = createLeaveLobbyButton();
        // Insert after lobby info
        const lobbyInfo = document.getElementById('lobby-info');
        lobbyInfo.parentNode.insertBefore(leaveLobbyBtn, lobbyInfo.nextSibling);
    }
}

function hideLobbyInfo() {
    lobbyInfo.style.display = 'none';
    showJoinForm();
}