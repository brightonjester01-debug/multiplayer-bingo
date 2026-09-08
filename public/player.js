const socket = new WebSocket(
    location.protocol === "https:"
        ? `wss://${location.host}`
        : `ws://${location.host}`
);

let marked = Array(25).fill(false);

let claims = Array(25).fill(null);

let playerId = null;

let currentCard = Array(25).fill("");


// =========================
// JOIN GAME
// =========================

function joinGame() {

    const name =
        document.getElementById("name")
            .value
            .trim();

    const room =
        document.getElementById("room")
            .value
            .trim()
            .toUpperCase();

    if (!name || !room) {

        alert("Enter your name and room code.");

        return;
    }

    socket.send(JSON.stringify({

        type: "joinRoom",

        name,

        roomCode: room

    }));
}


// =========================
// SERVER MESSAGES
// =========================

socket.addEventListener("message", event => {

    const data = JSON.parse(event.data);


    // =========================
    // JOINED
    // =========================

    if (data.type === "joined") {

        playerId = data.playerId;

        document.getElementById("join")
            .style.display = "none";

        document.getElementById("game")
            .style.display = "block";

        document.getElementById("roomDisplay")
            .textContent =
            "Room: " + data.roomCode;

        marked =
            data.marked ||
            Array(25).fill(false);

        claims =
            data.claims ||
            Array(25).fill(null);

        currentCard =
            data.card ||
            Array(25).fill("");

        showCard();

        return;
    }


    // =========================
    // NEW CARD
    // =========================

    if (data.type === "card") {

        currentCard =
            data.card ||
            Array(25).fill("");

        marked =
            data.marked ||
            Array(25).fill(false);

        claims =
            data.claims ||
            Array(25).fill(null);

        showCard();

        document.getElementById("status")
            .textContent =
            "🎁 Your card is ready!";

        return;
    }


    // =========================
    // CLAIMS UPDATED
    // =========================

    if (data.type === "claimsUpdated") {

        claims =
            data.claims ||
            Array(25).fill(null);

        updateBoard();

        return;
    }


    // =========================
    // MARKS UPDATED
    // =========================

    if (data.type === "marks") {

        marked =
            data.marked ||
            Array(25).fill(false);

        updateBoard();

        checkBingo();

        return;
    }


    // =========================
    // CLAIM DENIED
    // =========================

    if (data.type === "claimDenied") {

        claims =
            data.claims ||
            Array(25).fill(null);

        updateBoard();

        document.getElementById("status")
            .textContent =
            "❌ Another player already claimed that square.";

        return;
    }


    // =========================
    // BINGO
    // =========================

    if (data.type === "bingo") {

        if (data.playerId === playerId) {

            document.getElementById("status")
                .innerHTML =
                `<div class="bingo-message">
                    🏆 BINGO!
                </div>`;

        } else {

            document.getElementById("status")
                .textContent =
                "🏆 " +
                data.playerName +
                " got Bingo!";

        }

        return;
    }


    // =========================
    // ERROR
    // =========================

    if (data.type === "error") {

        alert(data.message);

    }

});


// =========================
// DISPLAY CARD
// =========================

function showCard() {

    const board =
        document.getElementById("bingo");

    board.innerHTML = "";

    for (let i = 0; i < 25; i++) {

        const square =
            document.createElement("div");

        square.className = "square";

        square.textContent =
            currentCard[i] || "";

        square.dataset.index = i;

        square.onclick =
            () => claimSquare(i);

        board.appendChild(square);
    }

    updateBoard();
}


// =========================
// UPDATE COLORS
// =========================

function updateBoard() {

    const squares =
        document.querySelectorAll(".square");

    squares.forEach((square, index) => {

        // Remove old classes
        square.classList.remove("marked");
        square.classList.remove("claimed-by-other");

        // Nobody owns it
        if (claims[index] === null) {
            return;
        }

        // I own it
        if (claims[index] === playerId) {

            square.classList.add("marked");

            square.style.pointerEvents = "auto";

            return;
        }

        // Someone else owns it
        square.classList.add("claimed-by-other");

        square.style.pointerEvents = "none";

    });
}


// =========================
// CLAIM SQUARE
// =========================

function claimSquare(index) {

    // Don't even send the request
    // if another player owns it.

    if (
        claims[index] !== null &&
        claims[index] !== playerId
    ) {

        return;
    }

    socket.send(JSON.stringify({

        type: "markSquare",

        index

    }));
}


// =========================
// CLEAR MY SQUARES
// =========================

function clearCard() {

    socket.send(JSON.stringify({

        type: "clearMyCard"

    }));

}


// =========================
// BINGO CHECK
// =========================

function checkBingo() {

    if (hasBingo(marked)) {

        document.getElementById("status")
            .innerHTML =
            `<div class="bingo-message">
                🏆 BINGO!
            </div>`;
    }
}


function hasBingo(board) {

    // Rows
    for (let row = 0; row < 5; row++) {

        let complete = true;

        for (let col = 0; col < 5; col++) {

            if (!board[row * 5 + col]) {
                complete = false;
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

            if (!board[row * 5 + col]) {
                complete = false;
            }
        }

        if (complete) {
            return true;
        }
    }


    // Diagonal
    let complete = true;

    for (let i = 0; i < 5; i++) {

        if (!board[i * 5 + i]) {
            complete = false;
        }
    }

    if (complete) {
        return true;
    }


    // Other diagonal
    complete = true;

    for (let i = 0; i < 5; i++) {

        if (!board[i * 5 + (4 - i)]) {
            complete = false;
        }
    }

    return complete;
}