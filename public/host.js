const socket = new WebSocket(
    location.protocol === "https:"
        ? `wss://${location.host}`
        : `ws://${location.host}`
);

let players = [];

socket.addEventListener("open", () => {

    socket.send(JSON.stringify({
        type: "createRoom"
    }));

    createEditor();
});

socket.addEventListener("message", event => {

    const data = JSON.parse(event.data);

    if (data.type === "roomCreated") {

        document.getElementById("roomCode")
            .textContent = data.roomCode;

        return;
    }

    if (data.type === "players") {

        players = data.players;

        updatePlayers();

        return;
    }

    if (data.type === "cardsGiven") {

        document.getElementById("status")
            .textContent =
            "✅ Cards given to everyone!";

        return;
    }

    if (data.type === "bingo") {

        document.getElementById("status")
            .innerHTML =
            `<div class="bingo-message">
                🏆 ${escapeHtml(data.playerName)} GOT BINGO!
            </div>`;

        return;
    }

    if (data.type === "error") {
        alert(data.message);
    }
});

function createEditor() {

    const editor =
        document.getElementById("editor");

    editor.innerHTML = "";

    for (let i = 0; i < 25; i++) {

        const box =
            document.createElement("div");

        box.className =
            "editor-square";

        const input =
            document.createElement("input");

        input.placeholder =
            `Square ${i + 1}`;

        input.dataset.index = i;

        box.appendChild(input);

        editor.appendChild(box);
    }
}

function getCard() {

    return Array.from(
        document.querySelectorAll("#editor input")
    ).map(input => input.value);
}

function giveEveryoneCard() {

    const card = getCard();

    socket.send(JSON.stringify({

        type: "giveCards",

        card

    }));

}

function giveCustomCard() {

    const playerId =
        document.getElementById("playerSelect").value;

    if (!playerId) {

        alert("Select a player first.");

        return;
    }

    const card = getCard();

    socket.send(JSON.stringify({

        type: "givePlayerCard",

        playerId,

        card

    }));

    document.getElementById("status")
        .textContent =
        "✅ Custom card given.";

}

function updatePlayers() {

    const container =
        document.getElementById("players");

    const select =
        document.getElementById("playerSelect");

    container.innerHTML = "";
    select.innerHTML =
        `<option value="">Select a player</option>`;

    if (players.length === 0) {

        container.textContent =
            "Nobody has joined yet.";

        return;
    }

    players.forEach(player => {

        const div =
            document.createElement("div");

        div.className = "player";

        const marked =
            player.marked.filter(Boolean).length;

        div.innerHTML =
            `<strong>${escapeHtml(player.name)}</strong>
             — ${marked}/25 marked`;

        container.appendChild(div);

        const option =
            document.createElement("option");

        option.value = player.id;
        option.textContent = player.name;

        select.appendChild(option);
    });
}

function escapeHtml(text) {

    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}