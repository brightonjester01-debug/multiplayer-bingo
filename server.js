```js
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static("public"));

const rooms = new Map();

function makeCode() {
    let code;

    do {
        code = Math.random()
            .toString(36)
            .substring(2, 7)
            .toUpperCase();
    } while (rooms.has(code));

    return code;
}

function send(ws, data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

function broadcast(room, data) {
    send(room.host, data);

    for (const player of room.players.values()) {
        send(player.ws, data);
    }
}

function getState(room) {
    return {
        players: [...room.players.values()].map(p => ({
            id: p.id,
            name: p.name,
            card: p.card,
            marked: p.marked
        })),

        claims: room.claims
    };
}

wss.on("connection", ws => {

    ws.on("message", message => {

        let data;

        try {
            data = JSON.parse(message);
        } catch {
            return;
        }

        // =========================
        // HOST CREATES ROOM
        // =========================

        if (data.type === "createRoom") {

            const code = makeCode();

            const room = {
                code,
                host: ws,
                players: new Map(),

                cardTemplate: Array(25).fill(""),

                claims: Array(25).fill(null)
            };

            rooms.set(code, room);

            ws.roomCode = code;
            ws.isHost = true;

            send(ws, {
                type: "roomCreated",
                roomCode: code
            });

            return;
        }

        // =========================
        // PLAYER JOINS
        // =========================

        if (data.type === "joinRoom") {

            const code =
                String(data.roomCode || "")
                    .toUpperCase();

            const room = rooms.get(code);

            if (!room) {

                send(ws, {
                    type: "error",
                    message: "Room not found."
                });

                return;
            }

            const id =
                Date.now().toString(36) +
                Math.random()
                    .toString(36)
                    .substring(2);

            const player = {
                id,
                name: String(data.name || "Player"),
                ws,

                card: room.cardTemplate.slice(),

                marked: Array(25).fill(false)
            };

            room.players.set(id, player);

            ws.roomCode = code;
            ws.playerId = id;
            ws.isHost = false;

            send(ws, {
                type: "joined",
                playerId: id,
                roomCode: code,
                card: player.card,
                marked: player.marked,
                claims: room.claims
            });

            send(room.host, {
                type: "players",
                players: getState(room).players,
                claims: room.claims
            });

            return;
        }

        // =========================
        // HOST GIVES CARD TO EVERYONE
        // =========================

        if (data.type === "giveCards") {

            const room = rooms.get(ws.roomCode);

            if (!room || room.host !== ws) {
                return;
            }

            const card =
                Array.isArray(data.card)
                    ? data.card.slice(0, 25)
                    : Array(25).fill("");

            while (card.length < 25) {
                card.push("");
            }

            room.cardTemplate = card;

            // New cards reset all claims
            room.claims = Array(25).fill(null);

            for (const player of room.players.values()) {

                player.card = card.slice();

                player.marked =
                    Array(25).fill(false);

                send(player.ws, {
                    type: "card",
                    card: player.card,
                    marked: player.marked,
                    claims: room.claims
                });
            }

            send(ws, {
                type: "cardsGiven"
            });

            return;
        }

        // =========================
        // HOST GIVES CUSTOM CARD
        // =========================

        if (data.type === "givePlayerCard") {

            const room = rooms.get(ws.roomCode);

            if (!room || room.host !== ws) {
                return;
            }

            const player =
                room.players.get(data.playerId);

            if (!player) {
                return;
            }

            const card =
                Array.isArray(data.card)
                    ? data.card.slice(0, 25)
                    : Array(25).fill("");

            while (card.length < 25) {
                card.push("");
            }

            player.card = card;

            player.marked =
                Array(25).fill(false);

            send(player.ws, {
                type: "card",
                card: player.card,
                marked: player.marked,
                claims: room.claims
            });

            return;
        }

        // =========================
        // PLAYER CLAIMS A SQUARE
        // =========================

        if (data.type === "markSquare") {

            const room = rooms.get(ws.roomCode);

            if (!room || ws.isHost) {
                return;
            }

            const player =
                room.players.get(ws.playerId);

            if (!player) {
                return;
            }

            const index = Number(data.index);

            if (
                !Number.isInteger(index) ||
                index < 0 ||
                index >= 25
            ) {
                return;
            }

            // Another player already owns it
            if (
                room.claims[index] !== null &&
                room.claims[index] !== player.id
            ) {

                send(ws, {
                    type: "claimDenied",
                    index,
                    claims: room.claims
                });

                return;
            }

            // =========================
            // UNCLAIM
            // =========================

            if (room.claims[index] === player.id) {

                room.claims[index] = null;

                player.marked[index] = false;
            }

            // =========================
            // CLAIM
            // =========================

            else {

                room.claims[index] = player.id;

                player.marked[index] = true;
            }

            // Update EVERYONE
            broadcast(room, {
                type: "claimsUpdated",
                claims: room.claims
            });

            send(ws, {
                type: "marks",
                marked: player.marked
            });

            // =========================
            // WIN CONDITIONS
            // =========================

            const squareCount =
                player.marked.filter(Boolean).length;

            const hasFiveInARow =
                checkBingo(player.marked);

            const has13Squares =
                squareCount >= 13;

            if (hasFiveInARow || has13Squares) {

                broadcast(room, {
                    type: "bingo",

                    playerName: player.name,

                    playerId: player.id,

                    reason: has13Squares
                        ? "13 squares"
                        : "5 in a row"
                });
            }

            return;
        }

        // =========================
        // PLAYER CLEARS THEIR OWN SQUARES
        // =========================

        if (data.type === "clearMyCard") {

            const room = rooms.get(ws.roomCode);

            if (!room || ws.isHost) {
                return;
            }

            const player =
                room.players.get(ws.playerId);

            if (!player) {
                return;
            }

            for (let i = 0; i < 25; i++) {

                if (room.claims[i] === player.id) {
                    room.claims[i] = null;
                }
            }

            player.marked =
                Array(25).fill(false);

            broadcast(room, {
                type: "claimsUpdated",
                claims: room.claims
            });

            send(ws, {
                type: "marks",
                marked: player.marked
            });

            return;
        }
    });

    // =========================
    // PLAYER DISCONNECTS
    // =========================

    ws.on("close", () => {

        const room = rooms.get(ws.roomCode);

        if (!room) {
            return;
        }

        // Host left
        if (room.host === ws) {

            for (const player of room.players.values()) {

                send(player.ws, {
                    type: "error",
                    message: "The host closed the game."
                });

                player.ws.close();
            }

            rooms.delete(room.code);

            return;
        }

        // Player left
        if (ws.playerId) {

            room.players.delete(ws.playerId);

            // Free their claimed squares
            for (let i = 0; i < 25; i++) {

                if (room.claims[i] === ws.playerId) {
                    room.claims[i] = null;
                }
            }

            send(room.host, {
                type: "players",
                players: getState(room).players,
                claims: room.claims
            });

            for (const player of room.players.values()) {

                send(player.ws, {
                    type: "claimsUpdated",
                    claims: room.claims
                });
            }
        }
    });
});


// =========================
// CHECK 5 IN A ROW
// =========================

function checkBingo(marked) {

    // Rows
    for (let row = 0; row < 5; row++) {

        let complete = true;

        for (let col = 0; col < 5; col++) {

            if (!marked[row * 5 + col]) {
                complete = false;
                break;
            }
        }

        if (complete) {
            return true;
        }
    }

    // Columns
    for (let col = 0; col < 5; col++) {

        let complete = true;

        for (let row = 0; row < 5; row++) {

            if (!marked[row * 5 + col]) {
                complete = false;
                break;
            }
        }

        if (complete) {
            return true;
        }
    }

    // Main diagonal
    let complete = true;

    for (let i = 0; i < 5; i++) {

        if (!marked[i * 5 + i]) {
            complete = false;
            break;
        }
    }

    if (complete) {
        return true;
    }

    // Other diagonal
    complete = true;

    for (let i = 0; i < 5; i++) {

        if (!marked[i * 5 + (4 - i)]) {
            complete = false;
            break;
        }
    }

    return complete;
}


// =========================
// START SERVER
// =========================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Bingo running on port ${PORT}`);
});
```
