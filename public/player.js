```js
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

        const roomDisplay =
            document.getElementById("roomDisplay");

        if (roomDisplay) {

            roomDisplay.textContent =
                "Room: " + data.roomCode;
        }

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

        setStatus(
            "🎁 Your card is ready!"
        );

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

        checkWin();

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

        setStatus(
            "❌ Another player already claimed that square."
        );

        return;
    }


    // =========================
    // BINGO
    // =========================

    if (data.type === "bingo") {

        if (data.playerId === playerId) {

            const reason =
                data.reason === "13 squares"
                    ? "13 squares!"
                    : "5 in a row!";

            setStatus(
                `🏆 BINGO! You won with ${reason}`
            );

        } else {

            setStatus(
                `🏆 ${data.playerName} got Bingo!`
            );
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

    if (!board) {
        return;
    }

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
// UPDATE BOARD COLORS
// =========================

function updateBoard() {

    const squares =
        document.querySelectorAll(".square");

    squares.forEach((square, index) => {

        square.classList.remove("marked");

        square.classList.remove(
            "claimed-by-other"
        );

        square.style.pointerEvents =
            "auto";


        // Nobody owns it
        if (claims[index] === null) {

            return;
        }


        // I own it
        if (claims[index] === playerId) {

            square.classList.add("marked");

            square.style.pointerEvents =
                "auto";

            return;
        }


        // Someone else owns it
        square.classList.add(
            "claimed-by-other"
        );

        square.style.pointerEvents =
            "none";
    });
}


// =========================
// CLAIM SQUARE
// =========================

function claimSquare(index) {

    // Someone else owns it
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
// CLEAR MY CARD
// =========================

function clearCard() {

    socket.send(JSON.stringify({

        type: "clearMyCard"

    }));
}


// =========================
// CHECK WIN
// =========================

function checkWin() {

    const squareCount =
        marked.filter(Boolean).length;


    // 13 OR MORE SQUARES
    if (squareCount >= 13) {

        setStatus(
            "🏆 BINGO! You claimed 13 or more squares!"
        );

        return;
    }


    // 5 IN A ROW
    if (hasFiveInARow(marked)) {

        setStatus(
            "🏆 BINGO! You got 5 in a row!"
        );

        return;
    }
}


// =========================
// CHECK 5 IN A ROW
// =========================

function hasFiveInARow(board) {

    // Rows
    for (let row = 0; row < 5; row++) {

        let complete = true;

        for (let col = 0; col < 5; col++) {

            if (!board[row * 5 + col]) {

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

            if (!board[row * 5 + col]) {

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

        if (!board[i * 5 + i]) {

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

        if (!board[i * 5 + (4 - i)]) {

            complete = false;

            break;
        }
    }

    return complete;
}


// =========================
// STATUS MESSAGE
// =========================

function setStatus(message) {

    const status =
        document.getElementById("status");

    if (status) {

        status.textContent = message;
    }
}
```
